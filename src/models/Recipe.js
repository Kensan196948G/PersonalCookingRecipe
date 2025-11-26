const { db, dbManager } = require('../config/database');

class Recipe {
  static async create(recipeData, userId) {
    const { title, description, category_id, prep_time, cook_time, servings, difficulty, instructions, notes, ingredients, tags } = recipeData;
    
    // Validate required fields
    if (!title || !instructions) {
      throw new Error('Title and instructions are required');
    }
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      await dbManager.executeWithRetry('BEGIN TRANSACTION');
      
      // Insert recipe with enhanced error handling
      const recipeResult = await dbManager.executeWithRetry(`
        INSERT INTO recipes (user_id, category_id, title, description, prep_time, cook_time, servings, difficulty, instructions, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [userId, category_id || null, title, description || null, prep_time || null, cook_time || null, servings || null, difficulty || null, instructions, notes || null]);
      
      const recipeId = recipeResult.lastID;
      
      // Insert ingredients with validation
      if (ingredients && Array.isArray(ingredients) && ingredients.length > 0) {
        for (let index = 0; index < ingredients.length; index++) {
          const ing = ingredients[index];
          
          // Validate ingredient data
          if (!ing.name || !ing.amount) {
            throw new Error(`Ingredient at index ${index} is missing required fields (name and amount)`);
          }
          
          await dbManager.executeWithRetry(`
            INSERT INTO ingredients (recipe_id, name, amount, unit, notes, order_index)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [recipeId, ing.name.trim(), ing.amount.trim(), ing.unit || null, ing.notes || null, index]);
        }
      }
      
      await dbManager.executeWithRetry('COMMIT');
      return { id: recipeId, ...recipeData };
      
    } catch (error) {
      try {
        await dbManager.executeWithRetry('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Rollback failed:', rollbackErr);
      }
      
      // Enhance error messages for better debugging
      if (error.code === 'SQLITE_CONSTRAINT') {
        if (error.message.includes('NOT NULL constraint failed')) {
          throw new Error(`Missing required field: ${error.message.split(': ')[1]}`);
        }
        if (error.message.includes('UNIQUE constraint failed')) {
          throw new Error(`Duplicate value: ${error.message.split(': ')[1]}`);
        }
        if (error.message.includes('FOREIGN KEY constraint failed')) {
          throw new Error('Invalid reference to related data');
        }
      }
      
      throw error;
    }
  }

  static async findAll(userId, filters = {}) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      let query = `
        SELECT r.*, c.name as category_name, c.color as category_color
        FROM recipes r
        LEFT JOIN categories c ON r.category_id = c.id
        WHERE r.user_id = ?
      `;
      const params = [userId];

      if (filters.category_id) {
        query += ' AND r.category_id = ?';
        params.push(filters.category_id);
      }

      if (filters.difficulty) {
        query += ' AND r.difficulty = ?';
        params.push(filters.difficulty);
      }

      if (filters.is_favorite !== undefined) {
        query += ' AND r.is_favorite = ?';
        params.push(filters.is_favorite ? 1 : 0);
      }

      if (filters.search) {
        query += ' AND (r.title LIKE ? OR r.description LIKE ?)';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm);
      }

      query += ' ORDER BY r.created_at DESC';
      
      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(parseInt(filters.limit));
      }

      const rows = await dbManager.executeWithRetry(query, params);
      return rows || [];
      
    } catch (error) {
      console.error('Error finding recipes:', error);
      throw error;
    }
  }

  static async findById(id, userId) {
    if (!id || !userId) {
      throw new Error('Recipe ID and User ID are required');
    }

    try {
      const recipe = await dbManager.executeWithRetry(`
        SELECT r.*, c.name as category_name, c.color as category_color
        FROM recipes r
        LEFT JOIN categories c ON r.category_id = c.id
        WHERE r.id = ? AND r.user_id = ?
      `, [id, userId]);
      
      if (!recipe || recipe.length === 0) {
        return null;
      }
      
      const recipeData = recipe[0];
      
      // Get ingredients
      const ingredients = await dbManager.executeWithRetry(`
        SELECT * FROM ingredients
        WHERE recipe_id = ?
        ORDER BY order_index
      `, [id]);
      
      recipeData.ingredients = ingredients || [];
      return recipeData;
      
    } catch (error) {
      console.error('Error finding recipe by ID:', error);
      throw error;
    }
  }

  static async update(id, userId, recipeData) {
    const { title, description, category_id, prep_time, cook_time, servings, difficulty, instructions, notes, ingredients } = recipeData;
    
    if (!id || !userId) {
      throw new Error('Recipe ID and User ID are required');
    }
    
    if (!title || !instructions) {
      throw new Error('Title and instructions are required');
    }

    try {
      await dbManager.executeWithRetry('BEGIN TRANSACTION');
      
      // Update recipe
      const updateResult = await dbManager.executeWithRetry(`
        UPDATE recipes
        SET title = ?, description = ?, category_id = ?, prep_time = ?, cook_time = ?, 
            servings = ?, difficulty = ?, instructions = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `, [title, description || null, category_id || null, prep_time || null, cook_time || null, servings || null, difficulty || null, instructions, notes || null, id, userId]);
      
      if (updateResult.changes === 0) {
        await dbManager.executeWithRetry('ROLLBACK');
        return null;
      }
      
      // Delete existing ingredients
      await dbManager.executeWithRetry('DELETE FROM ingredients WHERE recipe_id = ?', [id]);
      
      // Insert new ingredients with validation
      if (ingredients && Array.isArray(ingredients) && ingredients.length > 0) {
        for (let index = 0; index < ingredients.length; index++) {
          const ing = ingredients[index];
          
          if (!ing.name || !ing.amount) {
            throw new Error(`Ingredient at index ${index} is missing required fields (name and amount)`);
          }
          
          await dbManager.executeWithRetry(`
            INSERT INTO ingredients (recipe_id, name, amount, unit, notes, order_index)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [id, ing.name.trim(), ing.amount.trim(), ing.unit || null, ing.notes || null, index]);
        }
      }
      
      await dbManager.executeWithRetry('COMMIT');
      return { id, ...recipeData };
      
    } catch (error) {
      try {
        await dbManager.executeWithRetry('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Rollback failed:', rollbackErr);
      }
      
      console.error('Error updating recipe:', error);
      throw error;
    }
  }

  static async delete(id, userId) {
    if (!id || !userId) {
      throw new Error('Recipe ID and User ID are required');
    }

    try {
      const result = await dbManager.executeWithRetry('DELETE FROM recipes WHERE id = ? AND user_id = ?', [id, userId]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting recipe:', error);
      throw error;
    }
  }

  static async toggleFavorite(id, userId) {
    if (!id || !userId) {
      throw new Error('Recipe ID and User ID are required');
    }

    try {
      const result = await dbManager.executeWithRetry(`
        UPDATE recipes 
        SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `, [id, userId]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error toggling recipe favorite:', error);
      throw error;
    }
  }

  static async updateRating(id, userId, rating) {
    if (!id || !userId) {
      throw new Error('Recipe ID and User ID are required');
    }
    
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    try {
      const result = await dbManager.executeWithRetry(`
        UPDATE recipes 
        SET rating = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `, [rating, id, userId]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating recipe rating:', error);
      throw error;
    }
  }
  // Additional methods needed for tests
  static async findByUserId(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    try {
      const rows = await dbManager.executeWithRetry(`
        SELECT r.*, 
               GROUP_CONCAT(i.name || '|' || i.amount || '|' || COALESCE(i.unit, '')) as ingredients_data
        FROM recipes r 
        LEFT JOIN ingredients i ON r.id = i.recipe_id 
        WHERE r.user_id = ? 
        GROUP BY r.id
        ORDER BY r.created_at DESC
      `, [userId]);
      
      return rows.map(row => ({
        ...row,
        ingredients: row.ingredients_data 
          ? row.ingredients_data.split(',').map(item => {
              const [name, amount, unit] = item.split('|');
              return { name, amount, unit: unit || null };
            })
          : []
      }));
    } catch (error) {
      console.error('Error finding recipes by user ID:', error);
      throw error;
    }
  }

  static async findByIdWithIngredients(id) {
    if (!id) {
      throw new Error('Recipe ID is required');
    }
    
    try {
      const recipeRows = await dbManager.executeWithRetry('SELECT * FROM recipes WHERE id = ?', [id]);
      if (!recipeRows || recipeRows.length === 0) {
        return null;
      }
      
      const recipe = recipeRows[0];
      const ingredientRows = await dbManager.executeWithRetry(
        'SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY order_index',
        [id]
      );
      
      recipe.ingredients = ingredientRows || [];
      return recipe;
    } catch (error) {
      console.error('Error finding recipe with ingredients:', error);
      throw error;
    }
  }

  static async searchByTitle(searchTerm) {
    if (!searchTerm) {
      return [];
    }
    
    try {
      const rows = await dbManager.executeWithRetry(`
        SELECT * FROM recipes 
        WHERE title LIKE ? 
        ORDER BY created_at DESC
      `, [`%${searchTerm}%`]);
      
      return rows || [];
    } catch (error) {
      console.error('Error searching recipes by title:', error);
      throw error;
    }
  }

  static async findFavoritesByUserId(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    try {
      const rows = await dbManager.executeWithRetry(`
        SELECT * FROM recipes 
        WHERE user_id = ? AND is_favorite = 1 
        ORDER BY created_at DESC
      `, [userId]);
      
      return rows || [];
    } catch (error) {
      console.error('Error finding favorite recipes:', error);
      throw error;
    }
  }
}

module.exports = Recipe;