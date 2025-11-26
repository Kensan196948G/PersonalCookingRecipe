const { db } = require('../config/database');
const bcrypt = require('bcryptjs');

const seedDatabase = async () => {
  console.log('Seeding database...');
  
  try {
    // Create default user
    const hashedPassword = await bcrypt.hash('demo123', 10);
    
    db.serialize(() => {
      // Insert demo user
      db.run(`
        INSERT OR IGNORE INTO users (username, email, password)
        VALUES ('demo', 'demo@example.com', ?)
      `, [hashedPassword], function(err) {
        if (err) {
          console.error('Error creating demo user:', err);
          return;
        }
        
        const userId = this.lastID || 1;
        
        // Insert categories
        const categories = [
          { name: 'Breakfast', description: 'Morning meals', color: '#FF6B6B' },
          { name: 'Lunch', description: 'Midday meals', color: '#4ECDC4' },
          { name: 'Dinner', description: 'Evening meals', color: '#45B7D1' },
          { name: 'Desserts', description: 'Sweet treats', color: '#F7B731' },
          { name: 'Snacks', description: 'Quick bites', color: '#5F27CD' },
          { name: 'Beverages', description: 'Drinks and smoothies', color: '#00D2D3' },
          { name: 'Salads', description: 'Fresh and healthy', color: '#55A3FF' },
          { name: 'Soups', description: 'Warm and comforting', color: '#FD79A8' }
        ];
        
        categories.forEach(cat => {
          db.run(`
            INSERT OR IGNORE INTO categories (name, description, color)
            VALUES (?, ?, ?)
          `, [cat.name, cat.description, cat.color]);
        });
        
        // Insert sample recipes
        const recipes = [
          {
            title: 'Classic Pancakes',
            description: 'Fluffy homemade pancakes perfect for breakfast',
            category_id: 1,
            prep_time: 10,
            cook_time: 15,
            servings: 4,
            difficulty: 'easy',
            instructions: '1. Mix dry ingredients\n2. Add wet ingredients\n3. Cook on griddle\n4. Serve with syrup',
            is_favorite: true,
            rating: 5
          },
          {
            title: 'Caesar Salad',
            description: 'Classic Caesar salad with homemade dressing',
            category_id: 7,
            prep_time: 15,
            cook_time: 0,
            servings: 2,
            difficulty: 'easy',
            instructions: '1. Prepare lettuce\n2. Make dressing\n3. Add croutons and parmesan\n4. Toss and serve',
            rating: 4
          },
          {
            title: 'Spaghetti Carbonara',
            description: 'Traditional Italian pasta with eggs and bacon',
            category_id: 3,
            prep_time: 10,
            cook_time: 20,
            servings: 4,
            difficulty: 'medium',
            instructions: '1. Cook pasta\n2. Fry bacon\n3. Mix eggs and cheese\n4. Combine all ingredients',
            is_favorite: true,
            rating: 5
          }
        ];
        
        recipes.forEach((recipe, index) => {
          db.run(`
            INSERT OR IGNORE INTO recipes (
              user_id, category_id, title, description, prep_time, cook_time,
              servings, difficulty, instructions, is_favorite, rating
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            userId, recipe.category_id, recipe.title, recipe.description,
            recipe.prep_time, recipe.cook_time, recipe.servings,
            recipe.difficulty, recipe.instructions, recipe.is_favorite || 0,
            recipe.rating || null
          ], function(err) {
            if (!err && this.lastID) {
              // Add sample ingredients
              const recipeId = this.lastID;
              const ingredients = [
                ['2 cups', 'all-purpose flour'],
                ['2', 'eggs'],
                ['1 cup', 'milk'],
                ['2 tbsp', 'sugar'],
                ['1 tsp', 'baking powder']
              ];
              
              if (index === 0) { // Pancakes
                ingredients.forEach((ing, idx) => {
                  db.run(`
                    INSERT OR IGNORE INTO ingredients (recipe_id, amount, name, order_index)
                    VALUES (?, ?, ?, ?)
                  `, [recipeId, ing[0], ing[1], idx]);
                });
              }
            }
          });
        });
        
        console.log('Database seeded successfully!');
        console.log('Demo user credentials:');
        console.log('Email: demo@example.com');
        console.log('Password: demo123');
      });
    });
  } catch (error) {
    console.error('Seeding error:', error);
  }
};

// Run seed if called directly
if (require.main === module) {
  require('../config/database').initialize().then(() => {
    seedDatabase().then(() => {
      setTimeout(() => {
        db.close();
        process.exit(0);
      }, 1000);
    });
  });
}

module.exports = seedDatabase;