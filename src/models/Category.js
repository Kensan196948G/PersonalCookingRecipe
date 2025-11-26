const { db } = require('../config/database');

class Category {
  static create(categoryData) {
    const { name, description, color } = categoryData;
    return new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO categories (name, description, color)
        VALUES (?, ?, ?)
      `, [name, description, color || '#3498db'], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, name, description, color });
      });
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM categories ORDER BY name', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM categories WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static update(id, categoryData) {
    const { name, description, color } = categoryData;
    return new Promise((resolve, reject) => {
      db.run(`
        UPDATE categories 
        SET name = ?, description = ?, color = ?
        WHERE id = ?
      `, [name, description, color, id], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  static delete(id) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM categories WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      });
    });
  }

  static getRecipeCount(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM recipes WHERE category_id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
  }
}

module.exports = Category;