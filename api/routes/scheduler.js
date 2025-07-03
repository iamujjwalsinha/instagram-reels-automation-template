const express = require('express');
const router = express.Router();

/**
 * GET /api/scheduler/status
 * Get scheduler status
 */
router.get('/status', async (req, res) => {
  try {
    const { schedulerService } = req.services;
    const status = await schedulerService.getStatus();
    
    res.json(status);

  } catch (error) {
    console.error('Scheduler status error:', error);
    res.status(500).json({
      error: 'Failed to get scheduler status',
      message: error.message
    });
  }
});

/**
 * POST /api/scheduler/start
 * Start the scheduler
 */
router.post('/start', async (req, res) => {
  try {
    const { schedulerService } = req.services;
    
    await schedulerService.start();
    
    res.json({
      message: 'Scheduler started successfully',
      status: 'running'
    });

  } catch (error) {
    console.error('Scheduler start error:', error);
    res.status(500).json({
      error: 'Failed to start scheduler',
      message: error.message
    });
  }
});

/**
 * POST /api/scheduler/stop
 * Stop the scheduler
 */
router.post('/stop', async (req, res) => {
  try {
    const { schedulerService } = req.services;
    
    await schedulerService.stop();
    
    res.json({
      message: 'Scheduler stopped successfully',
      status: 'stopped'
    });

  } catch (error) {
    console.error('Scheduler stop error:', error);
    res.status(500).json({
      error: 'Failed to stop scheduler',
      message: error.message
    });
  }
});

/**
 * POST /api/scheduler/pause
 * Pause the scheduler
 */
router.post('/pause', async (req, res) => {
  try {
    const { schedulerService } = req.services;
    
    await schedulerService.pause();
    
    res.json({
      message: 'Scheduler paused successfully',
      status: 'paused'
    });

  } catch (error) {
    console.error('Scheduler pause error:', error);
    res.status(500).json({
      error: 'Failed to pause scheduler',
      message: error.message
    });
  }
});

/**
 * POST /api/scheduler/resume
 * Resume the scheduler
 */
router.post('/resume', async (req, res) => {
  try {
    const { schedulerService } = req.services;
    
    await schedulerService.resume();
    
    res.json({
      message: 'Scheduler resumed successfully',
      status: 'running'
    });

  } catch (error) {
    console.error('Scheduler resume error:', error);
    res.status(500).json({
      error: 'Failed to resume scheduler',
      message: error.message
    });
  }
});

/**
 * POST /api/scheduler/trigger
 * Manually trigger publishing
 */
router.post('/trigger', async (req, res) => {
  try {
    const { schedulerService } = req.services;
    
    await schedulerService.triggerPublish();
    
    res.json({
      message: 'Publishing triggered successfully'
    });

  } catch (error) {
    console.error('Scheduler trigger error:', error);
    res.status(500).json({
      error: 'Failed to trigger publishing',
      message: error.message
    });
  }
});

/**
 * POST /api/scheduler/schedule
 * Configure scheduling settings
 */
router.post('/schedule', async (req, res) => {
  try {
    const { schedulerService } = req.services;
    const { postingTime, timezone } = req.body;
    
    if (!postingTime) {
      return res.status(400).json({
        error: 'Posting time required',
        message: 'Please provide a posting time in HH:MM format'
      });
    }
    
    await schedulerService.updateSchedule(postingTime, timezone);
    
    res.json({
      message: 'Schedule updated successfully',
      postingTime: postingTime,
      timezone: timezone || schedulerService.timezone
    });

  } catch (error) {
    console.error('Schedule update error:', error);
    res.status(500).json({
      error: 'Failed to update schedule',
      message: error.message
    });
  }
});

/**
 * GET /api/scheduler/history
 * Get publishing history
 */
router.get('/history', async (req, res) => {
  try {
    const { schedulerService } = req.services;
    const limit = parseInt(req.query.limit) || 30;
    
    const history = await schedulerService.getPublishingHistory(limit);
    
    res.json({
      history: history,
      count: history.length
    });

  } catch (error) {
    console.error('Publishing history error:', error);
    res.status(500).json({
      error: 'Failed to get publishing history',
      message: error.message
    });
  }
});

/**
 * GET /api/scheduler/next-run
 * Get next scheduled run time
 */
router.get('/next-run', async (req, res) => {
  try {
    const { schedulerService } = req.services;
    const nextRunTime = schedulerService.getNextRunTime();
    
    res.json({
      nextRunTime: nextRunTime,
      nextRunTimeFormatted: nextRunTime ? nextRunTime.toLocaleString() : null
    });

  } catch (error) {
    console.error('Next run time error:', error);
    res.status(500).json({
      error: 'Failed to get next run time',
      message: error.message
    });
  }
});

/**
 * GET /api/scheduler/test-connection
 * Test Instagram connection
 */
router.get('/test-connection', async (req, res) => {
  try {
    const { schedulerService } = req.services;
    const connectionTest = await schedulerService.testInstagramConnection();
    
    res.json(connectionTest);

  } catch (error) {
    console.error('Connection test error:', error);
    res.status(500).json({
      error: 'Failed to test connection',
      message: error.message
    });
  }
});

/**
 * GET /api/scheduler/settings
 * Get scheduler settings
 */
router.get('/settings', async (req, res) => {
  try {
    const { schedulerService } = req.services;
    
    const settings = {
      postingTime: schedulerService.postingTime,
      timezone: schedulerService.timezone,
      retryAttempts: schedulerService.retryAttempts,
      retryDelay: schedulerService.retryDelay,
      isRunning: schedulerService.isRunning,
      lastRunTime: schedulerService.lastRunTime
    };
    
    res.json(settings);

  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).json({
      error: 'Failed to get settings',
      message: error.message
    });
  }
});

/**
 * POST /api/scheduler/settings
 * Update scheduler settings
 */
router.post('/settings', async (req, res) => {
  try {
    const { schedulerService } = req.services;
    const { postingTime, timezone, retryAttempts, retryDelay } = req.body;
    
    // Update individual settings
    if (postingTime) {
      await schedulerService.updateSchedule(postingTime, timezone);
    }
    
    if (retryAttempts !== undefined) {
      schedulerService.retryAttempts = parseInt(retryAttempts);
    }
    
    if (retryDelay !== undefined) {
      schedulerService.retryDelay = parseInt(retryDelay);
    }
    
    res.json({
      message: 'Settings updated successfully',
      settings: {
        postingTime: schedulerService.postingTime,
        timezone: schedulerService.timezone,
        retryAttempts: schedulerService.retryAttempts,
        retryDelay: schedulerService.retryDelay
      }
    });

  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({
      error: 'Failed to update settings',
      message: error.message
    });
  }
});

module.exports = router;