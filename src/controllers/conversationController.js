const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Message = require('../models/Message');
const { redisClient } = require('../config/redis'); // ✅ FIXED: destructure

// Helper to invalidate cache for participants
const invalidateConversationCache = async (participants) => {
  try {
    if (!redisClient || !redisClient.isReady) {
      console.log('Redis not ready, skipping cache invalidation');
      return;
    }
    const pipeline = redisClient.multi();
    participants.forEach(p => {
      const userId = p.userId?._id || p.userId || p;
      pipeline.del(`conversations:${userId.toString()}`);
    });
    await pipeline.exec();
  } catch (err) {
    console.error('Cache Invalidation Error (non‑fatal):', err);
  }
};

const getConversations = async (req, res) => {
  try {
    const cacheKey = `conversations:${req.user._id}`;
    let cached;
    try {
      cached = await redisClient.get(cacheKey);
    } catch (redisErr) {
      console.error('Redis get error:', redisErr);
    }
    if (cached) return res.json(JSON.parse(cached));

    const conversations = await Conversation.find({
      'participants.userId': req.user._id,
      deletedFor: { $not: { $elemMatch: { userId: req.user._id } } },
    })
      .populate('participants.userId', 'username avatar isOnline')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    try {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(conversations));
    } catch (redisErr) {
      console.error('Redis set error:', redisErr);
    }
    res.json(conversations);
  } catch (error) {
    console.error('Error in getConversations:', error);
    res.status(500).json({ message: error.message });
  }
};

const createConversation = async (req, res) => {
  try {
    const { participantIds, isGroup, name, avatar } = req.body;
    if (!participantIds || !Array.isArray(participantIds)) {
      return res.status(400).json({ message: 'participantIds must be an array' });
    }

    const allIds = [...new Set([...participantIds.map(id => id.toString()), req.user._id.toString()])];

    if (!isGroup && allIds.length === 2) {
      const [a, b] = allIds;
      const blockedEitherWay = await User.exists({
        _id: { $in: [a, b] },
        blockedUsers: { $in: [a, b] },
      });
      if (blockedEitherWay) {
        return res.status(403).json({ message: 'Cannot create conversation: user blocked' });
      }
    }

    if (!isGroup && allIds.length === 2) {
      const existing = await Conversation.findOne({
        isGroup: false,
        'participants.userId': { $all: allIds },
        participants: { $size: 2 }
      }).populate('participants.userId', 'username avatar isOnline');
      if (existing) return res.json(existing);
    }

    const conversationData = {
      isGroup: isGroup || false,
      participants: allIds.map(id => ({
        userId: id,
        role: id === req.user._id.toString() ? 'admin' : 'member',
      })),
      createdBy: req.user._id,
    };
    if (isGroup) {
      if (!name) return res.status(400).json({ message: 'Group name required' });
      conversationData.name = name;
      conversationData.avatar = avatar || '';
    }

    const conversation = await Conversation.create(conversationData);
    const populated = await conversation.populate('participants.userId', 'username avatar isOnline');

    invalidateConversationCache(allIds).catch(err => console.error('Cache invalidation error:', err));

    res.status(201).json(populated);
  } catch (error) {
    console.error('Error in createConversation:', error);
    res.status(500).json({ message: error.message });
  }
};

const getConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('participants.userId', 'username avatar isOnline')
      .populate('lastMessage');
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const isParticipant = conversation.participants.some(
      p => p.userId._id.toString() === req.user._id.toString()
    );
    if (!isParticipant) return res.status(403).json({ message: 'Not authorized' });

    const isHidden = conversation.deletedFor?.some(
      (d) => d.userId.toString() === req.user._id.toString()
    );
    if (isHidden) return res.status(404).json({ message: 'Conversation not found' });

    res.json(conversation);
  } catch (error) {
    console.error('Error in getConversation:', error);
    res.status(500).json({ message: error.message });
  }
};

const hideConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const isParticipant = conversation.participants.some(
      p => p.userId.toString() === req.user._id.toString()
    );
    if (!isParticipant) return res.status(403).json({ message: 'Not authorized' });

    conversation.deletedFor = conversation.deletedFor || [];
    const alreadyHidden = conversation.deletedFor.some(
      (d) => d.userId.toString() === req.user._id.toString()
    );
    if (!alreadyHidden) {
      conversation.deletedFor.push({ userId: req.user._id, deletedAt: new Date() });
      await conversation.save();
    }

    await invalidateConversationCache(conversation.participants);
    res.json({ success: true });
  } catch (error) {
    console.error('Error in hideConversation:', error);
    res.status(500).json({ message: error.message });
  }
};

const unhideConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const isParticipant = conversation.participants.some(
      p => p.userId.toString() === req.user._id.toString()
    );
    if (!isParticipant) return res.status(403).json({ message: 'Not authorized' });

    conversation.deletedFor = (conversation.deletedFor || []).filter(
      (d) => d.userId.toString() !== req.user._id.toString()
    );
    await conversation.save();

    await invalidateConversationCache(conversation.participants);
    res.json({ success: true });
  } catch (error) {
    console.error('Error in unhideConversation:', error);
    res.status(500).json({ message: error.message });
  }
};

const updateGroup = async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isAdmin = conversation.participants.some(
      p => p.userId.toString() === req.user._id.toString() && p.role === 'admin'
    );
    if (!isAdmin) return res.status(403).json({ message: 'Only admins can update' });

    conversation.name = name || conversation.name;
    conversation.avatar = avatar || conversation.avatar;
    await conversation.save();

    const updated = await conversation.populate('participants.userId', 'username avatar isOnline');
    await invalidateConversationCache(conversation.participants);

    const io = req.app.get('io');
    io.to(`conversation:${conversation._id}`).emit('conversation-updated', updated);
    updated.participants.forEach((p) => {
      const id = p.userId?._id?.toString?.() || p.userId?.toString?.();
      if (id) io.to(`user:${id}`).emit('conversation-updated', updated);
    });

    res.json(updated);
  } catch (error) {
    console.error('Error in updateGroup:', error);
    res.status(500).json({ message: error.message });
  }
};

const addParticipants = async (req, res) => {
  try {
    const { userIds } = req.body;
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || !conversation.isGroup) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const currentUser = conversation.participants.find(
      p => p.userId.toString() === req.user._id.toString()
    );
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can add members' });
    }

    const existingIds = conversation.participants.map(p => p.userId.toString());
    const newIds = userIds.filter(id => !existingIds.includes(id));
    const newParticipants = newIds.map(id => ({ userId: id, role: 'member' }));

    conversation.participants.push(...newParticipants);
    await conversation.save();

    const updated = await conversation.populate('participants.userId', 'username avatar isOnline');
    await invalidateConversationCache([...conversation.participants, ...newIds]);

    const io = req.app.get('io');
    io.to(`conversation:${conversation._id}`).emit('participant-added', {
      conversationId: conversation._id,
      participants: newParticipants,
    });

    res.json(updated);
  } catch (error) {
    console.error('Error in addParticipants:', error);
    res.status(500).json({ message: error.message });
  }
};

const removeParticipant = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const userToRemove = req.params.userId;
    const currentUserId = req.user._id.toString();

    const currentParticipant = conversation.participants.find(
      p => p.userId.toString() === currentUserId
    );
    const isAdmin = currentParticipant && currentParticipant.role === 'admin';

    if (!isAdmin && userToRemove !== currentUserId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const index = conversation.participants.findIndex(p => p.userId.toString() === userToRemove);
    if (index === -1) return res.status(404).json({ message: 'Member not found' });

    conversation.participants.splice(index, 1);
    await conversation.save();

    await invalidateConversationCache([...conversation.participants, userToRemove]);

    const io = req.app.get('io');
    io.to(`conversation:${conversation._id}`).emit('participant-removed', {
      conversationId: conversation._id,
      userId: userToRemove,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error in removeParticipant:', error);
    res.status(500).json({ message: error.message });
  }
};

const deleteConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const isParticipant = conversation.participants.some(
      p => p.userId.toString() === req.user._id.toString()
    );
    if (!isParticipant) return res.status(403).json({ message: 'Not authorized' });

    const participantIds = conversation.participants.map(p => p.userId);
    await Conversation.findByIdAndDelete(conversation._id);
    await invalidateConversationCache(participantIds);

    res.json({ success: true });
  } catch (error) {
    console.error('Error in deleteConversation:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getConversations,
  createConversation,
  getConversation,
  updateGroup,
  addParticipants,
  removeParticipant,
  deleteConversation,
  hideConversation,
  unhideConversation,
};