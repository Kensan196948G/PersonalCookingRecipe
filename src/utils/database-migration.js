const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

/**
 * Database Migration Utility
 * Handles consolidation of multiple database files and schema updates
 */
class DatabaseMigration {
  constructor() {
    this.migrations = [];
    this.backendDbPath = path.join(__dirname, '../../data/recipes.db');
    this.rootDbPath = path.join(__dirname, '../../../recipe_database.sqlite');
    this.backupDir = path.join(__dirname, '../../data/backups');
  }

  async ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async backupDatabase(dbPath, suffix = '') {
    await this.ensureBackupDirectory();
    
    if (fs.existsSync(dbPath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const backupPath = path.join(this.backupDir, `${path.basename(dbPath)}_backup_${timestamp}${suffix}.db`);
      
      try {
        fs.copyFileSync(dbPath, backupPath);
        console.log(`Database backed up to: ${backupPath}`);
        return backupPath;
      } catch (error) {
        console.error(`Failed to backup database ${dbPath}:`, error);
        throw error;
      }
    }
    
    return null;
  }

  async getDatabaseTables(dbPath) {
    if (!fs.existsSync(dbPath)) {
      return [];
    }

    return new Promise((resolve, reject) => {
      // Try to open with read/write first, then fallback to readonly
      let db;
      try {
        db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE);
      } catch (error) {
        try {
          db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
        } catch (readonlyError) {
          return reject(readonlyError);
        }
      }
      
      db.all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        AND name NOT LIKE 'sqlite_%'
      `, (err, rows) => {
        db.close();
        if (err) reject(err);
        else resolve(rows.map(row => row.name));
      });
    });
  }

  async getTableRowCount(dbPath, tableName) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
      
      db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row) => {
        db.close();
        if (err) reject(err);
        else resolve(row.count);
      });
    });
  }

  async analyzeExistingDatabases() {
    const analysis = {
      backend: { exists: false, tables: [], size: 0 },
      root: { exists: false, tables: [], size: 0 }
    };

    // Analyze backend database
    if (fs.existsSync(this.backendDbPath)) {
      analysis.backend.exists = true;
      analysis.backend.tables = await this.getDatabaseTables(this.backendDbPath);
      analysis.backend.size = fs.statSync(this.backendDbPath).size;
      
      // Get row counts for each table
      for (const table of analysis.backend.tables) {
        analysis.backend[`${table}_count`] = await this.getTableRowCount(this.backendDbPath, table);
      }
    }

    // Analyze root database
    if (fs.existsSync(this.rootDbPath)) {
      analysis.root.exists = true;
      analysis.root.tables = await this.getDatabaseTables(this.rootDbPath);
      analysis.root.size = fs.statSync(this.rootDbPath).size;
      
      // Get row counts for each table
      for (const table of analysis.root.tables) {
        analysis.root[`${table}_count`] = await this.getTableRowCount(this.rootDbPath, table);
      }
    }

    return analysis;
  }

  async consolidateDatabases() {
    console.log('🔍 Analyzing existing databases...');
    const analysis = await this.analyzeExistingDatabases();
    
    console.log('Database Analysis:', JSON.stringify(analysis, null, 2));

    // Backup existing databases
    if (analysis.backend.exists) {
      await this.backupDatabase(this.backendDbPath, '_backend');
    }
    
    if (analysis.root.exists) {
      await this.backupDatabase(this.rootDbPath, '_root');
    }

    // Determine primary database (the one with more data or newer)
    let primaryDb = null;
    let secondaryDb = null;

    if (analysis.backend.exists && analysis.root.exists) {
      // Choose the database with more data
      const backendDataCount = analysis.backend.tables.reduce((sum, table) => 
        sum + (analysis.backend[`${table}_count`] || 0), 0);
      const rootDataCount = analysis.root.tables.reduce((sum, table) => 
        sum + (analysis.root[`${table}_count`] || 0), 0);

      if (backendDataCount >= rootDataCount) {
        primaryDb = this.backendDbPath;
        secondaryDb = this.rootDbPath;
      } else {
        primaryDb = this.rootDbPath;
        secondaryDb = this.backendDbPath;
      }
    } else if (analysis.backend.exists) {
      primaryDb = this.backendDbPath;
    } else if (analysis.root.exists) {
      primaryDb = this.rootDbPath;
    }

    // If we have a secondary database, we need to merge data
    if (secondaryDb && fs.existsSync(secondaryDb)) {
      await this.mergeDatabases(primaryDb, secondaryDb);
    }

    // Ensure the final database is in the correct location (backend/data/)
    if (primaryDb === this.rootDbPath) {
      console.log('📦 Moving consolidated database to backend directory...');
      const backendDir = path.dirname(this.backendDbPath);
      
      if (!fs.existsSync(backendDir)) {
        fs.mkdirSync(backendDir, { recursive: true });
      }
      
      fs.copyFileSync(this.rootDbPath, this.backendDbPath);
      
      // Remove the root database file to avoid confusion
      fs.unlinkSync(this.rootDbPath);
      
      // Also remove journal files if they exist
      const journalFile = this.rootDbPath + '-journal';
      const walFile = this.rootDbPath + '-wal';
      const shmFile = this.rootDbPath + '-shm';
      
      [journalFile, walFile, shmFile].forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    }

    console.log('✅ Database consolidation completed');
    return this.backendDbPath;
  }

  async mergeDatabases(primaryDbPath, secondaryDbPath) {
    console.log(`🔄 Merging ${secondaryDbPath} into ${primaryDbPath}...`);

    return new Promise((resolve, reject) => {
      const primaryDb = new sqlite3.Database(primaryDbPath);
      
      // Attach the secondary database
      primaryDb.run(`ATTACH DATABASE '${secondaryDbPath}' AS secondary`, (err) => {
        if (err) {
          primaryDb.close();
          return reject(err);
        }

        // Get tables from secondary database
        primaryDb.all(`
          SELECT name FROM secondary.sqlite_master 
          WHERE type='table' 
          AND name NOT LIKE 'sqlite_%'
        `, (err, tables) => {
          if (err) {
            primaryDb.close();
            return reject(err);
          }

          // Merge each table
          const mergePromises = tables.map(table => {
            return new Promise((resolveTable, rejectTable) => {
              // For simplicity, we'll INSERT OR IGNORE to avoid conflicts
              // In a production environment, you might want more sophisticated merging
              primaryDb.run(`
                INSERT OR IGNORE INTO main.${table.name} 
                SELECT * FROM secondary.${table.name}
              `, (err) => {
                if (err && !err.message.includes('no such table')) {
                  console.warn(`Warning merging table ${table.name}:`, err.message);
                }
                resolveTable();
              });
            });
          });

          Promise.all(mergePromises).then(() => {
            primaryDb.run('DETACH DATABASE secondary', (err) => {
              primaryDb.close();
              if (err) reject(err);
              else resolve();
            });
          }).catch(reject);
        });
      });
    });
  }

  async run() {
    try {
      console.log('🚀 Starting database migration...');
      
      const finalDbPath = await this.consolidateDatabases();
      
      console.log(`✅ Migration completed successfully!`);
      console.log(`📍 Unified database location: ${finalDbPath}`);
      
      return { success: true, dbPath: finalDbPath };
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// CLI interface
if (require.main === module) {
  const migration = new DatabaseMigration();
  migration.run().then(result => {
    if (result.success) {
      console.log('🎉 Database migration completed successfully!');
      process.exit(0);
    } else {
      console.error('💥 Database migration failed:', result.error);
      process.exit(1);
    }
  });
}

module.exports = DatabaseMigration;