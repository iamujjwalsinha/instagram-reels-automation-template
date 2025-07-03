const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

/**
 * Custom error classes for Instagram API operations
 */
class InstagramAPIError extends Error {
  constructor(message, statusCode, response) {
    super(message);
    this.name = 'InstagramAPIError';
    this.statusCode = statusCode;
    this.response = response;
    swqa1 
  }
}

class RateLimitError extends InstagramAPIError {
  constructor(message, retryAfter) {
    super(message, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

class VideoValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'VideoValidationError';
  }
}

/**
 * Instagram Reels Automation Class
 * Handles posting Instagram Reels using the Facebook Graph API
 */
class InstagramReelsAutomation {
  /**
   * @param {string} accessToken - Instagram access token
   * @param {string} instagramAccountId - Instagram account ID
   * @param {Object} options - Additional options
   * @param {number} options.maxRetries - Maximum number of retries for API calls
   * @param {number} options.retryDelay - Base delay for retries in milliseconds
   * @param {boolean} options.enableLogging - Enable detailed logging
   */
  constructor(accessToken, instagramAccountId, options = {}) {
    this.accessToken = accessToken;
    this.instagramAccountId = instagramAccountId;
    // Use graph.instagram.com for Instagram Login tokens
    this.baseUrl = 'https://graph.instagram.com/v18.0';
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.enableLogging = options.enableLogging !== false;

    // Validate required parameters
    if (!this.accessToken) {
      throw new Error('Instagram access token is required');
    }
    if (!this.instagramAccountId) {
      throw new Error('Instagram account ID is required');
    }

    this.log('InstagramReelsAutomation initialized', {
      accountId: this.instagramAccountId,
      baseUrl: this.baseUrl
    });
  }

  /**
   * Log messages if logging is enabled
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  log(message, data = {}) {
    if (this.enableLogging) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${message}`, data);
    }
  }

  /**
   * Make HTTP request with retry logic
   * @param {Object} config - Axios request config
   * @returns {Promise<Object>} Response data
   */
  async makeRequest(config, retryCount = 0) {
    try {
      this.log('Making API request', {
        method: config.method,
        url: config.url,
        retryCount
      });

      const response = await axios(config);
      
      this.log('API request successful', {
        status: response.status,
        url: config.url
      });

      return response.data;
    } catch (error) {
      this.log('API request failed', {
        status: error.response?.status,
        message: error.message,
        retryCount
      });

      // Handle rate limiting
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || 60;
        throw new RateLimitError(
          `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
          retryAfter
        );
      }

      // Retry on transient errors
      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        this.log(`Retrying in ${delay}ms...`);
        
        await this.sleep(delay);
        return this.makeRequest(config, retryCount + 1);
      }

      throw new InstagramAPIError(
        error.response?.data?.error?.message || error.message,
        error.response?.status,
        error.response?.data
      );
    }
  }

  /**
   * Check if an error is retryable
   * @param {Error} error - Error to check
   * @returns {boolean} Whether the error is retryable
   */
  isRetryableError(error) {
    const retryableStatuses = [500, 502, 503, 504];
    const retryableMessages = [
      'temporary',
      'timeout',
      'network',
      'connection'
    ];

    return (
      retryableStatuses.includes(error.response?.status) ||
      retryableMessages.some(msg => 
        error.message.toLowerCase().includes(msg)
      )
    );
  }

  /**
   * Sleep for a given number of milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate video file before upload
   * @param {string} filePath - Path to video file
   * @throws {VideoValidationError} If validation fails
   */
  validateVideoFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new VideoValidationError(`Video file not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    const maxSize = 100 * 1024 * 1024; // 100MB limit

    if (stats.size > maxSize) {
      throw new VideoValidationError(
        `Video file too large: ${(stats.size / 1024 / 1024).toFixed(2)}MB. Max size: 100MB`
      );
    }

    const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv'];
    const ext = path.extname(filePath).toLowerCase();
    
    if (!allowedExtensions.includes(ext)) {
      throw new VideoValidationError(
        `Unsupported video format: ${ext}. Supported formats: ${allowedExtensions.join(', ')}`
      );
    }

    this.log('Video file validation passed', {
      filePath,
      size: `${(stats.size / 1024 / 1024).toFixed(2)}MB`,
      extension: ext
    });
  }

  /**
   * Create a media container for a Reel
   * @param {string} videoUrl - Publicly accessible video URL
   * @param {string} caption - Reel caption
   * @param {Object} options - Additional options
   * @param {string} options.coverUrl - Custom cover image URL
   * @param {Array} options.userTags - Array of user tags
   * @param {boolean} options.shareToFeed - Whether to share to feed
   * @returns {Promise<string>} Creation ID
   */
  async createReelContainer(videoUrl, caption, options = {}) {
    const {
      coverUrl = null,
      userTags = [],
      shareToFeed = true
    } = options;

    this.log('Creating Reel container', {
      videoUrl,
      captionLength: caption?.length,
      coverUrl,
      userTagsCount: userTags.length,
      shareToFeed
    });

    // Prepare data as per Instagram Graph API
    const data = {
      media_type: 'REELS',
      video_url: videoUrl,
      caption: caption,
      share_to_feed: shareToFeed
    };

    if (coverUrl) {
      data.cover_url = coverUrl;
    }

    if (userTags.length > 0) {
      // Instagram Graph API expects user_tags as a JSON-encoded string
      data.user_tags = JSON.stringify(userTags);
    }

    const response = await this.makeRequest({
      method: 'POST',
      url: `${this.baseUrl}/${this.instagramAccountId}/media`,
      params: {
        access_token: this.accessToken
      },
      data
    });

    this.log('Reel container created', {
      creationId: response.id
    });

    return response.id;
  }

  /**
   * Check the status of a media container
   * @param {string} creationId - Creation ID to check
   * @returns {Promise<Object>} Container status information
   */
  async getContainerStatus(creationId) {
    this.log('Checking container status', { creationId });

    const response = await this.makeRequest({
      method: 'GET',
      url: `${this.baseUrl}/${creationId}`,
      params: {
        access_token: this.accessToken,
        fields: 'status_code'
      }
    });

    this.log('Container status retrieved', {
      creationId,
      status: response.status_code
    });

    return {
      status: response.status_code,
      message: response.status_code === 'FINISHED' ? 'Ready to publish' : 'Processing'
    };
  }

  /**
   * Wait for container to finish processing with exponential backoff
   * @param {string} creationId - Creation ID to monitor
   * @param {number} maxWaitTime - Maximum wait time in milliseconds
   * @returns {Promise<void>}
   */
  async waitForContainerProcessing(creationId, maxWaitTime = 300000) { // 5 minutes
    const startTime = Date.now();
    let delay = 2000; // Start with 2 seconds

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getContainerStatus(creationId);

      if (status.status === 'FINISHED') {
        this.log('Container processing finished', { creationId });
        return;
      }

      if (status.status === 'ERROR') {
        throw new InstagramAPIError(
          `Container processing failed: ${status.message}`,
          400
        );
      }

      if (status.status === 'EXPIRED') {
        throw new InstagramAPIError(
          'Container processing expired',
          400
        );
      }

      this.log('Container still processing', {
        creationId,
        status: status.status,
        waiting: `${delay}ms`
      });

      await this.sleep(delay);
      delay = Math.min(delay * 1.5, 30000); // Cap at 30 seconds
    }

    throw new InstagramAPIError(
      'Container processing timeout',
      408
    );
  }

  /**
   * Publish a Reel from a creation ID
   * @param {string} creationId - Creation ID to publish
   * @returns {Promise<string>} Published media ID
   */
  async publishReel(creationId) {
    this.log('Publishing Reel', { creationId });

    // Wait for container to finish processing
    await this.waitForContainerProcessing(creationId);

    const response = await this.makeRequest({
      method: 'POST',
      url: `${this.baseUrl}/${this.instagramAccountId}/media_publish`,
      params: {
        access_token: this.accessToken
      },
      data: {
        creation_id: creationId
      }
    });

    this.log('Reel published successfully', {
      creationId,
      mediaId: response.id
    });

    return response.id;
  }

  /**
   * Post a Reel from a publicly accessible URL
   * @param {string} videoUrl - Publicly accessible video URL
   * @param {string} caption - Reel caption
   * @param {Object} options - Additional options
   * @param {boolean} options.shareToFeed - Whether to share to feed
   * @param {string} options.coverUrl - Custom cover image URL
   * @param {Array} options.userTags - Array of user tags
   * @returns {Promise<string>} Published media ID
   */
  async postReelFromUrl(videoUrl, caption, options = {}) {
    this.log('Posting Reel from URL', {
      videoUrl,
      captionLength: caption?.length
    });

    const creationId = await this.createReelContainer(videoUrl, caption, options);
    const mediaId = await this.publishReel(creationId);

    this.log('Reel posted successfully from URL', {
      videoUrl,
      mediaId
    });

    return mediaId;
  }

  /**
   * Upload a video file to Instagram (simplified implementation)
   * Note: Instagram's file upload API is complex and may require additional setup
   * @param {string} filePath - Path to video file
   * @returns {Promise<string>} Uploaded video URL
   */
  async uploadVideoFile(filePath) {
    this.log('Uploading video file', { filePath });

    // Validate file first
    this.validateVideoFile(filePath);

    // For this implementation, we'll use a simplified approach
    // In production, you might need to implement the full Instagram upload flow
    // which involves multiple steps and session management
    
    const formData = new FormData();
    formData.append('source', fs.createReadStream(filePath));
    formData.append('access_token', this.accessToken);

    const response = await this.makeRequest({
      method: 'POST',
      url: `${this.baseUrl}/${this.instagramAccountId}/media`,
      data: formData,
      headers: {
        ...formData.getHeaders()
      }
    });

    this.log('Video file uploaded', {
      filePath,
      uploadId: response.id
    });

    // Note: This is a simplified implementation
    // The actual Instagram upload process is more complex
    return response.id;
  }

  /**
   * Post a Reel from a local video file
   * @param {string} videoFilePath - Path to local video file
   * @param {string} caption - Reel caption
   * @param {Object} options - Additional options
   * @param {boolean} options.shareToFeed - Whether to share to feed
   * @param {string} options.coverUrl - Custom cover image URL
   * @param {Array} options.userTags - Array of user tags
   * @returns {Promise<string>} Published media ID
   */
  async postReelFromFile(videoFilePath, caption, options = {}) {
    this.log('Posting Reel from file', {
      videoFilePath,
      captionLength: caption?.length
    });

    // Upload the video file first
    const uploadId = await this.uploadVideoFile(videoFilePath);

    // Create container with the uploaded video
    const creationId = await this.createReelContainer(
      `https://graph.facebook.com/v18.0/${uploadId}`,
      caption,
      options
    );

    // Publish the Reel
    const mediaId = await this.publishReel(creationId);

    this.log('Reel posted successfully from file', {
      videoFilePath,
      mediaId
    });

    return mediaId;
  }

  /**
   * Get information about a published media
   * @param {string} mediaId - Media ID to get info for
   * @returns {Promise<Object>} Media information
   */
  async getMediaInfo(mediaId) {
    this.log('Getting media info', { mediaId });

    const response = await this.makeRequest({
      method: 'GET',
      url: `${this.baseUrl}/${mediaId}`,
      params: {
        access_token: this.accessToken,
        fields: 'id,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,caption'
      }
    });

    this.log('Media info retrieved', {
      mediaId,
      mediaType: response.media_type,
      permalink: response.permalink
    });

    return response;
  }

  /**
   * Delete a published media
   * @param {string} mediaId - Media ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteMedia(mediaId) {
    this.log('Deleting media', { mediaId });

    await this.makeRequest({
      method: 'DELETE',
      url: `${this.baseUrl}/${mediaId}`,
      params: {
        access_token: this.accessToken
      }
    });

    this.log('Media deleted successfully', { mediaId });
    return true;
  }
}

/**
 * InstagramReelsAutomation
 *
 * Usage:
 *   const { InstagramReelsAutomation } = require('./src/InstagramReelsAutomation');
 *   const instagram = new InstagramReelsAutomation(
 *     process.env.INSTAGRAM_ACCESS_TOKEN,
 *     process.env.INSTAGRAM_ACCOUNT_ID,
 *     { enableLogging: true }
 *   );
 *
 *   // Post a Reel from a public video URL
 *   await instagram.postReelFromUrl('https://example.com/video.mp4', 'My caption!');
 *
 * All credentials should be provided via environment variables. See README.md for details.
 */

module.exports = {
  InstagramReelsAutomation,
  InstagramAPIError,
  RateLimitError,
  VideoValidationError
}; 