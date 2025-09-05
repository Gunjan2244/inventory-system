// controllers/productController.js
const Joi = require('joi');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Validation schemas
const productSchema = Joi.object({
  name: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(1000).optional(),
  sku: Joi.string().min(1).max(50).required(),
  barcode: Joi.string().max(100).optional(),
  category_id: Joi.string().uuid().required(),
  supplier_id: Joi.string().uuid().optional(),
  purchase_price: Joi.number().min(0).precision(2).required(),
  selling_price: Joi.number().min(0).precision(2).required(),
  gst_rate: Joi.number().valid(0, 5, 12, 18, 28).required(),
  unit: Joi.string().max(20).default('piece'),
  image_url: Joi.string().uri().optional(),
  minimum_threshold: Joi.number().integer().min(0).default(0),
  maximum_capacity: Joi.number().integer().min(0).optional()
});

const updateProductSchema = productSchema.fork(['sku'], (schema) => schema.optional());

// Get all products with pagination and filtering
const getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const category_id = req.query.category_id;
    const status = req.query.status || 'active';

    let whereClause = 'WHERE p.is_active = true';
    let queryParams = [];
    let paramCount = 0;

    // Add search filter
    if (search) {
      paramCount++;
      whereClause += ` AND (p.name ILIKE $${paramCount} OR p.sku ILIKE $${paramCount} OR p.barcode ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    // Add category filter
    if (category_id) {
      paramCount++;
      whereClause += ` AND p.category_id = $${paramCount}`;
      queryParams.push(category_id);
    }

    // Add status filter
    if (status === 'low_stock') {
      whereClause += ' AND i.current_quantity <= i.minimum_threshold';
    } else if (status === 'out_of_stock') {
      whereClause += ' AND i.current_quantity = 0';
    }

    const query = `
      SELECT 
        p.*,
        c.name as category_name,
        s.name as supplier_name,
        i.current_quantity,
        i.minimum_threshold,
        i.maximum_capacity,
        CASE 
          WHEN i.current_quantity = 0 THEN 'out_of_stock'
          WHEN i.current_quantity <= i.minimum_threshold THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN inventory i ON p.id = i.product_id
      ${whereClause}
      ORDER BY p.name ASC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(limit, offset);

    const products = await db.query(query, queryParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
      ${whereClause.replace(/LIMIT.*|OFFSET.*/g, '')}
    `;
    
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const totalProducts = parseInt(countResult.rows[0].total);

    res.json({
      products: products.rows,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(totalProducts / limit),
        total_products: totalProducts,
        limit
      }
    });

  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Get single product by ID
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        p.*,
        c.name as category_name,
        s.name as supplier_name,
        s.contact_person as supplier_contact,
        i.current_quantity,
        i.minimum_threshold,
        i.maximum_capacity,
        i.reserved_quantity,
        CASE 
          WHEN i.current_quantity = 0 THEN 'out_of_stock'
          WHEN i.current_quantity <= i.minimum_threshold THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.id = $1 AND p.is_active = true
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Product not found',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    res.json({
      product: result.rows[0]
    });

  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Create new product
const createProduct = async (req, res) => {
  try {
    // Check permissions
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Validate input
    const { error, value } = productSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    const {
      name, description, sku, barcode, category_id, supplier_id,
      purchase_price, selling_price, gst_rate, unit, image_url,
      minimum_threshold, maximum_capacity
    } = value;

    // Check if SKU or barcode already exists
    const existingCheck = await db.query(
      'SELECT id FROM products WHERE sku = $1 OR (barcode = $2 AND barcode IS NOT NULL)',
      [sku, barcode]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'Product with this SKU or barcode already exists',
        code: 'DUPLICATE_PRODUCT'
      });
    }

    // Use transaction to create product and inventory record
    const result = await db.transaction(async (client) => {
      // Create product
      const productResult = await client.query(
        `INSERT INTO products (name, description, sku, barcode, category_id, supplier_id, 
         purchase_price, selling_price, gst_rate, unit, image_url) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
         RETURNING *`,
        [name, description, sku, barcode, category_id, supplier_id, 
         purchase_price, selling_price, gst_rate, unit, image_url]
      );

      const product = productResult.rows[0];

      // Create inventory record
      await client.query(
        `INSERT INTO inventory (product_id, current_quantity, minimum_threshold, maximum_capacity) 
         VALUES ($1, 0, $2, $3)`,
        [product.id, minimum_threshold || 0, maximum_capacity]
      );

      return product;
    });

    res.status(201).json({
      message: 'Product created successfully',
      product: result
    });

  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Update product
const updateProduct = async (req, res) => {
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
    const { error, value } = updateProductSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    // Check if product exists
    const existingProduct = await db.query(
      'SELECT id FROM products WHERE id = $1 AND is_active = true',
      [id]
    );

    if (existingProduct.rows.length === 0) {
      return res.status(404).json({
        error: 'Product not found',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    // Check for duplicate SKU/barcode (excluding current product)
    if (value.sku || value.barcode) {
      const duplicateCheck = await db.query(
        'SELECT id FROM products WHERE (sku = $1 OR (barcode = $2 AND barcode IS NOT NULL)) AND id != $3',
        [value.sku, value.barcode, id]
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'Another product with this SKU or barcode already exists',
          code: 'DUPLICATE_PRODUCT'
        });
      }
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 0;

    Object.keys(value).forEach(key => {
      if (value[key] !== undefined) {
        paramCount++;
        updateFields.push(`${key} = $${paramCount}`);
        updateValues.push(value[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update',
        code: 'NO_UPDATE_FIELDS'
      });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(id);

    const updateQuery = `
      UPDATE products 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount + 1} 
      RETURNING *
    `;

    const result = await db.query(updateQuery, updateValues);

    res.json({
      message: 'Product updated successfully',
      product: result.rows[0]
    });

  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Delete product (soft delete)
const deleteProduct = async (req, res) => {
  try {
    // Check permissions - only admin can delete
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED'
      });
    }

    const { id } = req.params;

    // Check if product exists
    const existingProduct = await db.query(
      'SELECT id, name FROM products WHERE id = $1 AND is_active = true',
      [id]
    );

    if (existingProduct.rows.length === 0) {
      return res.status(404).json({
        error: 'Product not found',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    // Check if product has been sold (prevent deletion of products with sales history)
    const salesCheck = await db.query(
      'SELECT id FROM sale_items WHERE product_id = $1 LIMIT 1',
      [id]
    );

    if (salesCheck.rows.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete product with sales history. Product can be deactivated instead.',
        code: 'PRODUCT_HAS_SALES'
      });
    }

    // Soft delete product
    await db.query(
      'UPDATE products SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    res.json({
      message: 'Product deleted successfully'
    });

  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Search products by barcode or SKU (for POS)
const searchProduct = async (req, res) => {
  try {
    const { q } = req.query; // search query

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        error: 'Search query is required',
        code: 'SEARCH_QUERY_REQUIRED'
      });
    }

    const query = `
      SELECT 
        p.*,
        c.name as category_name,
        i.current_quantity,
        i.minimum_threshold,
        CASE 
          WHEN i.current_quantity = 0 THEN 'out_of_stock'
          WHEN i.current_quantity <= i.minimum_threshold THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.is_active = true 
        AND (p.name ILIKE $1 OR p.sku ILIKE $1 OR p.barcode = $2)
      ORDER BY 
        CASE 
          WHEN p.barcode = $2 THEN 1
          WHEN p.sku = $2 THEN 2
          ELSE 3
        END,
        p.name ASC
      LIMIT 10
    `;

    const result = await db.query(query, [`%${q}%`, q]);

    res.json({
      products: result.rows
    });

  } catch (error) {
    console.error('Search product error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Get product by barcode (exact match for POS scanning)
const getProductByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;

    const query = `
      SELECT 
        p.*,
        c.name as category_name,
        i.current_quantity,
        i.minimum_threshold,
        CASE 
          WHEN i.current_quantity = 0 THEN 'out_of_stock'
          WHEN i.current_quantity <= i.minimum_threshold THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.barcode = $1 AND p.is_active = true
    `;

    const result = await db.query(query, [barcode]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Product not found',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    res.json({
      product: result.rows[0]
    });

  } catch (error) {
    console.error('Get product by barcode error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Bulk import products from CSV
const bulkImportProducts = async (req, res) => {
  try {
    // Check permissions
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'CSV file is required',
        code: 'FILE_REQUIRED'
      });
    }

    const csv = require('csv-parser');
    const fs = require('fs');
    const results = [];
    const errors = [];

    // Parse CSV file
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          let successCount = 0;
          let errorCount = 0;

          for (let i = 0; i < results.length; i++) {
            const row = results[i];
            const rowNumber = i + 2; // +2 because CSV starts at row 1 and we skip header

            try {
              // Validate each row
              const { error, value } = productSchema.validate({
                name: row.name?.trim(),
                description: row.description?.trim(),
                sku: row.sku?.trim(),
                barcode: row.barcode?.trim(),
                category_id: row.category_id?.trim(),
                supplier_id: row.supplier_id?.trim(),
                purchase_price: parseFloat(row.purchase_price),
                selling_price: parseFloat(row.selling_price),
                gst_rate: parseFloat(row.gst_rate),
                unit: row.unit?.trim() || 'piece',
                minimum_threshold: parseInt(row.minimum_threshold) || 0,
                maximum_capacity: parseInt(row.maximum_capacity) || null
              });

              if (error) {
                errors.push({
                  row: rowNumber,
                  error: error.details[0].message
                });
                errorCount++;
                continue;
              }

              // Check for duplicates
              const duplicateCheck = await db.query(
                'SELECT id FROM products WHERE sku = $1 OR (barcode = $2 AND barcode IS NOT NULL)',
                [value.sku, value.barcode]
              );

              if (duplicateCheck.rows.length > 0) {
                errors.push({
                  row: rowNumber,
                  error: 'Product with this SKU or barcode already exists'
                });
                errorCount++;
                continue;
              }

              // Create product and inventory record
              await db.transaction(async (client) => {
                const productResult = await client.query(
                  `INSERT INTO products (name, description, sku, barcode, category_id, supplier_id, 
                   purchase_price, selling_price, gst_rate, unit) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
                   RETURNING id`,
                  [value.name, value.description, value.sku, value.barcode, value.category_id, 
                   value.supplier_id, value.purchase_price, value.selling_price, value.gst_rate, value.unit]
                );

                await client.query(
                  'INSERT INTO inventory (product_id, current_quantity, minimum_threshold, maximum_capacity) VALUES ($1, 0, $2, $3)',
                  [productResult.rows[0].id, value.minimum_threshold, value.maximum_capacity]
                );
              });

              successCount++;

            } catch (rowError) {
              console.error(`Row ${rowNumber} error:`, rowError);
              errors.push({
                row: rowNumber,
                error: 'Failed to create product'
              });
              errorCount++;
            }
          }

          // Clean up uploaded file
          fs.unlinkSync(req.file.path);

          res.json({
            message: 'Bulk import completed',
            summary: {
              total_rows: results.length,
              success_count: successCount,
              error_count: errorCount
            },
            errors: errors.length > 0 ? errors : undefined
          });

        } catch (error) {
          console.error('Bulk import processing error:', error);
          fs.unlinkSync(req.file.path);
          res.status(500).json({
            error: 'Failed to process CSV file',
            code: 'CSV_PROCESSING_ERROR'
          });
        }
      })
      .on('error', (error) => {
        console.error('CSV parsing error:', error);
        fs.unlinkSync(req.file.path);
        res.status(400).json({
          error: 'Invalid CSV file format',
          code: 'INVALID_CSV'
        });
      });

  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Export products to CSV
const exportProducts = async (req, res) => {
  try {
    const stringify = require('csv-stringify');

    const query = `
      SELECT 
        p.name,
        p.description,
        p.sku,
        p.barcode,
        c.name as category_name,
        s.name as supplier_name,
        p.purchase_price,
        p.selling_price,
        p.gst_rate,
        p.unit,
        i.current_quantity,
        i.minimum_threshold,
        i.maximum_capacity
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.is_active = true
      ORDER BY p.name ASC
    `;

    const result = await db.query(query);

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=products_export.csv');

    // Create CSV with headers
    const csvHeaders = [
      'Name', 'Description', 'SKU', 'Barcode', 'Category', 'Supplier',
      'Purchase Price', 'Selling Price', 'GST Rate', 'Unit',
      'Current Stock', 'Min Threshold', 'Max Capacity'
    ];

    stringify([csvHeaders, ...result.rows.map(row => [
      row.name,
      row.description || '',
      row.sku,
      row.barcode || '',
      row.category_name || '',
      row.supplier_name || '',
      row.purchase_price,
      row.selling_price,
      row.gst_rate,
      row.unit,
      row.current_quantity,
      row.minimum_threshold,
      row.maximum_capacity || ''
    ])], (err, data) => {
      if (err) {
        console.error('CSV generation error:', err);
        return res.status(500).json({
          error: 'Failed to generate CSV',
          code: 'CSV_GENERATION_ERROR'
        });
      }
      res.send(data);
    });

  } catch (error) {
    console.error('Export products error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Get products by category
const getProductsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const query = `
      SELECT 
        p.*,
        i.current_quantity,
        CASE 
          WHEN i.current_quantity = 0 THEN 'out_of_stock'
          WHEN i.current_quantity <= i.minimum_threshold THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.category_id = $1 AND p.is_active = true
      ORDER BY p.name ASC
      LIMIT $2
    `;

    const result = await db.query(query, [categoryId, limit]);

    res.json({
      products: result.rows
    });

  } catch (error) {
    console.error('Get products by category error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProduct,
  getProductByBarcode,
  bulkImportProducts,
  exportProducts,
  getProductsByCategory
};