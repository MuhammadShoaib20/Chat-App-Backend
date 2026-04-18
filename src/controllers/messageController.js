const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { sendPushNotification } = require('../utils/notificationHelper');

// @desc    Get paginated messages for a conversation
// @route   GET /api/conversations/:conversationId/messages
// @access  Private
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const isParticipant = conversation.participants.some(
      p => p.userId.toString() === req.user._id.toString()
    );
    if (!isParticipant) return res.status(403).json({ message: 'Not authorized' });

    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Message.countDocuments({ conversation: conversationId });

    res.json({
      messages: messages.reverse(),
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Send a new message (REST fallback)
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res) => {
  try {
    const { conversationId, content, type = 'text', mediaUrl = '' } = req.body;
    const conversation = await Conversation.findById(conversationId).populate('participants.userId');
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const otherParticipants = conversation.participants.filter(
      p => p.userId._id.toString() !== req.user._id.toString()
    );
    const otherIds = otherParticipants.map(p => p.userId._id);

    const isBlockedByOther = await User.exists({ _id: { $in: otherIds }, blockedUsers: req.user._id });
    if (isBlockedByOther) return res.status(403).json({ message: 'Action blocked' });

    const me = await User.findById(req.user._id).select('blockedUsers');
    const hasBlockedOther = (me?.blockedUsers || []).some((blockedId) =>
      otherIds.some((oid) => oid.toString() === blockedId.toString())
    );
    if (hasBlockedOther) return res.status(403).json({ message: 'Action blocked' });

    const message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      content,
      type,
      mediaUrl,
    });

    conversation.lastMessage = message._id;
    await conversation.save();

    const io = req.app.get('io');
    const populatedMessage = await message.populate('sender', 'username avatar');
    io.to(`conversation:${conversationId}`).emit('new-message', populatedMessage);

    // Push notifications for offline participants
    for (const participant of otherParticipants) {
      const targetId = participant.userId._id.toString();
      const isOnline = io.sockets.adapter.rooms.has(`user:${targetId}`);
      if (!isOnline) {
        sendPushNotification(targetId, {
          title: `New message from ${req.user.username}`,
          body: content.length > 50 ? content.substring(0, 47) + '...' : content,
          data: { url: `/chat/${conversationId}` },
        });
      }
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark messages as read
// @route   POST /api/messages/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const { messageIds, conversationId } = req.body;
    if (!messageIds || !messageIds.length) {
      return res.status(400).json({ message: 'No message IDs provided' });
    }

    await Message.updateMany(
      { _id: { $in: messageIds }, conversation: conversationId },
      { $addToSet: { readBy: req.user._id } }
    );

    const io = req.app.get('io');
    io.to(`conversation:${conversationId}`).emit('messages-read', {
      userId: req.user._id,
      messageIds,
      conversationId,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Edit a message
// @route   PUT /api/messages/:id
// @access  Private (sender only)
const editMessage = async (req, res) => {
  try {
    const { content } = req.body;
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    message.editHistory.push({ content: message.content, editedAt: new Date() });
    message.content = content;
    message.edited = true;
    await message.save();

    const updated = await message.populate('sender', 'username avatar');
    const io = req.app.get('io');
    io.to(`conversation:${message.conversation}`).emit('message-updated', updated);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a message (soft delete)
// @route   DELETE /api/messages/:id
// @access  Private (sender only)
const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    message.content = null;
    message.type = 'deleted';
    await message.save();

    const io = req.app.get('io');
    const updated = await message.populate('sender', 'username avatar');
    io.to(`conversation:${message.conversation}`).emit('message-updated', updated);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add/remove reaction (toggle)
// @route   POST /api/messages/:id/reactions
// @access  Private
const toggleReaction = async (req, res) => {
  try {
    const { emoji } = req.body;
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    const existingIndex = message.reactions.findIndex(
      r => r.userId.toString() === req.user._id.toString() && r.emoji === emoji
    );

    if (existingIndex > -1) {
      message.reactions.splice(existingIndex, 1);
    } else {
      message.reactions.push({ userId: req.user._id, emoji });
    }

    await message.save();
    const updated = await message
      .populate('sender', 'username avatar')
      .populate('reactions.userId', 'username');

    const io = req.app.get('io');
    io.to(`conversation:${message.conversation}`).emit('message-updated', updated);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Search messages in a conversation
// @route   GET /api/messages/search
// @access  Private
const searchMessages = async (req, res) => {
  try {
    const { conversationId, q } = req.query;
    if (!conversationId || !q) {
      return res.status(400).json({ message: 'Missing parameters' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const isParticipant = conversation.participants.some(
      p => p.userId.toString() === req.user._id.toString()
    );
    if (!isParticipant) return res.status(403).json({ message: 'Not authorized' });

    const messages = await Message.find({
      conversation: conversationId,
      content: { $regex: q, $options: 'i' },
    })
      .populate('sender', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getMessages,
  sendMessage,
  markAsRead,
  editMessage,
  deleteMessage,
  toggleReaction,
  searchMessages,
};