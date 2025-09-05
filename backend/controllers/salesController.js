// controllers/salesController.js - Complete Sales Controller
const Joi = require('joi');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Validation schemas
const saleItemSchema = Joi.object({
  product_id: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).required(),
  unit_price: Joi.number().min(0).precision(2).optional(), // Optional for price override
  discount_percentage: Joi.number().min(0).max(100).default(0)
});

const createSaleSchema = Joi.object({
  items: Joi.array().items(saleItemSchema).min(1).required(),
  payment_method: Joi.string().valid('cash', 'card', 'upi', 'mixed').required(),
  payment_details: Joi.when('payment_method', {
    is: 'mixed',
    then: Joi.array().items(Joi.object({
      method: Joi.string().valid('cash', 'card', 'upi').required(),
      amount: Joi.number().min(0).precision(2).required(),
      reference_number: Joi.string().optional()
    })).min(2).required(),
    otherwise: Joi.array().items(Joi.object({
      method: Joi.string().valid('cash', 'card', 'upi').required(),
      amount: Joi.number().min(0).precision(2).required(),
      reference_number: Joi.string().optional()
    })).max(1).optional()
  }),
  customer_name: Joi.string().max(100).optional(),
  customer_phone: Joi.string().pattern(/^[0-9+\-\s()]*$/).optional(),
  customer_email: Joi.string().email().optional(),
  discount_amount: Joi.number().min(0).precision(2).default(0),
  notes: Joi.string().max(500).optional()
});

const refundSchema = Joi.object({
  items: Joi.array().items(Joi.object({
    sale_item_id: Joi.string().uuid().required(),
    quantity: Joi.number().integer().min(1).required(),
    reason: Joi.string().max(200).required()
  })).min(1).required(),
  refund_method: Joi.string().valid('cash', 'card', 'store_credit').required()
});

// Generate unique sale number
const generateSaleNumber = async () => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Get today's sale count
  const countResult = await db.query(
    'SELECT COUNT(*) as count FROM sales WHERE DATE(sale_date) = CURRENT_DATE'
  );
  
  const saleCount = parseInt(countResult.rows[0].count) + 1;
  return `SL${dateStr}${saleCount.toString().padStart(4, '0')}`;
};

// Calculate GST for an amount
const calculateGST = (amount, gstRate) => {
  return Math.round((amount * gstRate / 100) * 100) / 100;
};

// Create new sale (POS transaction)
const createSale = async (req, res) => {
  try {
    // Validate input
    const { error, value } = createSaleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const {
      items,
      payment_method,
      payment_details,
      customer_name,
      customer_phone,
      customer_email,
      discount_amount,
      notes
    } = value;

    // Start transaction
    const result = await db.transaction(async (client) => {
      // Validate all products exist and have sufficient stock
      const productValidation = [];
      for (const item of items) {
        const productQuery = await client.query(`
          SELECT 
            p.id,
            p.name,
            p.selling_price,
            p.gst_rate,
            p.is_active,
            i.current_quantity
          FROM products p
          LEFT JOIN inventory i ON p.id = i.product_id
          WHERE p.id = $1
        `, [item.product_id]);

        if (productQuery.rows.length === 0 || !productQuery.rows[0].is_active) {
          throw new Error(`Product not found: ${item.product_id}`);
        }

        const product = productQuery.rows[0];

        if (product.current_quantity < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.current_quantity}, Required: ${item.quantity}`);
        }

        productValidation.push({
          ...item,
          product: product,
          unit_price: item.unit_price || product.selling_price // Use override price if provided
        });
      }

      // Calculate totals
      let subtotal = 0;
      let totalGstAmount = 0;
      
      const processedItems = productValidation.map(item => {
        const itemTotal = item.unit_price * item.quantity;
        const discountedTotal = itemTotal * (1 - (item.discount_percentage || 0) / 100);
        const gstAmount = calculateGST(discountedTotal, item.product.gst_rate);
        
        subtotal += discountedTotal;
        totalGstAmount += gstAmount;

        return {
          ...item,
          total_amount: discountedTotal + gstAmount,
          gst_amount: gstAmount,
          line_total: discountedTotal
        };
      });

      const finalSubtotal = subtotal - (discount_amount || 0);
      const finalTotal = finalSubtotal + totalGstAmount;

      // Validate payment amounts
      if (payment_method === 'mixed') {
        const totalPaymentAmount = payment_details.reduce((sum, payment) => sum + payment.amount, 0);
        if (Math.abs(totalPaymentAmount - finalTotal) > 0.01) { // Allow for rounding differences
          throw new Error(`Payment amount (${totalPaymentAmount}) doesn't match total (${finalTotal})`);
        }
      } else if (payment_details && payment_details.length > 0) {
        if (Math.abs(payment_details[0].amount - finalTotal) > 0.01) {
          throw new Error(`Payment amount doesn't match total`);
        }
      }

      // Generate sale number
      const saleNumber = await generateSaleNumber();

      // Create sale record
      const saleResult = await client.query(`
        INSERT INTO sales (
          sale_number, subtotal, gst_amount, discount_amount, total_amount,
          payment_method, customer_name, customer_phone, customer_email,
          cashier_id, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        saleNumber,
        finalSubtotal,
        totalGstAmount,
        discount_amount || 0,
        finalTotal,
        payment_method,
        customer_name,
        customer_phone,
        customer_email,
        req.user.id,
        notes
      ]);

      const sale = saleResult.rows[0];

      // Create sale items
      const saleItems = [];
      for (const item of processedItems) {
        const saleItemResult = await client.query(`
          INSERT INTO sale_items (
            sale_id, product_id, quantity, unit_price, gst_rate, gst_amount, total_amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [
          sale.id,
          item.product_id,
          item.quantity,
          item.unit_price,
          item.product.gst_rate,
          item.gst_amount,
          item.total_amount
        ]);

        saleItems.push(saleItemResult.rows[0]);
      }

      // Create payment records
      const payments = payment_details || [{
        method: payment_method,
        amount: finalTotal,
        reference_number: null
      }];

      for (const payment of payments) {
        await client.query(`
          INSERT INTO payment_details (sale_id, payment_method, amount, reference_number)
          VALUES ($1, $2, $3, $4)
        `, [sale.id, payment.method, payment.amount, payment.reference_number]);
      }

      // Update inventory (this will be handled by the trigger, but we can also do it explicitly)
      for (const item of processedItems) {
        await client.query(`
          UPDATE inventory 
          SET current_quantity = current_quantity - $1, last_updated = CURRENT_TIMESTAMP
          WHERE product_id = $2
        `, [item.quantity, item.product_id]);

        // Create inventory transaction record
        await client.query(`
          INSERT INTO inventory_transactions (
            product_id, transaction_type, quantity_change, reference_id, created_by
          ) VALUES ($1, 'sale', $2, $3, $4)
        `, [item.product_id, -item.quantity, sale.id, req.user.id]);
      }

      return { sale, saleItems, payments };
    });

    res.status(201).json({
      message: 'Sale completed successfully',
      sale: result.sale,
      items: result.saleItems,
      payments: result.payments
    });

  } catch (error) {
    console.error('Create sale error:', error);
    
    if (error.message.includes('Insufficient stock') || error.message.includes('Product not found')) {
      return res.status(400).json({
        error: error.message,
        code: 'STOCK_ERROR'
      });
    }
    
    if (error.message.includes('Payment amount')) {
      return res.status(400).json({
        error: error.message,
        code: 'PAYMENT_ERROR'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Get all sales with pagination and filtering
const getSales = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const cashierId = req.query.cashier_id;
    const status = req.query.status;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramCount = 0;

    // Date range filter
    if (startDate) {
      paramCount++;
      whereClause += ` AND DATE(s.sale_date) >= $${paramCount}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereClause += ` AND DATE(s.sale_date) <= $${paramCount}`;
      queryParams.push(endDate);
    }

    // Cashier filter
    if (cashierId) {
      paramCount++;
      whereClause += ` AND s.cashier_id = $${paramCount}`;
      queryParams.push(cashierId);
    }

    // Status filter
    if (status) {
      paramCount++;
      whereClause += ` AND s.status = $${paramCount}`;
      queryParams.push(status);
    }

    const query = `
      SELECT 
        s.*,
        u.full_name as cashier_name,
        COUNT(si.id) as item_count
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      ${whereClause}
      GROUP BY s.id, u.full_name
      ORDER BY s.sale_date DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(limit, offset);
    const sales = await db.query(query, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT s.id) as total
      FROM sales s
      ${whereClause}
    `;
    
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const totalSales = parseInt(countResult.rows[0].total);

    res.json({
      sales: sales.rows,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(totalSales / limit),
        total_sales: totalSales,
        limit
      }
    });

  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Get single sale by ID with full details
const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get sale details
    const saleQuery = await db.query(`
      SELECT 
        s.*,
        u.full_name as cashier_name,
        u.username as cashier_username
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      WHERE s.id = $1
    `, [id]);

    if (saleQuery.rows.length === 0) {
      return res.status(404).json({
        error: 'Sale not found',
        code: 'SALE_NOT_FOUND'
      });
    }

    const sale = saleQuery.rows[0];

    // Get sale items
    const itemsQuery = await db.query(`
      SELECT 
        si.*,
        p.name as product_name,
        p.sku,
        p.unit
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = $1
      ORDER BY p.name ASC
    `, [id]);

    // Get payment details
    const paymentsQuery = await db.query(`
      SELECT *
      FROM payment_details
      WHERE sale_id = $1
      ORDER BY created_at ASC
    `, [id]);

    res.json({
      sale: {
        ...sale,
        items: itemsQuery.rows,
        payments: paymentsQuery.rows
      }
    });

  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Process refund
const processRefund = async (req, res) => {
  try {
    // Check permissions
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions for refunds',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const { saleId } = req.params;

    // Validate input
    const { error, value } = refundSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const { items, refund_method } = value;

    // Get original sale
    const saleQuery = await db.query(
      'SELECT * FROM sales WHERE id = $1 AND status = $2',
      [saleId, 'completed']
    );

    if (saleQuery.rows.length === 0) {
      return res.status(404).json({
        error: 'Sale not found or cannot be refunded',
        code: 'SALE_NOT_REFUNDABLE'
      });
    }

    const originalSale = saleQuery.rows[0];

    // Process refund in transaction
    const result = await db.transaction(async (client) => {
      let refundTotal = 0;
      const refundedItems = [];

      for (const refundItem of items) {
        // Get original sale item
        const saleItemQuery = await client.query(`
          SELECT 
            si.*,
            p.name as product_name
          FROM sale_items si
          JOIN products p ON si.product_id = p.id
          WHERE si.id = $1 AND si.sale_id = $2
        `, [refundItem.sale_item_id, saleId]);

        if (saleItemQuery.rows.length === 0) {
          throw new Error(`Sale item not found: ${refundItem.sale_item_id}`);
        }

        const saleItem = saleItemQuery.rows[0];

        if (refundItem.quantity > saleItem.quantity) {
          throw new Error(`Cannot refund more than sold for ${saleItem.product_name}`);
        }

        // Calculate refund amount (proportional)
        const refundAmount = (saleItem.total_amount / saleItem.quantity) * refundItem.quantity;
        refundTotal += refundAmount;

        // Update inventory (add back)
        await client.query(`
          UPDATE inventory 
          SET current_quantity = current_quantity + $1, last_updated = CURRENT_TIMESTAMP
          WHERE product_id = $2
        `, [refundItem.quantity, saleItem.product_id]);

        // Create inventory transaction
        await client.query(`
          INSERT INTO inventory_transactions (
            product_id, transaction_type, quantity_change, reason, reference_id, created_by
          ) VALUES ($1, 'return', $2, $3, $4, $5)
        `, [
          saleItem.product_id,
          refundItem.quantity,
          refundItem.reason,
          saleId,
          req.user.id
        ]);

        refundedItems.push({
          ...saleItem,
          refunded_quantity: refundItem.quantity,
          refund_amount: refundAmount,
          reason: refundItem.reason
        });
      }

      // Create refund sale record (negative sale)
      const refundSaleNumber = `RF${originalSale.sale_number}`;
      
      const refundSale = await client.query(`
        INSERT INTO sales (
          sale_number, subtotal, gst_amount, total_amount, payment_method,
          customer_name, customer_phone, customer_email, cashier_id, status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'refunded', $10)
        RETURNING *
      `, [
        refundSaleNumber,
        -refundTotal,
        0, // GST calculation for refunds can be complex, simplified here
        -refundTotal,
        refund_method,
        originalSale.customer_name,
        originalSale.customer_phone,
        originalSale.customer_email,
        req.user.id,
        `Refund for sale ${originalSale.sale_number}`
      ]);

      return { refundSale: refundSale.rows[0], refundedItems, refundTotal };
    });

    res.json({
      message: 'Refund processed successfully',
      refund: result.refundSale,
      refunded_items: result.refundedItems,
      refund_total: result.refundTotal
    });

  } catch (error) {
    console.error('Process refund error:', error);
    
    if (error.message.includes('Sale item not found') || error.message.includes('Cannot refund more')) {
      return res.status(400).json({
        error: error.message,
        code: 'REFUND_ERROR'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Get sales statistics
const getSalesStats = async (req, res) => {
  try {
    const period = req.query.period || 'today'; // today, week, month, year
    const cashierId = req.query.cashier_id;

    let dateFilter = '';
    let queryParams = [];
    let paramCount = 0;

    switch (period) {
      case 'today':
        dateFilter = 'WHERE DATE(s.sale_date) = CURRENT_DATE';
        break;
      case 'week':
        dateFilter = 'WHERE s.sale_date >= CURRENT_DATE - INTERVAL \'7 days\'';
        break;
      case 'month':
        dateFilter = 'WHERE s.sale_date >= CURRENT_DATE - INTERVAL \'30 days\'';
        break;
      case 'year':
        dateFilter = 'WHERE s.sale_date >= CURRENT_DATE - INTERVAL \'365 days\'';
        break;
    }

    if (cashierId) {
      paramCount++;
      dateFilter += paramCount === 1 ? ' WHERE' : ' AND';
      dateFilter += ` s.cashier_id = $${paramCount}`;
      queryParams.push(cashierId);
    }

    // Overall stats
    const overallStatsQuery = await db.query(`
      SELECT 
        COUNT(*) as total_sales,
        SUM(s.total_amount) as total_revenue,
        SUM(s.gst_amount) as total_gst,
        AVG(s.total_amount) as average_sale_amount,
        COUNT(DISTINCT s.customer_phone) as unique_customers
      FROM sales s
      ${dateFilter}
      AND s.status = 'completed'
    `, queryParams);

    // Payment method breakdown
    const paymentStatsQuery = await db.query(`
      SELECT 
        s.payment_method,
        COUNT(*) as count,
        SUM(s.total_amount) as total_amount
      FROM sales s
      ${dateFilter}
      AND s.status = 'completed'
      GROUP BY s.payment_method
      ORDER BY total_amount DESC
    `, queryParams);

    // Top selling products
    const topProductsQuery = await db.query(`
      SELECT 
        p.name,
        p.sku,
        SUM(si.quantity) as total_quantity,
        SUM(si.total_amount) as total_revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      ${dateFilter}
      AND s.status = 'completed'
      GROUP BY p.id, p.name, p.sku
      ORDER BY total_quantity DESC
      LIMIT 10
    `, queryParams);

    // Hourly sales pattern (for today only)
    let hourlySales = [];
    if (period === 'today') {
      const hourlyQuery = await db.query(`
        SELECT 
          EXTRACT(HOUR FROM s.sale_date) as hour,
          COUNT(*) as sale_count,
          SUM(s.total_amount) as total_amount
        FROM sales s
        WHERE DATE(s.sale_date) = CURRENT_DATE
        AND s.status = 'completed'
        GROUP BY EXTRACT(HOUR FROM s.sale_date)
        ORDER BY hour ASC
      `);
      hourlySales = hourlyQuery.rows;
    }

    res.json({
      period,
      stats: {
        overview: overallStatsQuery.rows[0],
        payment_methods: paymentStatsQuery.rows,
        top_products: topProductsQuery.rows,
        hourly_pattern: hourlySales
      }
    });

  } catch (error) {
    console.error('Get sales stats error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Get receipt data for printing
const getReceiptData = async (req, res) => {
  try {
    const { saleId } = req.params;

    // Get complete sale data
    const saleQuery = await db.query(`
      SELECT 
        s.*,
        u.full_name as cashier_name
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      WHERE s.id = $1
    `, [saleId]);

    if (saleQuery.rows.length === 0) {
      return res.status(404).json({
        error: 'Sale not found',
        code: 'SALE_NOT_FOUND'
      });
    }

    const sale = saleQuery.rows[0];

    // Get sale items with product details
    const itemsQuery = await db.query(`
      SELECT 
        si.*,
        p.name as product_name,
        p.sku,
        p.unit
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = $1
      ORDER BY p.name ASC
    `, [saleId]);

    // Get payment details
    const paymentsQuery = await db.query(`
      SELECT *
      FROM payment_details
      WHERE sale_id = $1
      ORDER BY created_at ASC
    `, [saleId]);

    // Get shop settings for receipt header
    const shopSettingsQuery = await db.query(`
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key IN ('shop_name', 'shop_address', 'shop_phone', 'shop_gst_number', 'receipt_footer_message')
    `);

    const shopSettings = {};
    shopSettingsQuery.rows.forEach(setting => {
      shopSettings[setting.setting_key] = setting.setting_value;
    });

    res.json({
      receipt: {
        sale: sale,
        items: itemsQuery.rows,
        payments: paymentsQuery.rows,
        shop: shopSettings,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get receipt data error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Cancel sale (only for pending sales)
const cancelSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Check permissions
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to cancel sales',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Get sale
    const saleQuery = await db.query(
      'SELECT * FROM sales WHERE id = $1',
      [id]
    );

    if (saleQuery.rows.length === 0) {
      return res.status(404).json({
        error: 'Sale not found',
        code: 'SALE_NOT_FOUND'
      });
    }

    const sale = saleQuery.rows[0];

    if (sale.status === 'cancelled') {
      return res.status(400).json({
        error: 'Sale is already cancelled',
        code: 'ALREADY_CANCELLED'
      });
    }

    if (sale.status === 'completed') {
      return res.status(400).json({
        error: 'Cannot cancel completed sale. Use refund instead.',
        code: 'CANNOT_CANCEL_COMPLETED'
      });
    }

    // Cancel sale and restore inventory
    await db.transaction(async (client) => {
      // Update sale status
      await client.query(
        'UPDATE sales SET status = $1, notes = $2 WHERE id = $3',
        ['cancelled', reason || 'Sale cancelled', id]
      );

      // Get sale items to restore inventory
      const itemsQuery = await client.query(
        'SELECT product_id, quantity FROM sale_items WHERE sale_id = $1',
        [id]
      );

      // Restore inventory for each item
      for (const item of itemsQuery.rows) {
        await client.query(
          'UPDATE inventory SET current_quantity = current_quantity + $1 WHERE product_id = $2',
          [item.quantity, item.product_id]
        );

        // Create inventory transaction
        await client.query(`
          INSERT INTO inventory_transactions (
            product_id, transaction_type, quantity_change, reason, reference_id, created_by
          ) VALUES ($1, 'adjustment', $2, $3, $4, $5)
        `, [item.product_id, item.quantity, `Sale cancelled: ${reason}`, id, req.user.id]);
      }
    });

    res.json({
      message: 'Sale cancelled successfully',
      sale_id: id
    });

  } catch (error) {
    console.error('Cancel sale error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Get daily sales summary
const getDailySummary = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const summaryQuery = await db.query(`
      SELECT 
        COUNT(*) as total_sales,
        SUM(total_amount) as total_revenue,
        SUM(gst_amount) as total_gst,
        AVG(total_amount) as average_sale,
        MIN(total_amount) as min_sale,
        MAX(total_amount) as max_sale,
        COUNT(DISTINCT customer_phone) FILTER (WHERE customer_phone IS NOT NULL) as unique_customers
      FROM sales
      WHERE DATE(sale_date) = $1 AND status = 'completed'
    `, [date]);

    const paymentBreakdownQuery = await db.query(`
      SELECT 
        payment_method,
        COUNT(*) as count,
        SUM(total_amount) as amount
      FROM sales
      WHERE DATE(sale_date) = $1 AND status = 'completed'
      GROUP BY payment_method
    `, [date]);

    const hourlyBreakdownQuery = await db.query(`
      SELECT 
        EXTRACT(HOUR FROM sale_date) as hour,
        COUNT(*) as sales_count,
        SUM(total_amount) as revenue
      FROM sales
      WHERE DATE(sale_date) = $1 AND status = 'completed'
      GROUP BY EXTRACT(HOUR FROM sale_date)
      ORDER BY hour
    `, [date]);

    res.json({
      date,
      summary: summaryQuery.rows[0],
      payment_breakdown: paymentBreakdownQuery.rows,
      hourly_breakdown: hourlyBreakdownQuery.rows
    });

  } catch (error) {
    console.error('Get daily summary error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

module.exports = {
  createSale,
  getSales,
  getSaleById,
  processRefund,
  getSalesStats,
  getReceiptData,
  cancelSale,
  getDailySummary
};