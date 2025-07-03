const express = require('express');
const { createUploadMiddleware, uploadErrorHandler } = require('../middleware/upload');
const router = express.Router();

// Configure upload middleware
const uploadMiddleware = createUploadMiddleware(
  process.env.UPLOADS_PATH || './uploads',
  {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedExtensions: ['.mp4', '.mov', '.avi'],
    maxFiles: 100
  }
);

/**
 * POST /api/reels/bulk-upload
 * Bulk upload multiple reels with metadata
 */
router.post('/bulk-upload', uploadMiddleware.array('videos', 100), uploadErrorHandler, async (req, res) => {
  try {
    const { bulkUploadService } = req.services;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: 'No files provided',
        message: 'Please upload at least one video file'
      });
    }

    // Parse metadata
    const metadata = bulkUploadService.parseMetadata(req);
    
    // Process bulk upload
    const result = await bulkUploadService.processBulkUpload(req.files, metadata);
    
    res.json({
      message: 'Bulk upload completed',
      ...result
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({
      error: 'Bulk upload failed',
      message: error.message
    });
  }
});

/**
 * POST /api/reels/upload
 * Upload single reel
 */
router.post('/upload', uploadMiddleware.single('video'), uploadErrorHandler, async (req, res) => {
  try {
    const { bulkUploadService } = req.services;
    
    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided',
        message: 'Please upload a video file'
      });
    }

    // Parse metadata
    const metadata = {
      caption: req.body.caption || '',
      tags: req.body.tags ? req.body.tags.split(',') : [],
      coverUrl: req.body.coverUrl || null,
      userTags: req.body.userTags ? JSON.parse(req.body.userTags) : [],
      shareToFeed: req.body.shareToFeed !== 'false',
      scheduledTime: req.body.scheduledTime || null
    };
    
    // Process single upload
    const result = await bulkUploadService.processSingleUpload(req.file, metadata);
    
    res.json({
      message: 'Upload successful',
      ...result
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
});

/**
 * GET /api/reels/queue
 * Get current queue status
 */
router.get('/queue', async (req, res) => {
  try {
    const { queueManager } = req.services;
    const queue = await queueManager.getQueueStatus();
    const stats = await queueManager.getQueueStats();
    
    res.json({
      queue: queue,
      stats: stats
    });

  } catch (error) {
    console.error('Queue status error:', error);
    res.status(500).json({
      error: 'Failed to get queue status',
      message: error.message
    });
  }
});

/**
 * GET /api/reels/status
 * Get publishing status and history
 */
router.get('/status', async (req, res) => {
  try {
    const { queueManager } = req.services;
    const limit = parseInt(req.query.limit) || 50;
    
    const history = await queueManager.getPublishHistory(limit);
    const stats = await queueManager.getQueueStats();
    
    res.json({
      history: history,
      stats: stats
    });

  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({
      error: 'Failed to get status',
      message: error.message
    });
  }
});

/**
 * GET /api/reels/:id
 * Get specific reel details
 */
router.get('/:id', async (req, res) => {
  try {
    const { queueManager } = req.services;
    const { id } = req.params;
    
    let reel;
    
    // Check if ID is a number (database ID) or UUID
    if (/^\d+$/.test(id)) {
      reel = await queueManager.getReelById(parseInt(id));
    } else {
      reel = await queueManager.getReelByUuid(id);
    }
    
    if (!reel) {
      return res.status(404).json({
        error: 'Reel not found',
        message: `Reel with ID ${id} not found`
      });
    }
    
    res.json(reel);

  } catch (error) {
    console.error('Get reel error:', error);
    res.status(500).json({
      error: 'Failed to get reel',
      message: error.message
    });
  }
});

/**
 * DELETE /api/reels/:id
 * Remove reel from queue
 */
router.delete('/:id', async (req, res) => {
  try {
    const { queueManager } = req.services;
    const { id } = req.params;
    
    let reelId;
    
    // Check if ID is a number (database ID) or UUID
    if (/^\d+$/.test(id)) {
      reelId = parseInt(id);
    } else {
      const reel = await queueManager.getReelByUuid(id);
      if (!reel) {
        return res.status(404).json({
          error: 'Reel not found',
          message: `Reel with ID ${id} not found`
        });
      }
      reelId = reel.id;
    }
    
    await queueManager.deleteReel(reelId);
    
    res.json({
      message: 'Reel deleted successfully',
      id: reelId
    });

  } catch (error) {
    console.error('Delete reel error:', error);
    res.status(500).json({
      error: 'Failed to delete reel',
      message: error.message
    });
  }
});

/**
 * PUT /api/reels/:id/status
 * Update reel status
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { queueManager } = req.services;
    const { id } = req.params;
    const { status, error: errorMessage } = req.body;
    
    if (!status) {
      return res.status(400).json({
        error: 'Status required',
        message: 'Please provide a status value'
      });
    }
    
    let reelId;
    
    // Check if ID is a number (database ID) or UUID
    if (/^\d+$/.test(id)) {
      reelId = parseInt(id);
    } else {
      const reel = await queueManager.getReelByUuid(id);
      if (!reel) {
        return res.status(404).json({
          error: 'Reel not found',
          message: `Reel with ID ${id} not found`
        });
      }
      reelId = reel.id;
    }
    
    await queueManager.updateReelStatus(reelId, status, errorMessage);
    
    res.json({
      message: 'Reel status updated successfully',
      id: reelId,
      status: status
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      error: 'Failed to update reel status',
      message: error.message
    });
  }
});

/**
 * POST /api/reels/queue/clear-failed
 * Clear failed reels from queue
 */
router.post('/queue/clear-failed', async (req, res) => {
  try {
    const { queueManager } = req.services;
    const clearedCount = await queueManager.clearFailedReels();
    
    res.json({
      message: 'Failed reels cleared successfully',
      clearedCount: clearedCount
    });

  } catch (error) {
    console.error('Clear failed reels error:', error);
    res.status(500).json({
      error: 'Failed to clear failed reels',
      message: error.message
    });
  }
});

/**
 * GET /api/reels/uploads/stats
 * Get upload statistics
 */
router.get('/uploads/stats', async (req, res) => {
  try {
    const { bulkUploadService } = req.services;
    const stats = await bulkUploadService.getUploadStats();
    
    res.json(stats);

  } catch (error) {
    console.error('Upload stats error:', error);
    res.status(500).json({
      error: 'Failed to get upload statistics',
      message: error.message
    });
  }
});

/**
 * POST /api/reels/uploads/cleanup
 * Clean up old uploaded files
 */
router.post('/uploads/cleanup', async (req, res) => {
  try {
    const { bulkUploadService } = req.services;
    const maxAge = req.body.maxAge || 7 * 24 * 60 * 60 * 1000; // 7 days
    
    const deletedCount = await bulkUploadService.cleanupOldFiles(maxAge);
    
    res.json({
      message: 'Cleanup completed successfully',
      deletedCount: deletedCount
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      error: 'Failed to cleanup files',
      message: error.message
    });
  }
});

module.exports = router;