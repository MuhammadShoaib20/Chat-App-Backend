const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { createAdapter } = require('@socket.io/redis-adapter');
const { pubClient, subClient } = require('./redis');
const User = require('../models/User');
const Conversation = require('../models/Conversation');

const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.adapter(createAdapter(pubClient, subClient));

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token'));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  /**
   * Helper to find all unique user IDs that share a conversation with the current user
   */
  const getPartnerIds = async (userId) => {
    const conversations = await Conversation.find({ 'participants.userId': userId });
    const partnerIds = new Set();
    
    conversations.forEach(conv => {
      conv.participants.forEach(p => {
        if (p.userId.toString() !== userId.toString()) {
          partnerIds.add(p.userId.toString());
        }
      });
    });
    
    return Array.from(partnerIds);
  };

  io.on('connection', async (socket) => {
    const userId = socket.user._id;
    console.log(`User connected: ${socket.user.username}`);

    // 1. Join a private room for this specific user ID
    socket.join(`user:${userId}`);

    // 2. Update status & Notify partners
    await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: Date.now() });
    
    const partners = await getPartnerIds(userId);
    partners.forEach(partnerId => {
      io.to(`user:${partnerId}`).emit('user-online', userId);
    });

    // Send initial presence snapshot for user's partners
    const onlinePartnerIds = partners.filter((partnerId) =>
      io.sockets.adapter.rooms.has(`user:${partnerId}`)
    );
    socket.emit('online-users', onlinePartnerIds);

    // 3. Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.user.username}`);
      
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: Date.now() });
      
      // Notify same partners that user is now offline
      const partnersOnDisconnect = await getPartnerIds(userId);
      partnersOnDisconnect.forEach(partnerId => {
        io.to(`user:${partnerId}`).emit('user-offline', userId);
      });
    });

    // 4. Load external event handlers (messages, typing, etc.)
    require('../sockets')(io, socket);
  });

  return io;
};

module.exports = setupSocket;