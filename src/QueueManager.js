const { v4: uuidv4 } = require('uuid');
const DatabaseManager = require('./DatabaseManager');

/**
 * Queue Manager for handling reel publishing queue operations
 */
class QueueManager {
  constructor(dbManager = null) {
    this.dbManager = dbManager || new DatabaseManager();
    this.maxQueueSize = process.env.MAX_QUEUE_SIZE || 1000;
  }

  /**
   * Add reel to queue
   */
  async addToQueue(reelData) {
    try {
      // Check queue size
      const currentQueue = await this.getQueueStatus();
      if (currentQueue.length >= this.maxQueueSize) {
        throw new Error(`Queue is full. Maximum size is ${this.maxQueueSize}`);
      }

      // Generate UUID if not provided
      if (!reelData.uuid) {
        reelData.uuid = uuidv4();
      }

      // Add reel to database
      const reelId = await this.dbManager.addReel(reelData);
      
      // Add to queue
      await this.dbManager.addToQueue(reelId);

      console.log(`Reel ${reelData.uuid} added to queue at position ${currentQueue.length + 1}`);
      
      return {
        reelId,
        uuid: reelData.uuid,
        position: currentQueue.length + 1,
        status: 'pending'
      };
    } catch (error) {
      console.error('Error adding reel to queue:', error);
      throw error;
    }
  }

  /**
   * Get next reel in queue
   */
  async getNextInQueue() {
    try {
      const reel = await this.dbManager.getNextInQueue();
      return reel;
    } catch (error) {
      console.error('Error getting next reel from queue:', error);
      throw error;
    }
  }

  /**
   * Get queue status
   */
  async getQueueStatus() {
    try {
      const queue = await this.dbManager.getQueueStatus();
      return queue;
    } catch (error) {
      console.error('Error getting queue status:', error);
      throw error;
    }
  }

  /**
   * Remove reel from queue
   */
  async removeFromQueue(reelId) {
    try {
      await this.dbManager.removeFromQueue(reelId);
      console.log(`Reel ${reelId} removed from queue`);
      return true;
    } catch (error) {
      console.error('Error removing reel from queue:', error);
      throw error;
    }
  }

  /**
   * Update reel status
   */
  async updateReelStatus(reelId, status, error = null, instagramMediaId = null) {
    try {
      await this.dbManager.updateReelStatus(reelId, status, error, instagramMediaId);
      
      // Add to publish history
      await this.dbManager.addToPublishHistory(reelId, status, error, instagramMediaId);
      
      // Remove from queue if published or failed
      if (status === 'published' || status === 'failed') {
        await this.removeFromQueue(reelId);
      }

      console.log(`Reel ${reelId} status updated to ${status}`);
      return true;
    } catch (error) {
      console.error('Error updating reel status:', error);
      throw error;
    }
  }

  /**
   * Get reel by ID
   */
  async getReelById(reelId) {
    try {
      return await this.dbManager.getReelById(reelId);
    } catch (error) {
      console.error('Error getting reel by ID:', error);
      throw error;
    }
  }

  /**
   * Get reel by UUID
   */
  async getReelByUuid(uuid) {
    try {
      return await this.dbManager.getReelByUuid(uuid);
    } catch (error) {
      console.error('Error getting reel by UUID:', error);
      throw error;
    }
  }

  /**
   * Get publish history
   */
  async getPublishHistory(limit = 50) {
    try {
      return await this.dbManager.getPublishHistory(limit);
    } catch (error) {
      console.error('Error getting publish history:', error);
      throw error;
    }
  }

  /**
   * Delete reel
   */
  async deleteReel(reelId) {
    try {
      const reel = await this.getReelById(reelId);
      if (!reel) {
        throw new Error(`Reel with ID ${reelId} not found`);
      }

      // Delete the file if it exists
      const fs = require('fs');
      if (fs.existsSync(reel.filepath)) {
        fs.unlinkSync(reel.filepath);
        console.log(`Deleted file: ${reel.filepath}`);
      }

      // Delete from database
      await this.dbManager.deleteReel(reelId);
      
      console.log(`Reel ${reelId} deleted successfully`);
      return true;
    } catch (error) {
      console.error('Error deleting reel:', error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      const queue = await this.getQueueStatus();
      const history = await this.getPublishHistory(100);
      
      const stats = {
        pending: queue.length,
        published: history.filter(r => r.status === 'published').length,
        failed: history.filter(r => r.status === 'failed').length,
        total: queue.length + history.length,
        nextScheduled: queue.length > 0 ? queue[0].scheduledTime : null
      };

      return stats;
    } catch (error) {
      console.error('Error getting queue stats:', error);
      throw error;
    }
  }

  /**
   * Reorder queue
   */
  async reorderQueue(reelId, newPosition) {
    try {
      // This is a simplified implementation
      // In a more robust system, you'd implement proper reordering
      console.log(`Reordering reel ${reelId} to position ${newPosition}`);
      
      // For now, just log the action
      // TODO: Implement proper queue reordering
      return true;
    } catch (error) {
      console.error('Error reordering queue:', error);
      throw error;
    }
  }

  /**
   * Clear failed reels from queue
   */
  async clearFailedReels() {
    try {
      const queue = await this.getQueueStatus();
      const failedReels = queue.filter(reel => reel.status === 'failed');
      
      for (const reel of failedReels) {
        await this.removeFromQueue(reel.id);
      }

      console.log(`Cleared ${failedReels.length} failed reels from queue`);
      return failedReels.length;
    } catch (error) {
      console.error('Error clearing failed reels:', error);
      throw error;
    }
  }

  /**
   * Validate reel data
   */
  validateReelData(reelData) {
    const required = ['filename', 'filepath', 'caption'];
    const missing = required.filter(field => !reelData[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(reelData.filepath)) {
      throw new Error(`File not found: ${reelData.filepath}`);
    }

    // Validate caption length (Instagram limit)
    if (reelData.caption && reelData.caption.length > 2200) {
      throw new Error('Caption too long. Maximum 2200 characters allowed.');
    }

    return true;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.dbManager) {
      this.dbManager.close();
    }
  }
}

module.exports = QueueManager;