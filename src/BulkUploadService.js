const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const QueueManager = require('./QueueManager');

/**
 * Bulk Upload Service for handling multiple reel uploads
 */
class BulkUploadService {
  constructor(queueManager = null) {
    this.queueManager = queueManager || new QueueManager();
    this.uploadsPath = process.env.UPLOADS_PATH || './uploads';
    this.maxFileSize = this.parseFileSize(process.env.MAX_FILE_SIZE || '100MB');
    this.allowedExtensions = (process.env.ALLOWED_EXTENSIONS || '.mp4,.mov,.avi').split(',');
    
    // Ensure uploads directory exists
    this.ensureUploadsDirectory();
    
    // Configure multer for file uploads
    this.storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.uploadsPath);
      },
      filename: (req, file, cb) => {
        const uuid = uuidv4();
        const ext = path.extname(file.originalname);
        const filename = `${uuid}${ext}`;
        cb(null, filename);
      }
    });

    this.upload = multer({
      storage: this.storage,
      limits: {
        fileSize: this.maxFileSize,
        files: 100 // Maximum 100 files per batch
      },
      fileFilter: (req, file, cb) => {
        this.fileFilter(file, cb);
      }
    });
  }

  /**
   * Parse file size string to bytes
   */
  parseFileSize(sizeStr) {
    const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
    const match = sizeStr.match(/^(\d+)(\w+)$/);
    
    if (!match) {
      throw new Error('Invalid file size format');
    }
    
    const [, size, unit] = match;
    return parseInt(size) * (units[unit.toUpperCase()] || 1);
  }

  /**
   * Ensure uploads directory exists
   */
  ensureUploadsDirectory() {
    if (!fs.existsSync(this.uploadsPath)) {
      fs.mkdirSync(this.uploadsPath, { recursive: true });
      console.log(`Created uploads directory: ${this.uploadsPath}`);
    }
  }

  /**
   * File filter for multer
   */
  fileFilter(file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (!this.allowedExtensions.includes(ext)) {
      return cb(new Error(`File type not allowed. Allowed types: ${this.allowedExtensions.join(', ')}`));
    }
    
    // Check if it's a video file
    if (!file.mimetype.startsWith('video/')) {
      return cb(new Error('Only video files are allowed'));
    }
    
    cb(null, true);
  }

  /**
   * Get multer upload middleware
   */
  getUploadMiddleware() {
    return this.upload.array('videos', 100);
  }

  /**
   * Process bulk upload
   */
  async processBulkUpload(files, metadata) {
    const results = [];
    const errors = [];

    try {
      console.log(`Processing bulk upload of ${files.length} files`);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileMetadata = metadata[i] || {};

        try {
          // Validate file
          await this.validateVideoFile(file.path);

          // Prepare reel data
          const reelData = {
            uuid: uuidv4(),
            filename: file.filename,
            filepath: file.path,
            originalName: file.originalname,
            caption: fileMetadata.caption || '',
            tags: fileMetadata.tags || [],
            coverUrl: fileMetadata.coverUrl || null,
            userTags: fileMetadata.userTags || [],
            shareToFeed: fileMetadata.shareToFeed !== false,
            scheduledTime: fileMetadata.scheduledTime || null
          };

          // Add to queue
          const queueResult = await this.queueManager.addToQueue(reelData);
          
          results.push({
            success: true,
            filename: file.originalname,
            uuid: reelData.uuid,
            queuePosition: queueResult.position,
            message: 'Successfully added to queue'
          });

        } catch (error) {
          console.error(`Error processing file ${file.originalname}:`, error);
          
          // Clean up file if there was an error
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }

          errors.push({
            success: false,
            filename: file.originalname,
            error: error.message
          });
        }
      }

      console.log(`Bulk upload completed: ${results.length} successful, ${errors.length} errors`);

      return {
        successful: results,
        errors: errors,
        total: files.length,
        successCount: results.length,
        errorCount: errors.length
      };

    } catch (error) {
      console.error('Bulk upload processing error:', error);
      throw error;
    }
  }

  /**
   * Validate video file
   */
  async validateVideoFile(filePath) {
    return new Promise((resolve, reject) => {
      try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
          return reject(new Error('File not found'));
        }

        // Check file size
        const stats = fs.statSync(filePath);
        if (stats.size > this.maxFileSize) {
          return reject(new Error(`File too large. Maximum size: ${this.maxFileSize / (1024 * 1024)}MB`));
        }

        // Check file extension
        const ext = path.extname(filePath).toLowerCase();
        if (!this.allowedExtensions.includes(ext)) {
          return reject(new Error(`Invalid file type. Allowed: ${this.allowedExtensions.join(', ')}`));
        }

        // Basic validation passed
        resolve(true);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Process single file upload
   */
  async processSingleUpload(file, metadata) {
    try {
      // Validate file
      await this.validateVideoFile(file.path);

      // Prepare reel data
      const reelData = {
        uuid: uuidv4(),
        filename: file.filename,
        filepath: file.path,
        originalName: file.originalname,
        caption: metadata.caption || '',
        tags: metadata.tags || [],
        coverUrl: metadata.coverUrl || null,
        userTags: metadata.userTags || [],
        shareToFeed: metadata.shareToFeed !== false,
        scheduledTime: metadata.scheduledTime || null
      };

      // Add to queue
      const queueResult = await this.queueManager.addToQueue(reelData);
      
      return {
        success: true,
        filename: file.originalname,
        uuid: reelData.uuid,
        queuePosition: queueResult.position,
        message: 'Successfully added to queue'
      };

    } catch (error) {
      console.error(`Error processing single file ${file.originalname}:`, error);
      
      // Clean up file if there was an error
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      throw error;
    }
  }

  /**
   * Parse metadata from request
   */
  parseMetadata(req) {
    try {
      const metadata = [];
      
      // Handle different metadata formats
      if (req.body.metadata) {
        if (typeof req.body.metadata === 'string') {
          // Single JSON string
          const parsed = JSON.parse(req.body.metadata);
          metadata.push(parsed);
        } else if (Array.isArray(req.body.metadata)) {
          // Array of metadata objects
          metadata.push(...req.body.metadata);
        } else {
          // Single object
          metadata.push(req.body.metadata);
        }
      }

      // If no metadata provided, create empty objects for each file
      const fileCount = req.files ? req.files.length : 1;
      while (metadata.length < fileCount) {
        metadata.push({
          caption: req.body.caption || '',
          tags: req.body.tags ? req.body.tags.split(',') : [],
          shareToFeed: req.body.shareToFeed !== 'false'
        });
      }

      return metadata;
    } catch (error) {
      console.error('Error parsing metadata:', error);
      throw new Error('Invalid metadata format');
    }
  }

  /**
   * Get upload statistics
   */
  async getUploadStats() {
    try {
      const stats = await this.queueManager.getQueueStats();
      
      // Get directory size
      const directorySize = this.getDirectorySize(this.uploadsPath);
      
      return {
        ...stats,
        uploadsDirectory: this.uploadsPath,
        directorySize: directorySize,
        directorySizeFormatted: this.formatBytes(directorySize),
        maxFileSize: this.maxFileSize,
        maxFileSizeFormatted: this.formatBytes(this.maxFileSize),
        allowedExtensions: this.allowedExtensions
      };
    } catch (error) {
      console.error('Error getting upload stats:', error);
      throw error;
    }
  }

  /**
   * Get directory size
   */
  getDirectorySize(dirPath) {
    if (!fs.existsSync(dirPath)) return 0;
    
    let size = 0;
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      size += stats.size;
    }
    
    return size;
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Clean up old files
   */
  async cleanupOldFiles(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days
    try {
      const files = fs.readdirSync(this.uploadsPath);
      const now = Date.now();
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(this.uploadsPath, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`Deleted old file: ${file}`);
        }
      }
      
      console.log(`Cleanup completed: ${deletedCount} old files deleted`);
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old files:', error);
      throw error;
    }
  }

  /**
   * Close service
   */
  close() {
    if (this.queueManager) {
      this.queueManager.close();
    }
  }
}

module.exports = BulkUploadService;