const { db, dbManager } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async create(userData) {
    const { username, email, password } = userData;
    
    // Validate input data
    if (!username || !email || !password) {
      throw new Error('Username, email, and password are required');
    }
    
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    
    if (!email.includes('@')) {
      throw new Error('Invalid email format');
    }
    
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const result = await dbManager.executeWithRetry(`
        INSERT INTO users (username, email, password)
        VALUES (?, ?, ?)
      `, [username.trim(), email.trim().toLowerCase(), hashedPassword]);
      
      return { id: result.lastID, username: username.trim(), email: email.trim().toLowerCase() };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('UNIQUE constraint failed')) {
        if (error.message.includes('users.email')) {
          throw new Error('Email address is already registered');
        }
        if (error.message.includes('users.username')) {
          throw new Error('Username is already taken');
        }
      }
      throw error;
    }
  }

  static async findByEmail(email) {
    if (!email) {
      throw new Error('Email is required');
    }
    
    try {
      const rows = await dbManager.executeWithRetry('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
      return rows && rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  static async findById(id) {
    if (!id) {
      throw new Error('User ID is required');
    }
    
    try {
      const rows = await dbManager.executeWithRetry('SELECT id, username, email, created_at FROM users WHERE id = ?', [id]);
      return rows && rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  static async validatePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  static async update(id, userData) {
    const { username, email } = userData;
    
    if (!id) {
      throw new Error('User ID is required');
    }
    
    if (!username || !email) {
      throw new Error('Username and email are required');
    }
    
    if (!email.includes('@')) {
      throw new Error('Invalid email format');
    }
    
    try {
      const result = await dbManager.executeWithRetry(`
        UPDATE users 
        SET username = ?, email = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [username.trim(), email.trim().toLowerCase(), id]);
      
      return result.changes > 0;
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT' && error.message.includes('UNIQUE constraint failed')) {
        if (error.message.includes('users.email')) {
          throw new Error('Email address is already in use');
        }
        if (error.message.includes('users.username')) {
          throw new Error('Username is already taken');
        }
      }
      console.error('Error updating user:', error);
      throw error;
    }
  }

  static async updatePassword(id, newPassword) {
    if (!id || !newPassword) {
      throw new Error('User ID and new password are required');
    }
    
    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      const result = await dbManager.executeWithRetry(`
        UPDATE users 
        SET password = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [hashedPassword, id]);
      
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating user password:', error);
      throw error;
    }
  }
}

module.exports = User;