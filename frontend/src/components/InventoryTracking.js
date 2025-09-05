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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Alert,
  Snackbar,
  CircularProgress,
  LinearProgress,
  Badge,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  InputAdornment
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  NotificationsActive as AlertIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Assignment as ReportIcon
} from '@mui/icons-material';

// Mock API service
const inventoryAPI = {
  getInventoryOverview: async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      inventory: [
        {
          id: '1',
          name: 'Coca Cola 500ml',
          sku: 'CC500',
          category_name: 'Beverages',
          selling_price: 25.00,
          current_quantity: 150,
          minimum_threshold: 20,
          maximum_capacity: 500,
          stock_status: 'in_stock',
          last_updated: '2024-01-15T14:30:00Z'
        },
        {
          id: '2',
          name: 'Bread - White',
          sku: 'BR001',
          category_name: 'Bakery',
          selling_price: 30.00,
          current_quantity: 8,
          minimum_threshold: 10,
          maximum_capacity: 100,
          stock_status: 'low_stock',
          last_updated: '2024-01-15T12:15:00Z'
        },
        {
          id: '3',
          name: 'Milk 1L',
          sku: 'MLK1L',
          category_name: 'Dairy',
          selling_price: 60.00,
          current_quantity: 0,
          minimum_threshold: 15,
          maximum_capacity: 200,
          stock_status: 'out_of_stock',
          last_updated: '2024-01-15T10:45:00Z'
        },
        {
          id: '4',
          name: 'Rice 5kg Premium',
          sku: 'RC5KG',
          category_name: 'Groceries',
          selling_price: 450.00,
          current_quantity: 75,
          minimum_threshold: 10,
          maximum_capacity: 100,
          stock_status: 'in_stock',
          last_updated: '2024-01-15T09:20:00Z'
        }
      ]
    };
  },

  getInventoryAlerts: async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      alerts: {
        low_stock: [
          {
            id: '2',
            name: 'Bread - White',
            sku: 'BR001',
            current_quantity: 8,
            minimum_threshold: 10
          },
          {
            id: '5',
            name: 'Sugar 1kg',
            sku: 'SG1KG',
            current_quantity: 5,
            minimum_threshold: 20
          }
        ],
        out_of_stock: [
          {
            id: '3',
            name: 'Milk 1L',
            sku: 'MLK1L',
            current_quantity: 0,
            minimum_threshold: 15
          }
        ]
      }
    };
  },

  getInventoryTransactions: async () => {
    await new Promise(resolve => setTimeout(resolve, 800));
    return {
      transactions: [
        {
          id: '1',
          product_name: 'Coca Cola 500ml',
          sku: 'CC500',
          transaction_type: 'sale',
          quantity_change: -5,
          created_at: '2024-01-15T14:30:00Z',
          created_by_name: 'John Cashier',
          reason: null
        },
        {
          id: '2',
          product_name: 'Bread - White',
          sku: 'BR001',
          transaction_type: 'adjustment',
          quantity_change: -2,
          created_at: '2024-01-15T12:15:00Z',
          created_by_name: 'Manager Smith',
          reason: 'Expired items removed'
        },
        {
          id: '3',
          product_name: 'Rice 5kg Premium',
          sku: 'RC5KG',
          transaction_type: 'purchase',
          quantity_change: 25,
          created_at: '2024-01-15T09:20:00Z',
          created_by_name: 'Manager Smith',
          reason: 'New stock received'
        }
      ]
    };
  },

  adjustInventory: async (productId, adjustment) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true, message: 'Inventory adjusted successfully' };
  }
};

const InventoryTracking = () => {
  // State management
  const [inventory, setInventory] = useState([]);
  const [alerts, setAlerts] = useState({ low_stock: [], out_of_stock: [] });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Dialog states
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustmentForm, setAdjustmentForm] = useState({
    type: 'add',
    quantity: '',
    reason: ''
  });

  // Notification state
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Load data
  useEffect(() => {
    loadInventoryData();
  }, []);

  const loadInventoryData = async () => {
    try {
      setLoading(true);
      const [inventoryData, alertsData, transactionsData] = await Promise.all([
        inventoryAPI.getInventoryOverview(),
        inventoryAPI.getInventoryAlerts(),
        inventoryAPI.getInventoryTransactions()
      ]);

      setInventory(inventoryData.inventory);
      setAlerts(alertsData.alerts);
      setTransactions(transactionsData.transactions);
    } catch (error) {
      showNotification('Error loading inventory data', 'error');
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

  // Handle inventory adjustment
  const handleAdjustInventory = async () => {
    try {
      setLoading(true);
      await inventoryAPI.adjustInventory(selectedProduct.id, adjustmentForm);
      showNotification('Inventory adjusted successfully');
      setAdjustDialog(false);
      setAdjustmentForm({ type: 'add', quantity: '', reason: '' });
      loadInventoryData();
    } catch (error) {
      showNotification('Error adjusting inventory', 'error');
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

  const getStockPercentage = (current, max) => {
    if (!max) return 0;
    return Math.min((current / max) * 100, 100);
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'sale': return <TrendingDownIcon color="error" />;
      case 'purchase': return <TrendingUpIcon color="success" />;
      case 'adjustment': return <EditIcon color="primary" />;
      default: return <HistoryIcon />;
    }
  };

  const getTransactionColor = (change) => {
    return change > 0 ? 'success.main' : 'error.main';
  };

  // Filter functions
  const getFilteredInventory = () => {
    return inventory.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !filterStatus || item.stock_status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  };

  // Summary calculations
  const getSummaryData = () => {
    const totalItems = inventory.reduce((sum, item) => sum + item.current_quantity, 0);
    const totalValue = inventory.reduce((sum, item) => sum + (item.current_quantity * item.selling_price), 0);
    const lowStockCount = alerts.low_stock.length;
    const outOfStockCount = alerts.out_of_stock.length;
    const totalAlerts = lowStockCount + outOfStockCount;
    
    return { totalItems, totalValue, lowStockCount, outOfStockCount, totalAlerts };
  };

  const summaryData = getSummaryData();
  const filteredInventory = getFilteredInventory();

  const TabPanel = ({ children, value, index }) => (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <InventoryIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          Inventory Tracking
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitor stock levels, track inventory movements, and manage alerts
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
                    {summaryData.totalItems.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Items
                  </Typography>
                </Box>
                <InventoryIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.7 }} />
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
                <TrendingUpIcon sx={{ fontSize: 40, color: 'success.main', opacity: 0.7 }} />
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
                    {summaryData.lowStockCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Low Stock Items
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
                  <Badge badgeContent={summaryData.totalAlerts} color="error">
                    <Typography variant="h6" color="error">
                      {summaryData.outOfStockCount}
                    </Typography>
                  </Badge>
                  <Typography variant="body2" color="text.secondary">
                    Out of Stock
                  </Typography>
                </Box>
                <AlertIcon sx={{ fontSize: 40, color: 'error.main', opacity: 0.7 }} />
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
          <Tab label="Inventory Overview" />
          <Tab 
            label={
              <Badge badgeContent={summaryData.totalAlerts} color="error">
                Stock Alerts
              </Badge>
            } 
          />
          <Tab label="Transaction History" />
        </Tabs>

        {/* Tab Panels */}
        <TabPanel value={selectedTab} index={0}>
          {/* Toolbar */}
          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search inventory..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <SearchIcon sx={{ mr: 1, color: 'grey.500' }} />
                ),
              }}
              sx={{ minWidth: 250 }}
            />
            
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
              startIcon={<RefreshIcon />}
              onClick={loadInventoryData}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>

          {/* Inventory Table */}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="center">Current Stock</TableCell>
                  <TableCell align="center">Stock Level</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="right">Value</TableCell>
                  <TableCell align="center">Last Updated</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : filteredInventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        No inventory items found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInventory
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Box>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {item.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.sku}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={item.category_name}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Box>
                            <Typography variant="h6" fontWeight="bold">
                              {item.current_quantity}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Min: {item.minimum_threshold}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center" sx={{ width: 150 }}>
                          <Box sx={{ width: '100%' }}>
                            <LinearProgress
                              variant="determinate"
                              value={getStockPercentage(item.current_quantity, item.maximum_capacity)}
                              color={getStockStatusColor(item.stock_status)}
                              sx={{ height: 8, borderRadius: 1, mb: 1 }}
                            />
                            <Typography variant="caption">
                              {item.maximum_capacity ? 
                                `${Math.round(getStockPercentage(item.current_quantity, item.maximum_capacity))}% full` :
                                'No limit'
                              }
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={getStockStatusText(item.stock_status)}
                            color={getStockStatusColor(item.stock_status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold">
                            {formatCurrency(item.current_quantity * item.selling_price)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="caption" color="text.secondary">
                            {new Date(item.last_updated).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedProduct(item);
                              setAdjustDialog(true);
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredInventory.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </TabPanel>

        <TabPanel value={selectedTab} index={1}>
          <Grid container spacing={3}>
            {/* Low Stock Alerts */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon color="warning" />
                    Low Stock Items ({alerts.low_stock.length})
                  </Typography>
                  <List>
                    {alerts.low_stock.length === 0 ? (
                      <ListItem>
                        <ListItemText
                          primary="No low stock items"
                          secondary="All products are above minimum threshold"
                        />
                      </ListItem>
                    ) : (
                      alerts.low_stock.map((item) => (
                        <ListItem key={item.id}>
                          <ListItemText
                            primary={item.name}
                            secondary={`SKU: ${item.sku} | Current: ${item.current_quantity} | Min: ${item.minimum_threshold}`}
                          />
                          <ListItemSecondaryAction>
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              onClick={() => {
                                setSelectedProduct(item);
                                setAdjustDialog(true);
                              }}
                            >
                              Restock
                            </Button>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>

            {/* Out of Stock Alerts */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AlertIcon color="error" />
                    Out of Stock Items ({alerts.out_of_stock.length})
                  </Typography>
                  <List>
                    {alerts.out_of_stock.length === 0 ? (
                      <ListItem>
                        <ListItemText
                          primary="No out of stock items"
                          secondary="All products are available"
                        />
                      </ListItem>
                    ) : (
                      alerts.out_of_stock.map((item) => (
                        <ListItem key={item.id}>
                          <ListItemText
                            primary={item.name}
                            secondary={`SKU: ${item.sku} | Min Required: ${item.minimum_threshold}`}
                          />
                          <ListItemSecondaryAction>
                            <Button
                              size="small"
                              variant="contained"
                              color="error"
                              onClick={() => {
                                setSelectedProduct(item);
                                setAdjustDialog(true);
                              }}
                            >
                              Urgent Restock
                            </Button>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={selectedTab} index={2}>
          <Typography variant="h6" gutterBottom>
            Recent Inventory Transactions
          </Typography>
          
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="center">Quantity Change</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Date & Time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">
                          {transaction.product_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {transaction.sku}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getTransactionIcon(transaction.transaction_type)}
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {transaction.transaction_type}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Typography 
                        variant="body2" 
                        fontWeight="bold"
                        color={getTransactionColor(transaction.quantity_change)}
                      >
                        {transaction.quantity_change > 0 ? '+' : ''}{transaction.quantity_change}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {transaction.reason || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {transaction.created_by_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(transaction.created_at).toLocaleString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Paper>

      {/* Inventory Adjustment Dialog */}
      <Dialog open={adjustDialog} onClose={() => setAdjustDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Adjust Inventory - {selectedProduct?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Adjustment Type</InputLabel>
              <Select
                value={adjustmentForm.type}
                onChange={(e) => setAdjustmentForm({...adjustmentForm, type: e.target.value})}
                label="Adjustment Type"
              >
                <MenuItem value="add">Add Stock</MenuItem>
                <MenuItem value="remove">Remove Stock</MenuItem>
                <MenuItem value="set">Set Stock Level</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Quantity"
              type="number"
              value={adjustmentForm.quantity}
              onChange={(e) => setAdjustmentForm({...adjustmentForm, quantity: e.target.value})}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    {adjustmentForm.type === 'add' ? <AddIcon /> : 
                     adjustmentForm.type === 'remove' ? <RemoveIcon /> : 
                     <EditIcon />}
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Reason"
              multiline
              rows={3}
              value={adjustmentForm.reason}
              onChange={(e) => setAdjustmentForm({...adjustmentForm, reason: e.target.value})}
              placeholder="Reason for inventory adjustment..."
            />

            {selectedProduct && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Current Stock: {selectedProduct.current_quantity} units
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleAdjustInventory}
            disabled={!adjustmentForm.quantity || !adjustmentForm.reason}
          >
            Apply Adjustment
          </Button>
        </DialogActions>
      </Dialog>

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

export default InventoryTracking;