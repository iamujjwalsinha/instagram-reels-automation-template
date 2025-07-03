const cron = require('cron');
const QueueManager = require('./QueueManager');
const { InstagramReelsAutomation } = require('./InstagramReelsAutomation');

/**
 * Scheduler Service for automated daily reel publishing
 */
class SchedulerService {
  constructor(queueManager = null) {
    this.queueManager = queueManager || new QueueManager();
    this.instagram = null;
    this.cronJob = null;
    this.isRunning = false;
    this.lastRunTime = null;
    this.retryAttempts = parseInt(process.env.RETRY_ATTEMPTS) || 3;
    this.retryDelay = parseInt(process.env.RETRY_DELAY) || 5000;
    
    // Default posting settings
    this.postingTime = process.env.POSTING_TIME || '10:00';
    this.timezone = process.env.TIMEZONE || 'America/New_York';
    
    this.initializeInstagram();
  }

  /**
   * Initialize Instagram automation
   */
  initializeInstagram() {
    try {
      const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
      const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
      
      if (!accessToken || !accountId) {
        console.error('Instagram credentials not found in environment variables');
        return;
      }

      this.instagram = new InstagramReelsAutomation(accessToken, accountId, {
        enableLogging: true,
        maxRetries: this.retryAttempts,
        retryDelay: this.retryDelay
      });

      console.log('Instagram automation initialized successfully');
    } catch (error) {
      console.error('Error initializing Instagram automation:', error);
    }
  }

  /**
   * Start the scheduler
   */
  async start() {
    try {
      if (this.isRunning) {
        console.log('Scheduler is already running');
        return;
      }

      // Parse posting time
      const [hours, minutes] = this.postingTime.split(':').map(Number);
      const cronPattern = `${minutes} ${hours} * * *`; // Run daily at specified time

      console.log(`Starting scheduler with pattern: ${cronPattern} (${this.postingTime} ${this.timezone})`);

      this.cronJob = new cron.CronJob(
        cronPattern,
        async () => {
          await this.publishNextReel();
        },
        null,
        true,
        this.timezone
      );

      this.isRunning = true;
      console.log(`Scheduler started successfully. Next run: ${this.cronJob.nextDate()}`);
      
      // Store scheduler status
      await this.queueManager.dbManager.setSetting('scheduler_status', 'running');
      await this.queueManager.dbManager.setSetting('scheduler_pattern', cronPattern);
      await this.queueManager.dbManager.setSetting('scheduler_timezone', this.timezone);

    } catch (error) {
      console.error('Error starting scheduler:', error);
      throw error;
    }
  }

  /**
   * Stop the scheduler
   */
  async stop() {
    try {
      if (!this.isRunning) {
        console.log('Scheduler is not running');
        return;
      }

      if (this.cronJob) {
        this.cronJob.stop();
        this.cronJob = null;
      }

      this.isRunning = false;
      console.log('Scheduler stopped');
      
      // Store scheduler status
      await this.queueManager.dbManager.setSetting('scheduler_status', 'stopped');

    } catch (error) {
      console.error('Error stopping scheduler:', error);
      throw error;
    }
  }

  /**
   * Publish next reel in queue
   */
  async publishNextReel() {
    if (!this.instagram) {
      console.error('Instagram automation not initialized');
      return;
    }

    try {
      console.log('Running scheduled publishing job...');
      this.lastRunTime = new Date();

      // Get next reel from queue
      const nextReel = await this.queueManager.getNextInQueue();
      
      if (!nextReel) {
        console.log('No reels in queue to publish');
        return;
      }

      console.log(`Publishing reel: ${nextReel.uuid} (${nextReel.originalName})`);

      // Update status to publishing
      await this.queueManager.updateReelStatus(nextReel.id, 'publishing');

      let attempt = 0;
      let lastError = null;

      while (attempt < this.retryAttempts) {
        try {
          // Publish the reel
          const mediaId = await this.instagram.postReelFromFile(
            nextReel.filepath,
            nextReel.caption,
            {
              coverUrl: nextReel.coverUrl,
              userTags: nextReel.userTags,
              shareToFeed: nextReel.shareToFeed
            }
          );

          // Update status to published
          await this.queueManager.updateReelStatus(nextReel.id, 'published', null, mediaId);
          
          console.log(`✅ Successfully published reel: ${nextReel.uuid} (Media ID: ${mediaId})`);
          
          // Clean up the file after successful publish
          const fs = require('fs');
          if (fs.existsSync(nextReel.filepath)) {
            fs.unlinkSync(nextReel.filepath);
            console.log(`Cleaned up file: ${nextReel.filepath}`);
          }

          return;

        } catch (error) {
          attempt++;
          lastError = error;
          
          console.error(`Publish attempt ${attempt} failed for reel ${nextReel.uuid}:`, error.message);
          
          if (attempt < this.retryAttempts) {
            console.log(`Retrying in ${this.retryDelay}ms...`);
            await this.sleep(this.retryDelay);
          }
        }
      }

      // All attempts failed
      await this.queueManager.updateReelStatus(nextReel.id, 'failed', lastError.message);
      console.error(`❌ Failed to publish reel ${nextReel.uuid} after ${this.retryAttempts} attempts`);

    } catch (error) {
      console.error('Error in scheduled publishing job:', error);
    }
  }

  /**
   * Manually trigger publishing
   */
  async triggerPublish() {
    try {
      console.log('Manually triggering publish job...');
      await this.publishNextReel();
      return true;
    } catch (error) {
      console.error('Error in manual publish trigger:', error);
      throw error;
    }
  }

  /**
   * Update posting schedule
   */
  async updateSchedule(postingTime, timezone = null) {
    try {
      // Validate time format
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(postingTime)) {
        throw new Error('Invalid time format. Use HH:MM (24-hour format)');
      }

      const wasRunning = this.isRunning;
      
      // Stop current scheduler if running
      if (wasRunning) {
        await this.stop();
      }

      // Update settings
      this.postingTime = postingTime;
      if (timezone) {
        this.timezone = timezone;
      }

      // Store new settings
      await this.queueManager.dbManager.setSetting('posting_time', this.postingTime);
      await this.queueManager.dbManager.setSetting('timezone', this.timezone);

      // Restart scheduler if it was running
      if (wasRunning) {
        await this.start();
      }

      console.log(`Schedule updated: ${this.postingTime} ${this.timezone}`);
      return true;

    } catch (error) {
      console.error('Error updating schedule:', error);
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  async getStatus() {
    try {
      const queueStats = await this.queueManager.getQueueStats();
      
      return {
        isRunning: this.isRunning,
        postingTime: this.postingTime,
        timezone: this.timezone,
        lastRunTime: this.lastRunTime,
        nextRunTime: this.cronJob ? this.cronJob.nextDate() : null,
        retryAttempts: this.retryAttempts,
        retryDelay: this.retryDelay,
        queueStats: queueStats,
        instagramConnected: !!this.instagram
      };
    } catch (error) {
      console.error('Error getting scheduler status:', error);
      throw error;
    }
  }

  /**
   * Get next scheduled run time
   */
  getNextRunTime() {
    if (!this.cronJob) return null;
    return this.cronJob.nextDate();
  }

  /**
   * Test Instagram connection
   */
  async testInstagramConnection() {
    try {
      if (!this.instagram) {
        throw new Error('Instagram automation not initialized');
      }

      // This is a simple test - in a real implementation you might want to
      // make a simple API call to verify the connection
      console.log('Testing Instagram connection...');
      
      // You could test by getting account info or making a simple API call
      // For now, we'll just check if the Instagram instance exists
      return {
        connected: true,
        message: 'Instagram automation is initialized'
      };

    } catch (error) {
      console.error('Instagram connection test failed:', error);
      return {
        connected: false,
        message: error.message
      };
    }
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Load settings from database
   */
  async loadSettings() {
    try {
      const postingTime = await this.queueManager.dbManager.getSetting('posting_time');
      const timezone = await this.queueManager.dbManager.getSetting('timezone');
      
      if (postingTime) {
        this.postingTime = postingTime;
      }
      
      if (timezone) {
        this.timezone = timezone;
      }

      console.log(`Settings loaded: ${this.postingTime} ${this.timezone}`);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  /**
   * Get publishing history
   */
  async getPublishingHistory(limit = 30) {
    try {
      return await this.queueManager.getPublishHistory(limit);
    } catch (error) {
      console.error('Error getting publishing history:', error);
      throw error;
    }
  }

  /**
   * Pause scheduler temporarily
   */
  async pause() {
    try {
      if (this.cronJob) {
        this.cronJob.stop();
        console.log('Scheduler paused');
        await this.queueManager.dbManager.setSetting('scheduler_status', 'paused');
      }
    } catch (error) {
      console.error('Error pausing scheduler:', error);
      throw error;
    }
  }

  /**
   * Resume scheduler
   */
  async resume() {
    try {
      if (this.cronJob) {
        this.cronJob.start();
        console.log('Scheduler resumed');
        await this.queueManager.dbManager.setSetting('scheduler_status', 'running');
      }
    } catch (error) {
      console.error('Error resuming scheduler:', error);
      throw error;
    }
  }

  /**
   * Close scheduler service
   */
  async close() {
    try {
      await this.stop();
      if (this.queueManager) {
        this.queueManager.close();
      }
      console.log('Scheduler service closed');
    } catch (error) {
      console.error('Error closing scheduler service:', error);
    }
  }
}

module.exports = SchedulerService;