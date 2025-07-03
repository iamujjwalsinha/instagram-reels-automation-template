const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

/**
 * Database Manager for storing reel metadata, queue state, and scheduling information
 */
class DatabaseManager {
  constructor(dbPath = './data/reels.db') {
    this.dbPath = dbPath;
    this.db = null;
    this.init();
  }

  /**
   * Initialize database and create tables if they don't exist
   */
  async init() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          throw err;
        }
        console.log('Connected to SQLite database');
      });

      // Create tables
      await this.createTables();
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  /**
   * Create necessary tables
   */
  async createTables() {
    const reelsTable = `
      CREATE TABLE IF NOT EXISTS reels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        originalName TEXT,
        caption TEXT,
        tags TEXT,
        coverUrl TEXT,
        userTags TEXT,
        shareToFeed BOOLEAN DEFAULT true,
        status TEXT DEFAULT 'pending',
        scheduledTime TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        publishedAt DATETIME,
        instagramMediaId TEXT,
        error TEXT
      )
    `;

    const queueTable = `
      CREATE TABLE IF NOT EXISTS queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reelId INTEGER NOT NULL,
        position INTEGER NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reelId) REFERENCES reels (id)
      )
    `;

    const settingsTable = `
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const publishHistoryTable = `
      CREATE TABLE IF NOT EXISTS publish_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reelId INTEGER NOT NULL,
        status TEXT NOT NULL,
        publishedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        error TEXT,
        instagramMediaId TEXT,
        FOREIGN KEY (reelId) REFERENCES reels (id)
      )
    `;

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run(reelsTable, (err) => {
          if (err) reject(err);
        });
        this.db.run(queueTable, (err) => {
          if (err) reject(err);
        });
        this.db.run(settingsTable, (err) => {
          if (err) reject(err);
        });
        this.db.run(publishHistoryTable, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  /**
   * Add a reel to the database
   */
  async addReel(reelData) {
    const {
      uuid,
      filename,
      filepath,
      originalName,
      caption,
      tags,
      coverUrl,
      userTags,
      shareToFeed,
      scheduledTime
    } = reelData;

    const sql = `
      INSERT INTO reels (
        uuid, filename, filepath, originalName, caption, tags, 
        coverUrl, userTags, shareToFeed, scheduledTime
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        uuid,
        filename,
        filepath,
        originalName,
        caption,
        JSON.stringify(tags),
        coverUrl,
        JSON.stringify(userTags),
        shareToFeed,
        scheduledTime
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  /**
   * Add reel to queue
   */
  async addToQueue(reelId) {
    // Get current maximum position
    const maxPosition = await this.getMaxQueuePosition();
    const position = maxPosition + 1;

    const sql = `INSERT INTO queue (reelId, position) VALUES (?, ?)`;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [reelId, position], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  /**
   * Get maximum queue position
   */
  async getMaxQueuePosition() {
    const sql = `SELECT MAX(position) as maxPosition FROM queue`;
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, (err, row) => {
        if (err) reject(err);
        else resolve(row.maxPosition || 0);
      });
    });
  }

  /**
   * Get next reel in queue
   */
  async getNextInQueue() {
    const sql = `
      SELECT r.*, q.position 
      FROM reels r 
      JOIN queue q ON r.id = q.reelId 
      WHERE r.status = 'pending' 
      ORDER BY q.position ASC 
      LIMIT 1
    `;

    return new Promise((resolve, reject) => {
      this.db.get(sql, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }

  /**
   * Get queue status
   */
  async getQueueStatus() {
    const sql = `
      SELECT r.*, q.position 
      FROM reels r 
      JOIN queue q ON r.id = q.reelId 
      WHERE r.status = 'pending' 
      ORDER BY q.position ASC
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, (err, rows) => {
        if (err) reject(err);
        else {
          const reels = rows.map(row => ({
            ...row,
            tags: JSON.parse(row.tags || '[]'),
            userTags: JSON.parse(row.userTags || '[]')
          }));
          resolve(reels);
        }
      });
    });
  }

  /**
   * Update reel status
   */
  async updateReelStatus(reelId, status, error = null, instagramMediaId = null) {
    const sql = `
      UPDATE reels 
      SET status = ?, error = ?, instagramMediaId = ?, publishedAt = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [status, error, instagramMediaId, reelId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  /**
   * Remove reel from queue
   */
  async removeFromQueue(reelId) {
    const sql = `DELETE FROM queue WHERE reelId = ?`;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [reelId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  /**
   * Get reel by ID
   */
  async getReelById(reelId) {
    const sql = `SELECT * FROM reels WHERE id = ?`;

    return new Promise((resolve, reject) => {
      this.db.get(sql, [reelId], (err, row) => {
        if (err) reject(err);
        else {
          if (row) {
            row.tags = JSON.parse(row.tags || '[]');
            row.userTags = JSON.parse(row.userTags || '[]');
          }
          resolve(row || null);
        }
      });
    });
  }

  /**
   * Get reel by UUID
   */
  async getReelByUuid(uuid) {
    const sql = `SELECT * FROM reels WHERE uuid = ?`;

    return new Promise((resolve, reject) => {
      this.db.get(sql, [uuid], (err, row) => {
        if (err) reject(err);
        else {
          if (row) {
            row.tags = JSON.parse(row.tags || '[]');
            row.userTags = JSON.parse(row.userTags || '[]');
          }
          resolve(row || null);
        }
      });
    });
  }

  /**
   * Get publish history
   */
  async getPublishHistory(limit = 50) {
    const sql = `
      SELECT r.*, ph.status as publishStatus, ph.publishedAt, ph.error as publishError
      FROM reels r
      LEFT JOIN publish_history ph ON r.id = ph.reelId
      ORDER BY ph.publishedAt DESC
      LIMIT ?
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [limit], (err, rows) => {
        if (err) reject(err);
        else {
          const reels = rows.map(row => ({
            ...row,
            tags: JSON.parse(row.tags || '[]'),
            userTags: JSON.parse(row.userTags || '[]')
          }));
          resolve(reels);
        }
      });
    });
  }

  /**
   * Add to publish history
   */
  async addToPublishHistory(reelId, status, error = null, instagramMediaId = null) {
    const sql = `
      INSERT INTO publish_history (reelId, status, error, instagramMediaId) 
      VALUES (?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [reelId, status, error, instagramMediaId], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  /**
   * Get/Set settings
   */
  async getSetting(key) {
    const sql = `SELECT value FROM settings WHERE key = ?`;

    return new Promise((resolve, reject) => {
      this.db.get(sql, [key], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.value : null);
      });
    });
  }

  async setSetting(key, value) {
    const sql = `
      INSERT OR REPLACE INTO settings (key, value, updatedAt) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [key, value], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  /**
   * Delete reel and remove from queue
   */
  async deleteReel(reelId) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('DELETE FROM queue WHERE reelId = ?', [reelId]);
        this.db.run('DELETE FROM reels WHERE id = ?', [reelId], function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        });
      });
    });
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

module.exports = DatabaseManager;