// controllers/inventoryController.js
const Joi = require('joi');
const db = require('../config/database');

// Validation schemas
const adjustInventorySchema = Joi.object({
  quantity: Joi.number().integer().required(),
  reason: Joi.string().max(200).required(),
  type: Joi.string().valid('add', 'remove', 'set').required()
});

const bulkAdjustmentSchema = Joi.object({
  adjustments: Joi.array().items(Joi.object({
    product_id: Joi.string().uuid().required(),
    quantity: Joi.number().integer().required(),
    reason: Joi.string().max(200).required(),
    type: Joi.string().valid('add', 'remove', 'set').required()
  })).min(1).required()
});

// Get inventory overview
const getInventoryOverview = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status; // 'low_stock', 'out_of_stock', 'in_stock'
    const search = req.query.search || '';

    let whereClause = 'WHERE p.is_active = true';
    let queryParams = [];
    let paramCount = 0;

    // Add search filter
    if (search) {
      paramCount++;
      whereClause += ` AND (p.name ILIKE $${paramCount} OR p.sku ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    // Add status filter
    if (status === 'low_stock') {
      whereClause += ' AND i.current_quantity <= i.minimum_threshold AND i.current_quantity > 0';
    } else if (status === 'out_of_stock') {
      whereClause += ' AND i.current_quantity = 0';
    } else if (status === 'in_stock') {
      whereClause += ' AND i.current_quantity > i.minimum_threshold';
    }

    const query = `
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.selling_price,
        c.name as category_name,
        i.current_quantity,
        i.minimum_threshold,
        i.maximum_capacity,
        i.reserved_quantity,
        i.last_updated,
        CASE 
          WHEN i.current_quantity = 0 THEN 'out_of_stock'
          WHEN i.current_quantity <= i.minimum_threshold THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status,
        ROUND((i.current_quantity::DECIMAL / NULLIF(i.maximum_capacity, 0) * 100), 2) as capacity_percentage
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN i.current_quantity = 0 THEN 1
          WHEN i.current_quantity <= i.minimum_threshold THEN 2
          ELSE 3
        END,
        p.name ASC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(limit, offset);
    const inventory = await db.query(query, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
      ${whereClause.replace(/LIMIT.*|OFFSET.*/g, '')}
    `;
    
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const totalItems = parseInt(countResult.rows[0].total);

    res.json({
      inventory: inventory.rows,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(totalItems / limit),
        total_items: totalItems,
        limit
      }
    });

  } catch (error) {
    console.error('Get inventory overview error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Get inventory alerts (low stock, out of stock)
const getInventoryAlerts = async (req, res) => {
  try {
    const lowStockQuery = await db.query(`
      SELECT 
        p.id,
        p.name,
        p.sku,
        c.name as category_name,
        i.current_quantity,
        i.minimum_threshold,
        'low_stock' as alert_type
      FROM products p
      JOIN inventory i ON p.id = i.product_id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true 
        AND i.current_quantity <= i.minimum_threshold 
        AND i.current_quantity > 0
      ORDER BY (i.current_quantity::FLOAT / NULLIF(i.minimum_threshold, 0)) ASC
    `);

    const outOfStockQuery = await db.query(`
      SELECT 
        p.id,
        p.name,
        p.sku,
        c.name as category_name,
        i.current_quantity,
        i.minimum_threshold,
        'out_of_stock' as alert_type
      FROM products p
      JOIN inventory i ON p.id = i.product_id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true AND i.current_quantity = 0
      ORDER BY p.name ASC
    `);

    res.json({
      alerts: {
        low_stock: lowStockQuery.rows,
        out_of_stock: outOfStockQuery.rows,
        total_alerts: lowStockQuery.rows.length + outOfStockQuery.rows.length
      }
    });

  } catch (error) {
    console.error('Get inventory alerts error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Adjust inventory for a single product
const adjustInventory = async (req, res) => {
  try {
    // Check permissions
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const { productId } = req.params;

    // Validate input
    const { error, value } = adjustInventorySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { quantity, reason, type } = value;

    // Get current inventory
    const inventoryQuery = await db.query(
      'SELECT current_quantity FROM inventory WHERE product_id = $1',
      [productId]
    );

    if (inventoryQuery.rows.length === 0) {
      return res.status(404).json({
        error: 'Product inventory not found',
        code: 'INVENTORY_NOT_FOUND'
      });
    }

    const currentQuantity = inventoryQuery.rows[0].current_quantity;
    let newQuantity;
    let quantityChange;

    // Calculate new quantity based on adjustment type
    switch (type) {
      case 'add':
        newQuantity = currentQuantity + quantity;
        quantityChange = quantity;
        break;
      case 'remove':
        newQuantity = Math.max(0, currentQuantity - quantity);
        quantityChange = -(currentQuantity - newQuantity);
        break;
      case 'set':
        newQuantity = quantity;
        quantityChange = quantity - currentQuantity;
        break;
      default:
        return res.status(400).json({
          error: 'Invalid adjustment type',
          code: 'INVALID_TYPE'
        });
    }

    // Validate new quantity
    if (newQuantity < 0) {
      return res.status(400).json({
        error: 'Resulting quantity cannot be negative',
        code: 'NEGATIVE_QUANTITY'
      });
    }

    // Update inventory and create transaction record
    await db.transaction(async (client) => {
      // Update inventory
      await client.query(
        'UPDATE inventory SET current_quantity = $1, last_updated = CURRENT_TIMESTAMP WHERE product_id = $2',
        [newQuantity, productId]
      );

      // Create transaction record
      await client.query(
        `INSERT INTO inventory_transactions (product_id, transaction_type, quantity_change, reason, created_by) 
         VALUES ($1, 'adjustment', $2, $3, $4)`,
        [productId, quantityChange, reason, req.user.id]
      );
    });

    // Get updated inventory info
    const updatedInventory = await db.query(`
      SELECT 
        p.name,
        p.sku,
        i.current_quantity,
        i.minimum_threshold,
        CASE 
          WHEN i.current_quantity = 0 THEN 'out_of_stock'
          WHEN i.current_quantity <= i.minimum_threshold THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status
      FROM products p
      JOIN inventory i ON p.id = i.product_id
      WHERE p.id = $1
    `, [productId]);

    res.json({
      message: 'Inventory adjusted successfully',
      adjustment: {
        previous_quantity: currentQuantity,
        new_quantity: newQuantity,
        quantity_change: quantityChange,
        type,
        reason
      },
      inventory: updatedInventory.rows[0]
    });

  } catch (error) {
    console.error('Adjust inventory error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Bulk inventory adjustment
const bulkAdjustInventory = async (req, res) => {
  try {
    // Check permissions
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Validate input
    const { error, value } = bulkAdjustmentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { adjustments } = value;
    const results = [];
    const errors = [];

    // Process each adjustment in a transaction
    await db.transaction(async (client) => {
      for (let i = 0; i < adjustments.length; i++) {
        const adj = adjustments[i];
        
        try {
          // Get current inventory
          const inventoryQuery = await client.query(
            'SELECT current_quantity FROM inventory WHERE product_id = $1',
            [adj.product_id]
          );

          if (inventoryQuery.rows.length === 0) {
            errors.push({
              product_id: adj.product_id,
              error: 'Product inventory not found'
            });
            continue;
          }

          const currentQuantity = inventoryQuery.rows[0].current_quantity;
          let newQuantity;
          let quantityChange;

          // Calculate new quantity
          switch (adj.type) {
            case 'add':
              newQuantity = currentQuantity + adj.quantity;
              quantityChange = adj.quantity;
              break;
            case 'remove':
              newQuantity = Math.max(0, currentQuantity - adj.quantity);
              quantityChange = -(currentQuantity - newQuantity);
              break;
            case 'set':
              newQuantity = adj.quantity;
              quantityChange = adj.quantity - currentQuantity;
              break;
          }

          if (newQuantity < 0) {
            errors.push({
              product_id: adj.product_id,
              error: 'Resulting quantity cannot be negative'
            });
            continue;
          }

          // Update inventory
          await client.query(
            'UPDATE inventory SET current_quantity = $1, last_updated = CURRENT_TIMESTAMP WHERE product_id = $2',
            [newQuantity, adj.product_id]
          );

          // Create transaction record
          await client.query(
            `INSERT INTO inventory_transactions (product_id, transaction_type, quantity_change, reason, created_by) 
             VALUES ($1, 'adjustment', $2, $3, $4)`,
            [adj.product_id, quantityChange, adj.reason, req.user.id]
          );

          results.push({
            product_id: adj.product_id,
            previous_quantity: currentQuantity,
            new_quantity: newQuantity,
            quantity_change: quantityChange,
            success: true
          });

        } catch (adjError) {
          console.error(`Adjustment error for product ${adj.product_id}:`, adjError);
          errors.push({
            product_id: adj.product_id,
            error: 'Failed to adjust inventory'
          });
        }
      }
    });

    res.json({
      message: 'Bulk inventory adjustment completed',
      summary: {
        total_adjustments: adjustments.length,
        successful: results.length,
        failed: errors.length
      },
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Bulk adjust inventory error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Get inventory transactions (audit trail)
const getInventoryTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const productId = req.query.product_id;
    const type = req.query.type;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramCount = 0;

    if (productId) {
      paramCount++;
      whereClause += ` AND it.product_id = $${paramCount}`;
      queryParams.push(productId);
    }

    if (type) {
      paramCount++;
      whereClause += ` AND it.transaction_type = $${paramCount}`;
      queryParams.push(type);
    }

    const query = `
      SELECT 
        it.*,
        p.name as product_name,
        p.sku,
        u.full_name as created_by_name,
        s.sale_number,
        po.order_number
      FROM inventory_transactions it
      JOIN products p ON it.product_id = p.id
      LEFT JOIN users u ON it.created_by = u.id
      LEFT JOIN sales s ON it.reference_id = s.id AND it.transaction_type IN ('sale', 'return')
      LEFT JOIN purchase_orders po ON it.reference_id = po.id AND it.transaction_type = 'purchase'
      ${whereClause}
      ORDER BY it.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(limit, offset);
    const transactions = await db.query(query, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM inventory_transactions it
      ${whereClause.replace(/LIMIT.*|OFFSET.*/g, '')}
    `;
    
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const totalTransactions = parseInt(countResult.rows[0].total);

    res.json({
      transactions: transactions.rows,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(totalTransactions / limit),
        total_transactions: totalTransactions,
        limit
      }
    });

  } catch (error) {
    console.error('Get inventory transactions error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Get inventory summary statistics
const getInventoryStats = async (req, res) => {
  try {
    const statsQuery = await db.query(`
      SELECT 
        COUNT(*) as total_products,
        SUM(CASE WHEN i.current_quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_count,
        SUM(CASE WHEN i.current_quantity <= i.minimum_threshold AND i.current_quantity > 0 THEN 1 ELSE 0 END) as low_stock_count,
        SUM(CASE WHEN i.current_quantity > i.minimum_threshold THEN 1 ELSE 0 END) as in_stock_count,
        SUM(i.current_quantity * p.purchase_price) as total_inventory_value,
        SUM(i.current_quantity * p.selling_price) as total_selling_value
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.is_active = true
    `);

    const categoryStatsQuery = await db.query(`
      SELECT 
        c.name as category_name,
        COUNT(p.id) as product_count,
        SUM(i.current_quantity) as total_quantity,
        SUM(i.current_quantity * p.selling_price) as category_value
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
      LEFT JOIN inventory i ON p.id = i.product_id
      GROUP BY c.id, c.name
      HAVING COUNT(p.id) > 0
      ORDER BY category_value DESC
    `);

    const recentTransactionsQuery = await db.query(`
      SELECT 
        it.transaction_type,
        COUNT(*) as count,
        SUM(ABS(it.quantity_change)) as total_quantity
      FROM inventory_transactions it
      WHERE it.created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY it.transaction_type
      ORDER BY total_quantity DESC
    `);

    res.json({
      overview: statsQuery.rows[0],
      by_category: categoryStatsQuery.rows,
      recent_activity: recentTransactionsQuery.rows
    });

  } catch (error) {
    console.error('Get inventory stats error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Update inventory thresholds
const updateThresholds = async (req, res) => {
  try {
    // Check permissions
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const { productId } = req.params;
    const { minimum_threshold, maximum_capacity } = req.body;

    // Validate input
    if (minimum_threshold !== undefined && (minimum_threshold < 0 || !Number.isInteger(minimum_threshold))) {
      return res.status(400).json({
        error: 'Minimum threshold must be a non-negative integer',
        code: 'INVALID_THRESHOLD'
      });
    }

    if (maximum_capacity !== undefined && (maximum_capacity < 0 || !Number.isInteger(maximum_capacity))) {
      return res.status(400).json({
        error: 'Maximum capacity must be a non-negative integer',
        code: 'INVALID_CAPACITY'
      });
    }

    // Check if product exists
    const productCheck = await db.query(
      'SELECT id FROM products WHERE id = $1 AND is_active = true',
      [productId]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Product not found',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 0;

    if (minimum_threshold !== undefined) {
      paramCount++;
      updateFields.push(`minimum_threshold = ${paramCount}`);
      updateValues.push(minimum_threshold);
    }

    if (maximum_capacity !== undefined) {
      paramCount++;
      updateFields.push(`maximum_capacity = ${paramCount}`);
      updateValues.push(maximum_capacity);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update',
        code: 'NO_UPDATE_FIELDS'
      });
    }

    updateFields.push('last_updated = CURRENT_TIMESTAMP');
    updateValues.push(productId);

    const updateQuery = `
      UPDATE inventory 
      SET ${updateFields.join(', ')} 
      WHERE product_id = ${paramCount + 1} 
      RETURNING *
    `;

    const result = await db.query(updateQuery, updateValues);

    res.json({
      message: 'Inventory thresholds updated successfully',
      inventory: result.rows[0]
    });

  } catch (error) {
    console.error('Update thresholds error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

module.exports = {
  getInventoryOverview,
  getInventoryAlerts,
  adjustInventory,
  bulkAdjustInventory,
  getInventoryTransactions,
  getInventoryStats,
  updateThresholds
};