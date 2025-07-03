#!/usr/bin/env node

/**
 * Example script demonstrating bulk upload functionality
 * This script shows how to use the bulk upload API programmatically
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

async function demonstrateBulkUpload() {
  console.log('🎬 Instagram Reels Bulk Upload Demo\n');

  try {
    // Check if server is running
    console.log('1. Checking server status...');
    const healthCheck = await axios.get(`${SERVER_URL}/health`);
    console.log('   ✅ Server is healthy:', healthCheck.data.status);

    // Get current status
    console.log('\n2. Getting current system status...');
    const status = await axios.get(`${SERVER_URL}/api/status`);
    console.log('   📊 Current queue size:', status.data.queue.pending);
    console.log('   📁 Upload directory:', status.data.uploads.uploadsDirectory);

    // Demonstrate scheduler configuration
    console.log('\n3. Configuring scheduler...');
    const scheduleConfig = {
      postingTime: '10:00',
      timezone: 'America/New_York'
    };
    
    try {
      const scheduleResponse = await axios.post(`${SERVER_URL}/api/scheduler/schedule`, scheduleConfig);
      console.log('   ⏰ Schedule configured:', scheduleResponse.data.message);
    } catch (error) {
      console.log('   ⚠️ Schedule configuration:', error.response?.data?.message || error.message);
    }

    // Note: For actual bulk upload, you would need video files
    console.log('\n4. Bulk Upload Example (simulated)...');
    console.log('   📝 To upload real videos, use:');
    console.log('   curl -X POST http://localhost:3000/api/reels/bulk-upload \\');
    console.log('     -F "videos=@video1.mp4" \\');
    console.log('     -F "videos=@video2.mp4" \\');
    console.log('     -F "metadata=[{\\"caption\\":\\"First video\\",\\"tags\\":[\\"tag1\\",\\"tag2\\"]},{\\"caption\\":\\"Second video\\",\\"tags\\":[\\"tag3\\"]}]"');

    // Demonstrate queue status
    console.log('\n5. Getting queue status...');
    const queueStatus = await axios.get(`${SERVER_URL}/api/reels/queue`);
    console.log('   📋 Queue status:', queueStatus.data.stats);

    // Demonstrate scheduler status
    console.log('\n6. Getting scheduler status...');
    const schedulerStatus = await axios.get(`${SERVER_URL}/api/scheduler/status`);
    console.log('   ⏰ Scheduler running:', schedulerStatus.data.isRunning);
    console.log('   🌍 Timezone:', schedulerStatus.data.timezone);
    console.log('   📅 Posting time:', schedulerStatus.data.postingTime);

    console.log('\n✅ Demo completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Add video files to upload via the API');
    console.log('   2. Configure your Instagram credentials in .env');
    console.log('   3. Start the scheduler with: curl -X POST http://localhost:3000/api/scheduler/start');
    console.log('   4. Monitor the queue with: curl http://localhost:3000/api/reels/queue');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the server is running:');
      console.log('   npm start');
    } else if (error.response) {
      console.log('   Server response:', error.response.data);
    }
    
    process.exit(1);
  }
}

// Show help
function showHelp() {
  console.log(`
Instagram Reels Bulk Upload Demo

Usage: node examples/bulk-upload-demo.js [options]

Options:
  --help        Show this help message
  --server-url  Server URL (default: http://localhost:3000)

Examples:
  node examples/bulk-upload-demo.js
  node examples/bulk-upload-demo.js --server-url http://localhost:3000

Make sure the server is running before running this demo:
  npm start
`);
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.includes('--help')) {
  showHelp();
  process.exit(0);
}

// Override server URL if provided
const serverUrlArg = args.find(arg => arg.startsWith('--server-url='));
if (serverUrlArg) {
  process.env.SERVER_URL = serverUrlArg.split('=')[1];
}

// Run the demo
if (require.main === module) {
  demonstrateBulkUpload();
}

module.exports = demonstrateBulkUpload;