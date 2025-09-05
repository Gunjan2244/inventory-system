// routes/products.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authorizeRoles } = require('../middleware/auth');

const {
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
} = require('../controllers/productController');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_PATH || './uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: process.env.MAX_FILE_SIZE || 5242880 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

// Routes
router.get('/', getProducts);
router.get('/search', searchProduct);
router.get('/export', authorizeRoles('admin', 'manager'), exportProducts);
router.get('/category/:categoryId', getProductsByCategory);
router.get('/barcode/:barcode', getProductByBarcode);
router.get('/:id', getProductById);

router.post('/', authorizeRoles('admin', 'manager'), createProduct);
router.post('/bulk-import', 
  authorizeRoles('admin', 'manager'), 
  upload.single('csvFile'), 
  bulkImportProducts
);

router.put('/:id', authorizeRoles('admin', 'manager'), updateProduct);
router.delete('/:id', authorizeRoles('admin'), deleteProduct);

module.exports = router;