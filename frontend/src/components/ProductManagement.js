import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  InputAdornment,
  Fab
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Inventory as InventoryIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  QrCode as QrCodeIcon,
  Category as CategoryIcon,
  Store as StoreIcon
} from '@mui/icons-material';

// Mock API service (replace with actual API calls)
const apiService = {
  getProducts: async (params = {}) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      products: [
        {
          id: '1',
          name: 'Coca Cola 500ml',
          sku: 'CC500',
          barcode: '1234567890123',
          category_name: 'Beverages',
          supplier_name: 'Coca Cola Co.',
          selling_price: 25.00,
          purchase_price: 18.00,
          gst_rate: 12,
          current_quantity: 150,
          minimum_threshold: 20,
          maximum_capacity: 500,
          stock_status: 'in_stock',
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          id: '2',
          name: 'Bread - White',
          sku: 'BR001',
          barcode: '2345678901234',
          category_name: 'Bakery',
          supplier_name: 'Local Bakery',
          selling_price: 30.00,
          purchase_price: 22.00,
          gst_rate: 5,
          current_quantity: 8,
          minimum_threshold: 10,
          maximum_capacity: 100,
          stock_status: 'low_stock',
          created_at: '2024-01-14T09:00:00Z'
        },
        {
          id: '3',
          name: 'Milk 1L',
          sku: 'MLK1L',
          barcode: '3456789012345',
          category_name: 'Dairy',
          supplier_name: 'Dairy Fresh',
          selling_price: 60.00,
          purchase_price: 52.00,
          gst_rate: 0,
          current_quantity: 0,
          minimum_threshold: 15,
          maximum_capacity: 200,
          stock_status: 'out_of_stock',
          created_at: '2024-01-13T08:00:00Z'
        },
        {
          id: '4',
          name: 'Rice 5kg Premium',
          sku: 'RC5KG',
          barcode: '4567890123456',
          category_name: 'Groceries',
          supplier_name: 'Grain Suppliers Ltd',
          selling_price: 450.00,
          purchase_price: 380.00,
          gst_rate: 5,
          current_quantity: 75,
          minimum_threshold: 10,
          maximum_capacity: 100,
          stock_status: 'in_stock',
          created_at: '2024-01-12T07:00:00Z'
        }
      ],
      pagination: {
        current_page: 1,
        total_pages: 1,
        total_products: 4
      }
    };
  },

  getCategories: async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      categories: [
        { id: '1', name: 'Beverages', product_count: 15 },
        { id: '2', name: 'Bakery', product_count: 8 },
        { id: '3', name: 'Dairy', product_count: 12 },
        { id: '4', name: 'Groceries', product_count: 25 },
        { id: '5', name: 'Electronics', product_count: 5 }
      ]
    };
  },

  getSuppliers: async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      suppliers: [
        { id: '1', name: 'Coca Cola Co.' },
        { id: '2', name: 'Local Bakery' },
        { id: '3', name: 'Dairy Fresh' },
        { id: '4', name: 'Grain Suppliers Ltd' }
      ]
    };
  },

  createProduct: async (productData) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { id: Date.now().toString(), ...productData };
  },

  updateProduct: async (id, productData) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { id, ...productData };
  },

  deleteProduct: async (id) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true };
  }
};

const ProductManagement = () => {
  // State management
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  
  // Dialog states
  const [productDialog, setProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  
  // Menu state
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Form state
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    category_id: '',
    supplier_id: '',
    purchase_price: '',
    selling_price: '',
    gst_rate: 18,
    minimum_threshold: 0,
    maximum_capacity: '',
    description: ''
  });
  
  // Notification state
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Load initial data
  useEffect(() => {
    loadData();
  }, [page, rowsPerPage, searchTerm, filterCategory, filterStatus]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsData, categoriesData, suppliersData] = await Promise.all([
        apiService.getProducts({
          page: page + 1,
          limit: rowsPerPage,
          search: searchTerm,
          category_id: filterCategory,
          status: filterStatus
        }),
        apiService.getCategories(),
        apiService.getSuppliers()
      ]);
      
      setProducts(productsData.products);
      setCategories(categoriesData.categories);
      setSuppliers(suppliersData.suppliers);
    } catch (error) {
      showNotification('Error loading data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, severity = 'success') => {
    setNotification({
      open: true,
      message,
      severity
    });
  };

  // Product form handlers
  const handleAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      sku: '',
      barcode: '',
      category_id: '',
      supplier_id: '',
      purchase_price: '',
      selling_price: '',
      gst_rate: 18,
      minimum_threshold: 0,
      maximum_capacity: '',
      description: ''
    });
    setProductDialog(true);
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || '',
      category_id: product.category_id || '',
      supplier_id: product.supplier_id || '',
      purchase_price: product.purchase_price.toString(),
      selling_price: product.selling_price.toString(),
      gst_rate: product.gst_rate,
      minimum_threshold: product.minimum_threshold,
      maximum_capacity: product.maximum_capacity || '',
      description: product.description || ''
    });
    setProductDialog(true);
    setAnchorEl(null);
  };

  const handleSaveProduct = async () => {
    try {
      setLoading(true);
      
      if (editingProduct) {
        await apiService.updateProduct(editingProduct.id, productForm);
        showNotification('Product updated successfully');
      } else {
        await apiService.createProduct(productForm);
        showNotification('Product created successfully');
      }
      
      setProductDialog(false);
      loadData();
    } catch (error) {
      showNotification('Error saving product', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async () => {
    try {
      setLoading(true);
      await apiService.deleteProduct(productToDelete.id);
      showNotification('Product deleted successfully');
      setDeleteDialog(false);
      setProductToDelete(null);
      loadData();
    } catch (error) {
      showNotification('Error deleting product', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Utility functions
  const getStockStatusColor = (status) => {
    switch (status) {
      case 'in_stock': return 'success';
      case 'low_stock': return 'warning';
      case 'out_of_stock': return 'error';
      default: return 'default';
    }
  };

  const getStockStatusText = (status) => {
    switch (status) {
      case 'in_stock': return 'In Stock';
      case 'low_stock': return 'Low Stock';
      case 'out_of_stock': return 'Out of Stock';
      default: return 'Unknown';
    }
  };

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount).toFixed(2)}`;
  };

  const generateSKU = () => {
    const sku = 'SKU' + Date.now().toString().slice(-6);
    setProductForm({ ...productForm, sku });
  };

  // Filter functions
  const getFilteredProducts = () => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !filterCategory || product.category_id === filterCategory;
      const matchesStatus = !filterStatus || product.stock_status === filterStatus;
      
      return matchesSearch && matchesCategory && matchesStatus;
    });
  };

  // Summary calculations
  const getSummaryData = () => {
    const totalProducts = products.length;
    const inStock = products.filter(p => p.stock_status === 'in_stock').length;
    const lowStock = products.filter(p => p.stock_status === 'low_stock').length;
    const outOfStock = products.filter(p => p.stock_status === 'out_of_stock').length;
    const totalValue = products.reduce((sum, p) => sum + (p.current_quantity * p.selling_price), 0);
    
    return { totalProducts, inStock, lowStock, outOfStock, totalValue };
  };

  const summaryData = getSummaryData();
  const filteredProducts = getFilteredProducts();

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <InventoryIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          Product Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your inventory, track stock levels, and organize products efficiently
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6" color="primary">
                    {summaryData.totalProducts}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Products
                  </Typography>
                </Box>
                <StoreIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6" color="success.main">
                    {summaryData.inStock}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    In Stock
                  </Typography>
                </Box>
                <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6" color="warning.main">
                    {summaryData.lowStock}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Low Stock
                  </Typography>
                </Box>
                <WarningIcon sx={{ fontSize: 40, color: 'warning.main', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6" color="text.primary">
                    {formatCurrency(summaryData.totalValue)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Value
                  </Typography>
                </Box>
                <TrendingUpIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content */}
      <Paper elevation={2}>
        {/* Tabs */}
        <Tabs
          value={selectedTab}
          onChange={(e, newValue) => setSelectedTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="All Products" />
          <Tab label="Low Stock Alerts" />
          <Tab label="Out of Stock" />
        </Tabs>

        {/* Toolbar */}
        <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              label="Category"
            >
              <MenuItem value="">All Categories</MenuItem>
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              label="Status"
            >
              <MenuItem value="">All Status</MenuItem>
              <MenuItem value="in_stock">In Stock</MenuItem>
              <MenuItem value="low_stock">Low Stock</MenuItem>
              <MenuItem value="out_of_stock">Out of Stock</MenuItem>
            </Select>
          </FormControl>
          
          <Box sx={{ flexGrow: 1 }} />
          
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => showNotification('Bulk import feature coming soon', 'info')}
          >
            Import CSV
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => showNotification('Export feature coming soon', 'info')}
          >
            Export
          </Button>
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddProduct}
          >
            Add Product
          </Button>
        </Box>

        {/* Products Table */}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Product Info</TableCell>
                <TableCell>SKU/Barcode</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Purchase Price</TableCell>
                <TableCell align="right">Selling Price</TableCell>
                <TableCell align="center">GST%</TableCell>
                <TableCell align="center">Stock</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      No products found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((product) => (
                    <TableRow key={product.id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {product.name}
                          </Typography>
                          {product.description && (
                            <Typography variant="caption" color="text.secondary">
                              {product.description}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2">{product.sku}</Typography>
                          {product.barcode && (
                            <Typography variant="caption" color="text.secondary">
                              {product.barcode}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={product.category_name}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(product.purchase_price)}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="bold">
                          {formatCurrency(product.selling_price)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${product.gst_rate}%`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {product.current_quantity}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Min: {product.minimum_threshold}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={getStockStatusText(product.stock_status)}
                          color={getStockStatusColor(product.stock_status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          onClick={(e) => {
                            setAnchorEl(e.currentTarget);
                            setSelectedProduct(product);
                          }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={filteredProducts.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => handleEditProduct(selectedProduct)}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Edit Product
        </MenuItem>
        <MenuItem onClick={() => showNotification('View details feature coming soon', 'info')}>
          <InventoryIcon sx={{ mr: 1 }} fontSize="small" />
          View Details
        </MenuItem>
        <MenuItem onClick={() => showNotification('Generate barcode feature coming soon', 'info')}>
          <QrCodeIcon sx={{ mr: 1 }} fontSize="small" />
          Generate Barcode
        </MenuItem>
        <MenuItem 
          onClick={() => {
            setProductToDelete(selectedProduct);
            setDeleteDialog(true);
            setAnchorEl(null);
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          Delete Product
        </MenuItem>
      </Menu>

      {/* Add/Edit Product Dialog */}
      <Dialog open={productDialog} onClose={() => setProductDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingProduct ? 'Edit Product' : 'Add New Product'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                label="Product Name"
                value={productForm.name}
                onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="SKU"
                value={productForm.sku}
                onChange={(e) => setProductForm({...productForm, sku: e.target.value})}
                required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button size="small" onClick={generateSKU}>
                        Generate
                      </Button>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Barcode"
                value={productForm.barcode}
                onChange={(e) => setProductForm({...productForm, barcode: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={productForm.category_id}
                  onChange={(e) => setProductForm({...productForm, category_id: e.target.value})}
                  label="Category"
                  required
                >
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Supplier</InputLabel>
                <Select
                  value={productForm.supplier_id}
                  onChange={(e) => setProductForm({...productForm, supplier_id: e.target.value})}
                  label="Supplier"
                >
                  <MenuItem value="">Select Supplier</MenuItem>
                  {suppliers.map((supplier) => (
                    <MenuItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>GST Rate</InputLabel>
                <Select
                  value={productForm.gst_rate}
                  onChange={(e) => setProductForm({...productForm, gst_rate: e.target.value})}
                  label="GST Rate"
                >
                  <MenuItem value={0}>0%</MenuItem>
                  <MenuItem value={5}>5%</MenuItem>
                  <MenuItem value={12}>12%</MenuItem>
                  <MenuItem value={18}>18%</MenuItem>
                  <MenuItem value={28}>28%</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Purchase Price"
                type="number"
                value={productForm.purchase_price}
                onChange={(e) => setProductForm({...productForm, purchase_price: e.target.value})}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Selling Price"
                type="number"
                value={productForm.selling_price}
                onChange={(e) => setProductForm({...productForm, selling_price: e.target.value})}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Min Threshold"
                type="number"
                value={productForm.minimum_threshold}
                onChange={(e) => setProductForm({...productForm, minimum_threshold: parseInt(e.target.value) || 0})}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={productForm.description}
                onChange={(e) => setProductForm({...productForm, description: e.target.value})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProductDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSaveProduct}
            disabled={!productForm.name || !productForm.sku || !productForm.selling_price}
          >
            {editingProduct ? 'Update' : 'Add'} Product
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={handleDeleteProduct}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={handleAddProduct}
      >
        <AddIcon />
      </Fab>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert 
          severity={notification.severity} 
          onClose={() => setNotification({ ...notification, open: false })}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ProductManagement;