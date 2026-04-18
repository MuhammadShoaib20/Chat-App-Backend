const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ message: 'Server is healthy', timestamp: new Date().toISOString() });
});

module.exports = router;