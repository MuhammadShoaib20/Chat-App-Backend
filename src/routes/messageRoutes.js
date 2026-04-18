const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getMessages,
  sendMessage,
  markAsRead,
  editMessage,
  deleteMessage,
  toggleReaction,
  searchMessages,
} = require('../controllers/messageController');

router.get('/search', protect, searchMessages);
router.get('/conversations/:conversationId', protect, getMessages);
router.post('/', protect, sendMessage);
router.post('/read', protect, markAsRead);
router.route('/:id')
  .put(protect, editMessage)
  .delete(protect, deleteMessage);
router.post('/:id/reactions', protect, toggleReaction);

module.exports = router;