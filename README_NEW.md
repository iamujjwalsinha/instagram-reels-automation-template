# Instagram Reels Automation Template

[![Use this template](https://img.shields.io/badge/GitHub--Template-blue?logo=github)](https://github.com/iamujjwalsinha/instagram-reels-automation-template/generate)
[![npm version](https://img.shields.io/npm/v/instagram-reels-automation-template?color=green&logo=npm)](https://www.npmjs.com/package/instagram-reels-automation-template)

> **This repository can be used as a [GitHub template](https://github.com/iamujjwalsinha/instagram-reels-automation-template/generate) for quickly starting your own Instagram Reels automation project.**

## 🚀 New Features - Bulk Upload & Scheduling System

This template now includes a comprehensive **bulk upload and scheduling system** with the following features:

### ✨ Features
- 🎬 **Bulk Upload**: Upload 100+ reels with captions and tags in advance
- ⏰ **Daily Scheduling**: Automatically publish one reel per day at specified times
- 📊 **Queue Management**: Maintain a FIFO queue of pending reels to be published
- ⚙️ **Scheduling Configuration**: Set preferred posting times and timezone
- 💾 **Persistent Storage**: SQLite database for reel metadata and queue state
- 📈 **Status Tracking**: Track published, pending, and failed reels
- 🔄 **Error Handling**: Robust retry logic with failure notifications
- 📝 **Comprehensive Logging**: Monitor and debug publishing activities
- 🌐 **REST API**: Complete API for managing uploads and scheduling
- 🔧 **Background Tasks**: Automated cron jobs for scheduled posting

### 🏗️ Architecture

```
├── src/
│   ├── InstagramReelsAutomation.js  # Core automation class
│   ├── SchedulerService.js           # Daily scheduling service
│   ├── QueueManager.js               # Queue management
│   ├── BulkUploadService.js          # Bulk upload handling
│   └── DatabaseManager.js            # Data persistence
├── api/
│   ├── server.js                     # Express server
│   ├── routes/
│   │   ├── reels.js                  # Reel management routes
│   │   └── scheduler.js              # Scheduling routes
│   └── middleware/
│       └── upload.js                 # File upload middleware
├── uploads/                          # Video file storage
├── data/                             # Database/JSON storage
└── test-services.js                  # Service validation
```

## 📋 Table of Contents

- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [API Documentation](#api-documentation)
- [Usage Examples](#usage-examples)
- [Bulk Upload & Scheduling](#bulk-upload--scheduling)
- [CLI Tools](#cli-tools)
- [Error Handling](#error-handling)
- [Contributing](#contributing)

## 🛠️ Installation

### Prerequisites
- Node.js 16.0.0 or higher
- Instagram Business Account
- Facebook App with Instagram Graph API access

### Quick Start

1. **Clone or use this template:**
   ```bash
   git clone https://github.com/iamujjwalsinha/instagram-reels-automation-template.git
   cd instagram-reels-automation-template
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp env.example .env
   # Edit .env with your credentials
   ```

4. **Test the services:**
   ```bash
   node test-services.js
   ```

5. **Start the server:**
   ```bash
   npm start
   ```

## ⚙️ Environment Setup

Create a `.env` file with the following variables:

```env
# Instagram Graph API Configuration
INSTAGRAM_ACCESS_TOKEN=your_access_token_here
INSTAGRAM_ACCOUNT_ID=your_instagram_account_id_here

# Optional: Facebook App Configuration
FACEBOOK_APP_ID=your_facebook_app_id_here
FACEBOOK_APP_SECRET=your_facebook_app_secret_here

# Scheduling Configuration
POSTING_TIME=10:00
TIMEZONE=America/New_York
STORAGE_PATH=./data
UPLOADS_PATH=./uploads
SERVER_PORT=3000

# Queue Management
MAX_QUEUE_SIZE=1000
RETRY_ATTEMPTS=3
RETRY_DELAY=5000

# File Upload Limits
MAX_FILE_SIZE=100MB
ALLOWED_EXTENSIONS=.mp4,.mov,.avi

# Optional: Logging Configuration
LOG_LEVEL=info
```

## 🌐 API Documentation

### Health & Status Endpoints

#### GET /health
Check if the server is running.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T10:00:00.000Z",
  "version": "1.0.0"
}
```

#### GET /api/status
Get comprehensive system status.

**Response:**
```json
{
  "scheduler": {
    "isRunning": false,
    "postingTime": "10:00",
    "timezone": "America/New_York",
    "queueStats": {...}
  },
  "queue": {...},
  "uploads": {...},
  "environment": {...}
}
```

### Reel Management Endpoints

#### POST /api/reels/bulk-upload
Upload multiple reels with metadata.

**Request:**
```bash
curl -X POST http://localhost:3000/api/reels/bulk-upload \
  -F "videos=@video1.mp4" \
  -F "videos=@video2.mp4" \
  -F "metadata=[{\"caption\":\"First reel\",\"tags\":[\"tag1\",\"tag2\"]},{\"caption\":\"Second reel\",\"tags\":[\"tag3\"]}]"
```

**Response:**
```json
{
  "message": "Bulk upload completed",
  "successful": [...],
  "errors": [...],
  "total": 2,
  "successCount": 2,
  "errorCount": 0
}
```

#### POST /api/reels/upload
Upload a single reel.

**Request:**
```bash
curl -X POST http://localhost:3000/api/reels/upload \
  -F "video=@video.mp4" \
  -F "caption=My awesome reel!" \
  -F "tags=tag1,tag2,tag3"
```

#### GET /api/reels/queue
Get current queue status.

#### GET /api/reels/status
Get publishing status and history.

#### GET /api/reels/:id
Get specific reel details by ID or UUID.

#### DELETE /api/reels/:id
Remove reel from queue.

### Scheduler Endpoints

#### GET /api/scheduler/status
Get scheduler status.

#### POST /api/scheduler/start
Start the scheduler.

#### POST /api/scheduler/stop
Stop the scheduler.

#### POST /api/scheduler/schedule
Configure scheduling settings.

**Request:**
```bash
curl -X POST http://localhost:3000/api/scheduler/schedule \
  -H "Content-Type: application/json" \
  -d '{"postingTime": "14:30", "timezone": "UTC"}'
```

#### POST /api/scheduler/trigger
Manually trigger publishing.

## 📝 Usage Examples

### Basic Single Reel Upload

```javascript
const { InstagramReelsAutomation } = require('./src/InstagramReelsAutomation');

const instagram = new InstagramReelsAutomation(
  process.env.INSTAGRAM_ACCESS_TOKEN,
  process.env.INSTAGRAM_ACCOUNT_ID
);

await instagram.postReelFromUrl(
  'https://example.com/video.mp4',
  'Check out this amazing content! 🎬 #reels #instagram'
);
```

### Bulk Upload with API

```bash
# Upload multiple videos
curl -X POST http://localhost:3000/api/reels/bulk-upload \
  -F "videos=@video1.mp4" \
  -F "videos=@video2.mp4" \
  -F "videos=@video3.mp4" \
  -F "metadata=[
    {\"caption\":\"First video\",\"tags\":[\"first\",\"video\"]},
    {\"caption\":\"Second video\",\"tags\":[\"second\",\"video\"]},
    {\"caption\":\"Third video\",\"tags\":[\"third\",\"video\"]}
  ]"
```

### Schedule Configuration

```bash
# Set posting time to 2:30 PM UTC
curl -X POST http://localhost:3000/api/scheduler/schedule \
  -H "Content-Type: application/json" \
  -d '{"postingTime": "14:30", "timezone": "UTC"}'

# Start the scheduler
curl -X POST http://localhost:3000/api/scheduler/start
```

## 🔄 Bulk Upload & Scheduling

### Queue Management
The system maintains a FIFO (First-In-First-Out) queue of reels to be published:

1. **Upload** reels using the bulk upload API
2. **Configure** posting schedule (time and timezone)
3. **Start** the scheduler to begin automatic publishing
4. **Monitor** queue status and publishing history

### Scheduling Features
- **Daily Publishing**: Publishes one reel per day at specified time
- **Timezone Support**: Configure posting time in any timezone
- **Retry Logic**: Automatically retries failed posts
- **Error Handling**: Tracks and reports publishing errors
- **Manual Trigger**: Manually trigger publishing outside schedule

### File Management
- **Organized Storage**: Uploaded files stored in `./uploads/` directory
- **Auto Cleanup**: Automatically removes published files
- **File Validation**: Validates file type, size, and format
- **Unique Naming**: Uses UUID for unique file naming

## 🔧 CLI Tools

### Test Services
```bash
node test-services.js
```

### Start Server
```bash
# Production mode
npm start

# Development mode with auto-reload
npm run dev
```

### Original Single Post
```bash
# Test single reel posting
npm run post
```

## 🛡️ Error Handling

The system includes comprehensive error handling:

- **Rate Limiting**: Automatic retry with exponential backoff
- **File Validation**: Validates video format, size, and accessibility
- **Network Errors**: Handles network timeouts and connection issues
- **Queue Recovery**: Recovers from interruptions and resumes processing
- **Logging**: Detailed logging for monitoring and debugging

### Error Types
- `InstagramAPIError`: Instagram API related errors
- `RateLimitError`: Rate limiting errors with retry information
- `VideoValidationError`: Video file validation errors
- `QueueError`: Queue management errors
- `UploadError`: File upload errors

## 📊 Monitoring & Logging

### Log Levels
- **Info**: General information and successful operations
- **Warning**: Recoverable errors and warnings
- **Error**: Critical errors requiring attention
- **Debug**: Detailed debugging information

### Monitoring Endpoints
- `GET /health`: Server health check
- `GET /api/status`: Comprehensive system status
- `GET /api/reels/queue`: Current queue status
- `GET /api/scheduler/status`: Scheduler status
- `GET /api/reels/uploads/stats`: Upload statistics

## 🔐 Security Considerations

- **Environment Variables**: All sensitive data in environment variables
- **File Validation**: Strict file type and size validation
- **Error Handling**: Secure error messages without exposing internals
- **CORS**: Configurable CORS for API access control
- **Rate Limiting**: Built-in rate limiting for API endpoints

## 🚀 Deployment

### Production Deployment
```bash
# Set NODE_ENV to production
export NODE_ENV=production

# Start with PM2 for process management
npm install -g pm2
pm2 start api/server.js --name instagram-reels-automation

# Or use Docker (create your own Dockerfile)
# docker build -t instagram-reels-automation .
# docker run -p 3000:3000 instagram-reels-automation
```

### Environment Variables for Production
```env
NODE_ENV=production
INSTAGRAM_ACCESS_TOKEN=your_production_token
INSTAGRAM_ACCOUNT_ID=your_production_account_id
POSTING_TIME=10:00
TIMEZONE=America/New_York
SERVER_PORT=3000
```

## 📚 API Reference

### Complete API Documentation

For detailed API documentation with request/response examples, visit:
- OpenAPI/Swagger documentation (can be added)
- Postman collection (can be provided)

### Core Classes

#### `InstagramReelsAutomation`
Main class for Instagram API interactions.

#### `SchedulerService`
Handles automated publishing scheduling.

#### `QueueManager`
Manages the reel publishing queue.

#### `BulkUploadService`
Handles bulk file uploads and processing.

#### `DatabaseManager`
Manages SQLite database operations.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

- 📧 Email: serverlessway@gmail.com
- 🐛 Issues: [GitHub Issues](https://github.com/iamujjwalsinha/instagram-reels-automation-template/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/iamujjwalsinha/instagram-reels-automation-template/discussions)

## 📚 Resources

- [Instagram Graph API Documentation](https://developers.facebook.com/docs/instagram-api/)
- [Meta for Developers](https://developers.facebook.com/)
- [Instagram Content Publishing](https://developers.facebook.com/docs/instagram-api/guides/content-publishing/)

---

**⭐ If this template helps you, please consider giving it a star!**