// routes/categories.js
const express = require('express');
const router = express.Router();
const { authorizeRoles } = require('../middleware/auth');

const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryHierarchy
} = require('../controllers/categoryController');

// Routes
router.get('/', getCategories);
router.get('/hierarchy', getCategoryHierarchy);
router.get('/:id', getCategoryById);

router.post('/', authorizeRoles('admin', 'manager'), createCategory);
router.put('/:id', authorizeRoles('admin', 'manager'), updateCategory);
router.delete('/:id', authorizeRoles('admin'), deleteCategory);

module.exports = router;