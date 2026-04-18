const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getProfile, logoutUser } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// ✅ Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Auth router is working ✅' });
});

router.post('/register', registerUser);

router.post('/login', loginUser);

router.get('/profile', protect, getProfile);

router.post('/logout', protect, logoutUser);

module.exports = router;