const User = require('../models/User');
const PushSubscription = require('../models/PushSubscription');
const { redisClient } = require('../config/redis'); // ✅ FIXED: destructure

// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const cacheKey = `user:${req.user._id}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const user = await User.findById(req.user._id).select('-password');
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(user));
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { username, email } = req.body;
    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (req.file) updateData.avatar = `/uploads/${req.file.filename}`;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      {returnDocument: 'after'}
    ).select('-password');

    await redisClient.del(`user:${req.user._id}`);

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Search users by username/email
// @route   GET /api/users/search
// @access  Private
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } },
        {
          $or: [
            { username: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } },
          ],
        },
      ],
    }).select('username email avatar isOnline').limit(10);
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Block a user
// @route   POST /api/users/block/:id
// @access  Private
const blockUser = async (req, res) => {
  try {
    const userToBlock = await User.findById(req.params.id);
    if (!userToBlock) return res.status(404).json({ message: 'User not found' });

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { blockedUsers: userToBlock._id },
    });

    await redisClient.del(`user:${req.user._id}`);
    res.json({ success: true, message: 'User blocked' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Unblock a user
// @route   POST /api/users/unblock/:id
// @access  Private
const unblockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { blockedUsers: req.params.id },
    });

    await redisClient.del(`user:${req.user._id}`);
    res.json({ success: true, message: 'User unblocked' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get block status with another user
// @route   GET /api/users/block-status/:id
// @access  Private
const getBlockStatus = async (req, res) => {
  try {
    const targetId = req.params.id;
    const user = await User.findById(req.user._id);
    const target = await User.findById(targetId);

    const hasBlocked = user.blockedUsers.includes(targetId);
    const isBlockedBy = target?.blockedUsers.includes(req.user._id) || false;

    res.json({ hasBlocked, isBlockedBy });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Save push subscription
// @route   POST /api/users/subscribe
// @access  Private
const saveSubscription = async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ message: 'Invalid subscription object' });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { userId: req.user._id, endpoint, keys, userAgent: req.headers['user-agent'] },
      { upsert: true, new: true }
    );
    res.status(201).json({ message: 'Subscription saved' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  searchUsers,
  blockUser,
  unblockUser,
  getBlockStatus,
  saveSubscription,
};