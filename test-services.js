// Simple test to verify our services
const DatabaseManager = require('./src/DatabaseManager');
const QueueManager = require('./src/QueueManager');
const BulkUploadService = require('./src/BulkUploadService');
const SchedulerService = require('./src/SchedulerService');

async function testServices() {
  console.log('🧪 Testing Instagram Reels Automation Services...\n');

  try {
    // Test DatabaseManager
    console.log('1. Testing DatabaseManager...');
    const dbManager = new DatabaseManager('./data/test.db');
    await dbManager.init();
    console.log('   ✅ DatabaseManager initialized successfully');

    // Test QueueManager
    console.log('2. Testing QueueManager...');
    const queueManager = new QueueManager(dbManager);
    const stats = await queueManager.getQueueStats();
    console.log('   ✅ QueueManager working, stats:', stats);

    // Test BulkUploadService
    console.log('3. Testing BulkUploadService...');
    const bulkUploadService = new BulkUploadService(queueManager);
    const uploadStats = await bulkUploadService.getUploadStats();
    console.log('   ✅ BulkUploadService working');

    // Test SchedulerService
    console.log('4. Testing SchedulerService...');
    const schedulerService = new SchedulerService(queueManager);
    const schedulerStatus = await schedulerService.getStatus();
    console.log('   ✅ SchedulerService working');

    // Clean up
    dbManager.close();
    bulkUploadService.close();
    await schedulerService.close();

    console.log('\n✅ All services initialized successfully!');
    console.log('🚀 Ready to start the server with: npm start');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test if called directly
if (require.main === module) {
  testServices();
}

module.exports = testServices;