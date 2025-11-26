const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database configuration with connection pooling and WAL mode
class DatabaseManager {
  constructor() {
    this.dbPath = this.resolveDatabasePath();
    this.connections = new Map();
    this.maxConnections = 10;
    this.connectionTimeout = 30000;
    this.busyTimeout = 10000;
    this.initialized = false;
  }

  resolveDatabasePath() {
    // Unified database path resolution
    if (process.env.NODE_ENV === 'test') {
      return path.join(__dirname, '../../data/test-recipes.db');
    }
    
    // Use environment variable or default to backend data directory
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/recipes.db');
    const dbDir = path.dirname(dbPath);

    // Ensure database directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    return dbPath;
  }

  createConnection() {
    const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) {
        console.error('Database connection error:', err.message);
        throw err;
      }
    });

    // Configure database for concurrency and performance
    db.configure('busyTimeout', this.busyTimeout);
    
    // Enable WAL mode for better concurrency with error handling
    this.configurePragmas(db);

    return db;
  }

  configurePragmas(db) {
    const pragmas = [
      'PRAGMA journal_mode = WAL',
      'PRAGMA synchronous = NORMAL', 
      'PRAGMA cache_size = 1000',
      'PRAGMA foreign_keys = ON',
      'PRAGMA temp_store = MEMORY'
    ];

    // For test environment, use less aggressive settings
    if (process.env.NODE_ENV === 'test') {
      pragmas.splice(0, 1, 'PRAGMA journal_mode = DELETE'); // Use DELETE mode for tests
      pragmas.splice(1, 1, 'PRAGMA synchronous = OFF'); // Faster for tests
    }

    pragmas.forEach((pragma, index) => {
      db.exec(pragma, (err) => {
        if (err && !err.message.includes('disk I/O error')) {
          console.error(`Database PRAGMA error (${pragma}):`, err.message);
        }
        // Ignore I/O errors for PRAGMA commands as they might be filesystem-related
      });
    });
  }

  getConnection() {
    if (this.connections.size < this.maxConnections) {
      const connectionId = `conn_${Date.now()}_${Math.random()}`;
      const connection = this.createConnection();
      this.connections.set(connectionId, {
        db: connection,
        lastUsed: Date.now(),
        inUse: false
      });
      return { id: connectionId, db: connection };
    }

    // Find available connection
    for (const [id, conn] of this.connections) {
      if (!conn.inUse) {
        conn.lastUsed = Date.now();
        conn.inUse = true;
        return { id, db: conn.db };
      }
    }

    // If no available connections, use the primary connection
    return { id: 'primary', db: this.db };
  }

  releaseConnection(connectionId) {
    if (this.connections.has(connectionId)) {
      this.connections.get(connectionId).inUse = false;
    }
  }

  async executeWithRetry(query, params = [], maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const { id, db } = this.getConnection();
      try {
        const result = await new Promise((resolve, reject) => {
          if (query.trim().toLowerCase().startsWith('select')) {
            db.all(query, params, (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            });
          } else {
            db.run(query, params, function(err) {
              if (err) reject(err);
              else resolve({ changes: this.changes, lastID: this.lastID });
            });
          }
        });
        this.releaseConnection(id);
        return result;
      } catch (error) {
        this.releaseConnection(id);
        
        if (error.code === 'SQLITE_BUSY' && attempt < maxRetries) {
          console.warn(`Database busy, retrying attempt ${attempt + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
          continue;
        }
        throw error;
      }
    }
  }
}

const dbManager = new DatabaseManager();
const db = dbManager.createConnection();

// Set the primary database connection
dbManager.db = db;

const initialize = async () => {
  if (dbManager.initialized) {
    return Promise.resolve();
  }

  try {
    // Create tables with enhanced error handling and validation
    await dbManager.executeWithRetry(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL CHECK(length(username) > 0),
        email TEXT UNIQUE NOT NULL CHECK(email LIKE '%_@_%'),
        password TEXT NOT NULL CHECK(length(password) >= 6),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await dbManager.executeWithRetry(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL CHECK(length(name) > 0),
        description TEXT,
        color TEXT DEFAULT '#3498db',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await dbManager.executeWithRetry(`
      CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        category_id INTEGER,
        title TEXT NOT NULL CHECK(length(title) > 0),
        description TEXT,
        prep_time INTEGER CHECK(prep_time >= 0),
        cook_time INTEGER CHECK(cook_time >= 0),
        servings INTEGER CHECK(servings > 0),
        difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')),
        image_url TEXT,
        instructions TEXT NOT NULL CHECK(length(instructions) > 0),
        notes TEXT,
        is_favorite BOOLEAN DEFAULT 0,
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
      )
    `);

    await dbManager.executeWithRetry(`
      CREATE TABLE IF NOT EXISTS ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL,
        name TEXT NOT NULL CHECK(length(name) > 0),
        amount TEXT NOT NULL CHECK(length(amount) > 0),
        unit TEXT,
        notes TEXT,
        order_index INTEGER DEFAULT 0,
        FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE
      )
    `);

    await dbManager.executeWithRetry(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL CHECK(length(name) > 0)
      )
    `);

    await dbManager.executeWithRetry(`
      CREATE TABLE IF NOT EXISTS recipe_tags (
        recipe_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (recipe_id, tag_id),
        FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_recipes_category_id ON recipes(category_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ingredients_recipe_id ON ingredients(recipe_id)`,
      `CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe_id ON recipe_tags(recipe_id)`,
      `CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag_id ON recipe_tags(tag_id)`,
      `CREATE INDEX IF NOT EXISTS idx_recipes_title ON recipes(title)`,
      `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
      `CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name)`
    ];

    for (const indexQuery of indexes) {
      await dbManager.executeWithRetry(indexQuery);
    }

    dbManager.initialized = true;
    console.log(`Database initialized successfully: ${dbManager.dbPath}`);
    return Promise.resolve();
    
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};

// Graceful shutdown handling
const closeConnections = async () => {
  return new Promise((resolve) => {
    let closedConnections = 0;
    const totalConnections = dbManager.connections.size + 1; // +1 for primary connection

    const checkComplete = () => {
      if (closedConnections >= totalConnections) {
        resolve();
      }
    };

    // Close all pooled connections
    for (const [id, conn] of dbManager.connections) {
      conn.db.close((err) => {
        if (err) console.error(`Error closing connection ${id}:`, err);
        closedConnections++;
        checkComplete();
      });
    }

    // Close primary connection
    db.close((err) => {
      if (err) console.error('Error closing primary connection:', err);
      closedConnections++;
      checkComplete();
    });

    // Timeout safety
    setTimeout(() => {
      if (closedConnections < totalConnections) {
        console.warn('Database connections did not close gracefully within timeout');
        resolve();
      }
    }, 5000);
  });
};

// Handle process termination
process.on('SIGINT', async () => {
  console.log('Gracefully shutting down database connections...');
  await closeConnections();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Gracefully shutting down database connections...');
  await closeConnections();
  process.exit(0);
});

module.exports = {
  db,
  dbManager,
  initialize,
  closeConnections
};