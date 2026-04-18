const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const {
  getProfile,
  updateProfile,
  searchUsers,
  blockUser,
  unblockUser,
  getBlockStatus,
  saveSubscription,
} = require('../controllers/userController');

const upload = multer({ dest: 'uploads/' });

router.get('/profile', protect, getProfile);
router.put('/profile', protect, upload.single('avatar'), updateProfile);
router.get('/search', protect, searchUsers);
router.post('/block/:id', protect, blockUser);
router.post('/unblock/:id', protect, unblockUser);
router.get('/block-status/:id', protect, getBlockStatus);
router.post('/subscribe', protect, saveSubscription);

module.exports = router;