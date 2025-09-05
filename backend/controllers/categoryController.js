// controllers/categoryController.js
const Joi = require('joi');
const db = require('../config/database');

// Validation schemas
const categorySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  parent_id: Joi.string().uuid().optional()
});

// Get all categories
const getCategories = async (req, res) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const withStats = req.query.with_stats === 'true';

    let query = `
      SELECT 
        c.*,
        parent.name as parent_name
      FROM categories c
      LEFT JOIN categories parent ON c.parent_id = parent.id
    `;

    if (!includeInactive) {
      query += ' WHERE c.is_active = true';
    }

    query += ' ORDER BY c.name ASC';

    const categories = await db.query(query);

    // If stats requested, get product counts for each category
    if (withStats) {
      const statsQuery = await db.query(`
        SELECT 
          c.id,
          COUNT(p.id) as product_count,
          SUM(CASE WHEN i.current_quantity > 0 THEN 1 ELSE 0 END) as products_in_stock,
          SUM(i.current_quantity) as total_items
        FROM categories c
        LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
        LEFT JOIN inventory i ON p.id = i.product_id
        GROUP BY c.id
      `);

      const statsMap = {};
      statsQuery.rows.forEach(stat => {
        statsMap[stat.id] = {
          product_count: parseInt(stat.product_count),
          products_in_stock: parseInt(stat.products_in_stock),
          total_items: parseInt(stat.total_items) || 0
        };
      });

      // Add stats to categories
      categories.rows = categories.rows.map(category => ({
        ...category,
        stats: statsMap[category.id] || { product_count: 0, products_in_stock: 0, total_items: 0 }
      }));
    }

    res.json({
      categories: categories.rows
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Get single category by ID
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        c.*,
        parent.name as parent_name,
        COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN categories parent ON c.parent_id = parent.id
      LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
      WHERE c.id = $1
      GROUP BY c.id, parent.name
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Category not found',
        code: 'CATEGORY_NOT_FOUND'
      });
    }

    // Get subcategories
    const subcategoriesQuery = await db.query(
      'SELECT * FROM categories WHERE parent_id = $1 AND is_active = true ORDER BY name ASC',
      [id]
    );

    res.json({
      category: {
        ...result.rows[0],
        subcategories: subcategoriesQuery.rows
      }
    });

  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Create new category
const createCategory = async (req, res) => {
  try {
    // Check permissions
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Validate input
    const { error, value } = categorySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { name, description, parent_id } = value;

    // Check if category name already exists at the same level
    let existingCheck;
    if (parent_id) {
      existingCheck = await db.query(
        'SELECT id FROM categories WHERE name = $1 AND parent_id = $2',
        [name, parent_id]
      );
    } else {
      existingCheck = await db.query(
        'SELECT id FROM categories WHERE name = $1 AND parent_id IS NULL',
        [name]
      );
    }

    if (existingCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'Category with this name already exists at this level',
        code: 'DUPLICATE_CATEGORY'
      });
    }

    // Validate parent category exists if provided
    if (parent_id) {
      const parentCheck = await db.query(
        'SELECT id FROM categories WHERE id = $1 AND is_active = true',
        [parent_id]
      );

      if (parentCheck.rows.length === 0) {
        return res.status(400).json({
          error: 'Parent category not found',
          code: 'PARENT_NOT_FOUND'
        });
      }
    }

    // Create category
    const result = await db.query(
      'INSERT INTO categories (name, description, parent_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description, parent_id]
    );

    res.status(201).json({
      message: 'Category created successfully',
      category: result.rows[0]
    });

  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    // Check permissions
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const { id } = req.params;

    // Validate input
    const { error, value } = categorySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { name, description, parent_id } = value;

    // Check if category exists
    const existingCategory = await db.query(
      'SELECT id, parent_id FROM categories WHERE id = $1',
      [id]
    );

    if (existingCategory.rows.length === 0) {
      return res.status(404).json({
        error: 'Category not found',
        code: 'CATEGORY_NOT_FOUND'
      });
    }

    // Prevent circular reference (category can't be its own parent)
    if (parent_id === id) {
      return res.status(400).json({
        error: 'Category cannot be its own parent',
        code: 'CIRCULAR_REFERENCE'
      });
    }

    // Check for duplicate name at the same level (excluding current category)
    let duplicateCheck;
    if (parent_id) {
      duplicateCheck = await db.query(
        'SELECT id FROM categories WHERE name = $1 AND parent_id = $2 AND id != $3',
        [name, parent_id, id]
      );
    } else {
      duplicateCheck = await db.query(
        'SELECT id FROM categories WHERE name = $1 AND parent_id IS NULL AND id != $2',
        [name, id]
      );
    }

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'Category with this name already exists at this level',
        code: 'DUPLICATE_CATEGORY'
      });
    }

    // Validate parent category exists if provided
    if (parent_id) {
      const parentCheck = await db.query(
        'SELECT id FROM categories WHERE id = $1 AND is_active = true',
        [parent_id]
      );

      if (parentCheck.rows.length === 0) {
        return res.status(400).json({
          error: 'Parent category not found',
          code: 'PARENT_NOT_FOUND'
        });
      }

      // Check for circular hierarchy (prevent setting parent that would create a loop)
      const checkCircular = await checkCircularHierarchy(id, parent_id);
      if (checkCircular) {
        return res.status(400).json({
          error: 'This would create a circular hierarchy',
          code: 'CIRCULAR_HIERARCHY'
        });
      }
    }

    // Update category
    const result = await db.query(
      'UPDATE categories SET name = $1, description = $2, parent_id = $3 WHERE id = $4 RETURNING *',
      [name, description, parent_id, id]
    );

    res.json({
      message: 'Category updated successfully',
      category: result.rows[0]
    });

  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Delete category (soft delete)
const deleteCategory = async (req, res) => {
  try {
    // Check permissions
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      });
    }

    const { id } = req.params;

    // Check if category exists
    const existingCategory = await db.query(
      'SELECT id, name FROM categories WHERE id = $1 AND is_active = true',
      [id]
    );

    if (existingCategory.rows.length === 0) {
      return res.status(404).json({
        error: 'Category not found',
        code: 'CATEGORY_NOT_FOUND'
      });
    }

    // Check if category has products
    const productCheck = await db.query(
      'SELECT id FROM products WHERE category_id = $1 AND is_active = true LIMIT 1',
      [id]
    );

    if (productCheck.rows.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete category with products. Move or delete products first.',
        code: 'CATEGORY_HAS_PRODUCTS'
      });
    }

    // Check if category has subcategories
    const subcategoryCheck = await db.query(
      'SELECT id FROM categories WHERE parent_id = $1 AND is_active = true LIMIT 1',
      [id]
    );

    if (subcategoryCheck.rows.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete category with subcategories. Move or delete subcategories first.',
        code: 'CATEGORY_HAS_SUBCATEGORIES'
      });
    }

    // Soft delete category
    await db.query(
      'UPDATE categories SET is_active = false WHERE id = $1',
      [id]
    );

    res.json({
      message: 'Category deleted successfully'
    });

  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Helper function to check for circular hierarchy
const checkCircularHierarchy = async (categoryId, parentId) => {
  try {
    // Get all descendants of the category
    const getDescendants = async (id, visited = new Set()) => {
      if (visited.has(id)) return visited;
      visited.add(id);

      const children = await db.query(
        'SELECT id FROM categories WHERE parent_id = $1 AND is_active = true',
        [id]
      );

      for (const child of children.rows) {
        await getDescendants(child.id, visited);
      }

      return visited;
    };

    const descendants = await getDescendants(categoryId);
    return descendants.has(parentId);
  } catch (error) {
    console.error('Check circular hierarchy error:', error);
    return false;
  }
};

// Get category hierarchy (tree structure)
const getCategoryHierarchy = async (req, res) => {
  try {
    const categories = await db.query(`
      SELECT 
        c.*,
        COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
      WHERE c.is_active = true
      GROUP BY c.id
      ORDER BY c.name ASC
    `);

    // Build tree structure
    const buildTree = (categories, parentId = null) => {
      return categories
        .filter(cat => cat.parent_id === parentId)
        .map(cat => ({
          ...cat,
          children: buildTree(categories, cat.id)
        }));
    };

    const tree = buildTree(categories.rows);

    res.json({
      hierarchy: tree
    });

  } catch (error) {
    console.error('Get category hierarchy error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryHierarchy
};