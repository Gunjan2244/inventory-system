// routes/sales.js
const express = require('express');
const router = express.Router();
const { authorizeRoles } = require('../middleware/auth');

const {
  createSale,
  getSales,
  getSaleById,
  processRefund,
  getSalesStats,
  getReceiptData
} = require('../controllers/salesController');

// Routes
router.get('/', getSales);
router.get('/stats', getSalesStats);
router.get('/:id', getSaleById);
router.get('/:saleId/receipt', getReceiptData);

router.post('/', createSale); // All authenticated users can make sales
router.post('/:saleId/refund', authorizeRoles('admin', 'manager'), processRefund);

module.exports = router;