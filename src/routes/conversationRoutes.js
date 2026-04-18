const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getConversations,
  createConversation,
  getConversation,
  updateGroup,
  addParticipants,
  removeParticipant,
  deleteConversation,
  hideConversation,
  unhideConversation,
} = require('../controllers/conversationController');

router.route('/')
  .get(protect, getConversations)
  .post(protect, createConversation);

router.route('/:id')
  .get(protect, getConversation)
  .put(protect, updateGroup)
  .delete(protect, deleteConversation);

router.post('/:id/participants', protect, addParticipants);
router.delete('/:id/participants/:userId', protect, removeParticipant);
router.post('/:id/hide', protect, hideConversation);
router.post('/:id/unhide', protect, unhideConversation);

module.exports = router;