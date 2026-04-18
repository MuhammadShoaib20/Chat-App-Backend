const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { storage, hasCloudinary } = require('../config/cloudinary');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Ensure uploads directory exists (for local fallback)
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('✅ Created uploads directory');
}

// Local disk storage (fallback)
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

// Choose storage: Cloudinary if available, else local
const storageEngine = hasCloudinary ? storage : localStorage;

// Configure multer with explicit limits and file filter
const upload = multer({
  storage: storageEngine,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    // Accept images and common document types
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images and documents are allowed'));
  }
}).single('file'); // Expect field name 'file'

router.post('/', protect, (req, res) => {
  console.log('🔍 Upload route hit');
  console.log('Headers:', req.headers['content-type']);

  upload(req, res, function (err) {
    if (err) {
      console.error('❌ Multer error:', err);
      return res.status(400).json({ message: err.message });
    }
    console.log('req.file after upload:', req.file); // Should show file details
    if (!req.file) {
      console.log('❌ req.file is undefined. Body fields:', req.body); // See if any fields arrived
      return res.status(400).json({
        message: 'No file uploaded',
        hint: 'Make sure the form field name is "file" and the file is not empty.'
      });
    }

    // File uploaded successfully
    try {
      const url = hasCloudinary ? req.file.path : `/uploads/${req.file.filename}`;
      console.log('✅ File uploaded:', url);
      res.json({
        url,
        originalName: req.file.originalname,
        storage: hasCloudinary ? 'cloudinary' : 'local'
      });
    } catch (error) {
      console.error('❌ Error after upload:', error);
      res.status(500).json({ message: error.message });
    }
  });
});

module.exports = router;