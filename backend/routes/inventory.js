// routes/inventory.js
const express = require('express');
const router = express.Router();
const { authorizeRoles } = require('../middleware/auth');

const {
  getInventoryOverview,
  getInventoryAlerts,
  adjustInventory,
  bulkAdjustInventory,
  getInventoryTransactions,
  getInventoryStats,
  updateThresholds
} = require('../controllers/inventoryController');

// Routes
router.get('/', getInventoryOverview);
router.get('/alerts', getInventoryAlerts);
router.get('/stats', getInventoryStats);
router.get('/transactions', getInventoryTransactions);

router.put('/:productId/adjust', authorizeRoles('admin', 'manager'), adjustInventory);
router.put('/bulk-adjust', authorizeRoles('admin', 'manager'), bulkAdjustInventory);
router.put('/:productId/thresholds', authorizeRoles('admin', 'manager'), updateThresholds);

module.exports = router;