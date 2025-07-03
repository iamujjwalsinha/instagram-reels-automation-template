# Instagram Reels Automation Template

[![Use this template](https://img.shields.io/badge/GitHub--Template-blue?logo=github)](https://github.com/your-username/instagram-reels-automation-template/generate)
[![npm version](https://img.shields.io/npm/v/instagram-reels-automation-template?color=green&logo=npm)](https://www.npmjs.com/package/instagram-reels-automation-template)

> **This repository can be used as a [GitHub template](https://github.com/your-username/instagram-reels-automation-template/generate) for quickly starting your own Instagram Reels automation project.**
>
> **To publish on npm:**
> 1. Update the package name, author, and repository fields in `package.json`.
> 2. Run `npm publish` (requires an npm account and permissions).
> 3. See [npm docs](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages) for more info.

Easily automate posting Instagram Reels using the Instagram Graph API. This template helps you quickly set up, customize, and publish Reels programmatically.

---

## 🚀 Features
- Post Reels from public video URLs or local files
- Add captions, hashtags, and custom cover images
- User tagging support
- Automatic status monitoring and error handling
- Retry logic for robust automation

---

## 🛠️ Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/instagram-reels-automation-template.git
cd instagram-reels-automation-template
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the example environment file and fill in your credentials:
```bash
cp env.example .env
```
Edit `.env` and set:
```
INSTAGRAM_ACCESS_TOKEN=your_instagram_access_token
INSTAGRAM_ACCOUNT_ID=your_instagram_account_id
```

### 4. Run the Example Script
```bash
npm run post
# or
node post-reel.js
```

---

## 🔑 How to Get Instagram Credentials

1. **Create a Meta App**
   - Go to [Meta for Developers](https://developers.facebook.com/)
   - Create a new app and add the Instagram Basic Display product
2. **Get Access Token**
   - Use Instagram Login (Business Login for Instagram)
   - Request permissions: `instagram_business_basic`, `instagram_business_content_publish`
   - Exchange for a long-lived token (valid for 60 days)
3. **Get Account ID**
   - Use the Graph API Explorer
   - Call `GET /me/accounts` to get your Instagram account ID

---

## 📦 File Structure
```
├── src/
│   └── InstagramReelsAutomation.js  # Main automation class
├── post-reel.js                     # Example posting script
├── .env                             # Your credentials (create this)
├── env.example                      # Environment template
├── package.json                     # Dependencies and scripts
└── README.md                        # This file
```

---

## 📝 Usage Examples

### Basic Reel Post
```js
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

### Advanced Reel Post
```js
await instagram.postReelFromUrl(
  'https://example.com/video.mp4',
  'Collaboration with amazing creators! 🤝 #collab #content',
  {
    coverUrl: 'https://example.com/cover.jpg',
    userTags: [ { username: 'creator1' }, { username: 'creator2' } ],
    shareToFeed: true
  }
);
```

---

## ⚙️ API Reference

### `InstagramReelsAutomation` Class

#### Constructor
```js
new InstagramReelsAutomation(accessToken, accountId, options)
```
- `accessToken` (string): Instagram access token (from `.env`)
- `accountId` (string): Instagram account ID (from `.env`)
- `options` (object): Optional settings (logging, retries, etc.)

#### Main Methods
- `postReelFromUrl(videoUrl, caption, options)` – Post Reel from URL
- `postReelFromFile(videoFilePath, caption, options)` – Post Reel from local file
- `getMediaInfo(mediaId)` – Get info about a published Reel
- `deleteMedia(mediaId)` – Delete a published Reel

---

## 🛡️ Error Handling
- Rate limiting (automatic retry)
- Invalid tokens or permissions
- Media validation (format, size, accessibility)
- Network/API errors

---

## 📚 Resources
- [Instagram Graph API Docs](https://developers.facebook.com/docs/instagram-api/guides/content-publishing/)
- [Meta for Developers](https://developers.facebook.com/)

---

## 📝 License
MIT

---

## 🙋‍♂️ Contributing
Pull requests and issues are welcome! Please open an issue for bugs or feature requests. 