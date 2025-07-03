require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Import services
const BulkUploadService = require('../src/BulkUploadService');
const SchedulerService = require('../src/SchedulerService');
const QueueManager = require('../src/QueueManager');

// Import routes
const reelsRoutes = require('./routes/reels');
const schedulerRoutes = require('./routes/scheduler');

// Create Express app
const app = express();
const PORT = process.env.SERVER_PORT || 3000;

// Initialize services
const queueManager = new QueueManager();
const bulkUploadService = new BulkUploadService(queueManager);
const schedulerService = new SchedulerService(queueManager);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add services to request object
app.use((req, res, next) => {
  req.services = {
    queueManager,
    bulkUploadService,
    schedulerService
  };
  next();
});

// API Routes
app.use('/api/reels', reelsRoutes);
app.use('/api/scheduler', schedulerRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const schedulerStatus = await schedulerService.getStatus();
    const queueStats = await queueManager.getQueueStats();
    const uploadStats = await bulkUploadService.getUploadStats();

    res.json({
      scheduler: schedulerStatus,
      queue: queueStats,
      uploads: uploadStats,
      environment: {
        nodeVersion: process.version,
        timezone: process.env.TIMEZONE || 'UTC',
        uploadsPath: process.env.UPLOADS_PATH || './uploads',
        storagePath: process.env.STORAGE_PATH || './data'
      }
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({
      error: 'Failed to get status',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      message: `File size exceeds limit of ${process.env.MAX_FILE_SIZE || '100MB'}`
    });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Unexpected file field',
      message: 'Invalid file upload format'
    });
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await shutdown();
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await shutdown();
});

async function shutdown() {
  try {
    console.log('Closing services...');
    await schedulerService.close();
    bulkUploadService.close();
    queueManager.close();
    console.log('Services closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    // Load scheduler settings
    await schedulerService.loadSettings();
    
    // Start scheduler if it was previously running
    const schedulerStatus = await queueManager.dbManager.getSetting('scheduler_status');
    if (schedulerStatus === 'running') {
      await schedulerService.start();
    }

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Instagram Reels Automation API Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`📈 Status: http://localhost:${PORT}/api/status`);
      console.log(`📁 Uploads directory: ${process.env.UPLOADS_PATH || './uploads'}`);
      console.log(`💾 Data directory: ${process.env.STORAGE_PATH || './data'}`);
    });

    // Handle server errors
    server.on('error', (error) => {
      console.error('Server error:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;