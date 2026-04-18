const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { sendPushNotification } = require('../utils/notificationHelper');

module.exports = (io, socket) => {
  if (socket.user?._id) {
    socket.join(`user:${socket.user._id}`);
  }

  socket.on('join-conversation', (id) => socket.join(`conversation:${id}`));
  socket.on('leave-conversation', (id) => socket.leave(`conversation:${id}`));

  socket.on('typing-start', ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit('user-typing', {
      userId: socket.user._id,
      username: socket.user.username,
      conversationId,
    });
  });

  socket.on('typing-stop', ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit('user-stopped-typing', {
      userId: socket.user._id,
      conversationId,
    });
  });

  socket.on('send-message', async (data) => {
    try {
      const { conversationId, content, type = 'text', mediaUrl = '' } = data;

      const conversation = await Conversation.findById(conversationId).populate('participants.userId');
      if (!conversation) return;

      const otherParticipants = conversation.participants.filter(
        p => p.userId._id.toString() !== socket.user._id.toString()
      );
      const otherIds = otherParticipants.map(p => p.userId._id);

      const isBlockedByOther = await User.exists({ _id: { $in: otherIds }, blockedUsers: socket.user._id });
      const userDoc = await User.findById(socket.user._id);
      const hasBlockedOther = (userDoc.blockedUsers || []).some((blockedId) =>
        otherIds.some((oid) => oid.toString() === blockedId.toString())
      );

      if (isBlockedByOther || hasBlockedOther) {
        return socket.emit('error', { message: 'Message failed: User blocked' });
      }

      const message = await Message.create({
        conversation: conversationId,
        sender: socket.user._id,
        content, type, mediaUrl
      });

      const updatedConv = await Conversation.findByIdAndUpdate(
        conversationId,
        { lastMessage: message._id, updatedAt: Date.now() },
        { returnDocument: 'after' }
      ).populate('participants.userId', 'username avatar');

      const populated = await message.populate('sender', 'username avatar');

      io.to(`conversation:${conversationId}`).emit('new-message', populated);

      if (updatedConv?.participants?.length) {
        updatedConv.participants.forEach((p) => {
          const id = p.userId?._id?.toString?.() || p.userId?.toString?.();
          if (id) io.to(`user:${id}`).emit('conversation-updated', updatedConv);
        });
      }

      for (const participant of otherParticipants) {
        const targetId = participant.userId._id.toString();
        const isOnline = io.sockets.adapter.rooms.has(`user:${targetId}`);
        if (!isOnline) {
          sendPushNotification(targetId, {
            title: `New message from ${socket.user.username}`,
            body: content.length > 50 ? content.substring(0, 47) + '...' : content,
            icon: '/logo192.png',
            data: { conversationId, url: `/chat/${conversationId}` },
          });
        }
      }
    } catch (err) {
      console.error('Socket send-message error:', err);
    }
  });

  socket.on('edit-message', async ({ messageId, content }) => {
    try {
      const msg = await Message.findById(messageId);
      if (!msg) return;
      if (msg.sender.toString() !== socket.user._id.toString()) return;
      msg.editHistory.push({ content: msg.content, editedAt: new Date() });
      msg.content = content;
      msg.edited = true;
      await msg.save();
      const updated = await msg.populate('sender', 'username avatar');
      io.to(`conversation:${msg.conversation}`).emit('message-updated', updated);
    } catch (err) {
      console.error('Socket edit-message error:', err);
    }
  });

  socket.on('delete-message', async ({ messageId }) => {
    try {
      const msg = await Message.findById(messageId);
      if (!msg) return;
      if (msg.sender.toString() !== socket.user._id.toString()) return;
      msg.content = null;
      msg.type = 'deleted';
      await msg.save();
      const updated = await msg.populate('sender', 'username avatar');
      io.to(`conversation:${msg.conversation}`).emit('message-updated', updated);
    } catch (err) {
      console.error('Socket delete-message error:', err);
    }
  });

  socket.on('add-reaction', async ({ messageId, emoji }) => {
    try {
      const currentUserId = socket.user?._id;
      if (!currentUserId) {
        console.error('Socket add-reaction error: User not authenticated');
        return;
      }

      const msg = await Message.findById(messageId);
      if (!msg) return;

      const existingIndex = msg.reactions.findIndex(
        (r) => r.userId.toString() === currentUserId.toString() && r.emoji === emoji
      );

      if (existingIndex > -1) {
        msg.reactions.splice(existingIndex, 1);
      } else {
        msg.reactions.push({ userId: currentUserId, emoji });
      }

      await msg.save();

      const populatedMsg = await Message.findById(messageId)
        .populate('sender', 'username avatar')
        .populate('reactions.userId', 'username');

      io.to(`conversation:${msg.conversation}`).emit('message-updated', populatedMsg);
    } catch (error) {
      console.error('Socket add-reaction error:', error);
    }
  });

  // ❌ All call-related events removed
};