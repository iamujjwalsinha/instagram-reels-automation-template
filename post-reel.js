require('dotenv').config();
const { InstagramReelsAutomation } = require('./src/InstagramReelsAutomation');

/**
 * Test Instagram Reels posting with a real video URL
 */

// Initialize Instagram automation
const instagram = new InstagramReelsAutomation(
  process.env.INSTAGRAM_ACCESS_TOKEN,
  process.env.INSTAGRAM_ACCOUNT_ID,
  {
    enableLogging: true,
    maxRetries: 3,
    retryDelay: 1000
  }
);

async function testReelPosting() {
  console.log('🚀 Testing Instagram Reels Posting...\n');
  
  try {
    // Using the official Meta sample video for testing
    // This is a direct link to the MP4 file from the Facebook Reels Publishing APIs repo
    const videoUrl = 'https://raw.githubusercontent.com/fbsamples/reels_publishing_apis/main/sample_media/sample.mp4';
    const caption = 'Testing Instagram Reels automation! 🎬 #test #automation #instagram';
    
    console.log('📤 Attempting to post Reel...');
    console.log(`Video URL: ${videoUrl}`);
    console.log(`Caption: ${caption}\n`);
    
    const mediaId = await instagram.postReelFromUrl(videoUrl, caption, {
      shareToFeed: true
    });
    
    console.log(`✅ SUCCESS! Reel posted successfully!`);
    console.log(`📱 Media ID: ${mediaId}`);
    
    // Get media info
    console.log('\n📊 Getting media information...');
    const mediaInfo = await instagram.getMediaInfo(mediaId);
    console.log('📈 Media Info:', {
      permalink: mediaInfo.permalink,
      mediaType: mediaInfo.media_type,
      timestamp: mediaInfo.timestamp
    });
    
  } catch (error) {
    console.error('❌ Error posting Reel:', error.message);
    console.error('🔍 Error details:', {
      name: error.constructor.name,
      statusCode: error.statusCode,
      response: error.response
    });
    
    if (error.name === 'RateLimitError') {
      console.log(`⏰ Rate limited. Retry after ${error.retryAfter} seconds.`);
    } else if (error.name === 'VideoValidationError') {
      console.log('💡 Video validation failed. Please check your video file.');
    } else if (error.name === 'InstagramAPIError') {
      console.log('🔧 API error occurred. Check your credentials and permissions.');
    }
  }
}

// Run the test
if (require.main === module) {
  testReelPosting().catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
  });
}

module.exports = { testReelPosting }; 