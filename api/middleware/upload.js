const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * File upload middleware configuration
 */
const createUploadMiddleware = (uploadPath, options = {}) => {
  const {
    maxFileSize = 100 * 1024 * 1024, // 100MB
    allowedExtensions = ['.mp4', '.mov', '.avi'],
    maxFiles = 100
  } = options;

  // Configure storage
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uuid = uuidv4();
      const ext = path.extname(file.originalname);
      const filename = `${uuid}${ext}`;
      cb(null, filename);
    }
  });

  // File filter
  const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error(`File type not allowed. Allowed types: ${allowedExtensions.join(', ')}`));
    }
    
    if (!file.mimetype.startsWith('video/')) {
      return cb(new Error('Only video files are allowed'));
    }
    
    cb(null, true);
  };

  // Create multer instance
  const upload = multer({
    storage,
    limits: {
      fileSize: maxFileSize,
      files: maxFiles
    },
    fileFilter
  });

  return upload;
};

/**
 * Error handling middleware for upload errors
 */
const uploadErrorHandler = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          error: 'File too large',
          message: `File size exceeds limit of ${process.env.MAX_FILE_SIZE || '100MB'}`
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          error: 'Too many files',
          message: 'Maximum 100 files allowed per upload'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          error: 'Unexpected file field',
          message: 'Invalid file upload format'
        });
      default:
        return res.status(400).json({
          error: 'Upload error',
          message: error.message
        });
    }
  }
  
  if (error.message.includes('File type not allowed')) {
    return res.status(400).json({
      error: 'Invalid file type',
      message: error.message
    });
  }
  
  next(error);
};

module.exports = {
  createUploadMiddleware,
  uploadErrorHandler
};