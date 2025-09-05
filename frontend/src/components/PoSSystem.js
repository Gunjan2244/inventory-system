import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Grid, 
  Paper, 
  TextField, 
  Button, 
  Typography, 
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Alert,
  CircularProgress,
  Snackbar,
  InputAdornment,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
  ShoppingCart as CartIcon,
  Payment as PaymentIcon,
  Receipt as ReceiptIcon,
  Search as SearchIcon,
  QrCodeScanner as ScannerIcon,
  Clear as ClearIcon,
  Print as PrintIcon,
  Email as EmailIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

// Import our services
import apiService from '../../../../src/services/api';
import receiptPrinter from '../../../../src/services/receiptPrinter';

export default function PoSSystem() {
  // State management
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [receiptDialog, setReceiptDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [multiplePayments, setMultiplePayments] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const searchInputRef = useRef(null);
  const barcodeInputRef = useRef(null);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    // Focus search input on mount
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }

    // Keyboard shortcuts
    const handleKeyPress = (event) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'f':
            event.preventDefault();
            searchInputRef.current?.focus();
            break;
          case 'Enter':
            if (cart.length > 0) {
              setPaymentDialog(true);
            }
            break;
          case 'Escape':
            clearCart();
            break;
        }
      }
    };
     apiService.getPopularProducts()
      .then(res => setProducts(res.products || []))
      .catch(() => setProducts([]));

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [cart.length]);

  // Show notification
  const showNotification = (message, severity = 'success') => {
    setNotification({
      open: true,
      message,
      severity
    });
  };

  // Search products
  const handleSearch = async (term) => {
    setSearchTerm(term);
    if (term.length > 1) {
      setIsSearching(true);
      try {
        const response = await apiService.searchProducts(term);
        setSearchResults(response.products || []);
      } catch (error) {
        console.error('Search error:', error);
        showNotification('Error searching products', 'error');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  // Handle barcode scan
  const handleBarcodeScan = async (barcode) => {
    if (!barcode.trim()) return;
    
    setLoading(true);
    try {
      const response = await apiService.getProductByBarcode(barcode);
      if (response.product) {
        addToCart(response.product);
        showNotification(`Added ${response.product.name} to cart`);
      } else {
        showNotification('Product not found', 'warning');
      }
    } catch (error) {
      console.error('Barcode scan error:', error);
      showNotification('Product not found for this barcode', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Add product to cart
  const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity < product.current_quantity) {
        setCart(cart.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      } else {
        showNotification('Not enough stock available', 'warning');
      }
    } else {
      if (product.current_quantity > 0) {
        setCart([...cart, { 
          ...product, 
          quantity: 1,
          unit_price: product.selling_price // Allow price override
        }]);
      } else {
        showNotification('Product out of stock', 'error');
      }
    }
    
    // Clear search after adding
    setSearchTerm('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  // Update cart item quantity
  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity === 0) {
      removeFromCart(productId);
      return;
    }

    const product = cart.find(p => p.id === productId);
    if (newQuantity > product.current_quantity) {
      showNotification('Not enough stock available', 'warning');
      return;
    }

    setCart(cart.map(item => 
      item.id === productId 
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  // Update item price (manager/admin only)
  const updatePrice = (productId, newPrice) => {
    setCart(cart.map(item => 
      item.id === productId 
        ? { ...item, unit_price: parseFloat(newPrice) || 0 }
        : item
    ));
  };

  // Remove from cart
  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setCustomerInfo({ name: '', phone: '', email: '' });
  };

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    const discountAmount = (subtotal * discount) / 100;
    const taxableAmount = subtotal - discountAmount;
    const gstAmount = cart.reduce((sum, item) => {
      const itemTotal = (item.unit_price * item.quantity) * (1 - discount/100);
      return sum + (itemTotal * item.gst_rate / 100);
    }, 0);
    const total = taxableAmount + gstAmount;
    
    return { subtotal, discountAmount, gstAmount, total };
  };

  // Handle payment method change
  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);
    if (method === 'mixed') {
      setMultiplePayments([
        { method: 'cash', amount: '' },
        { method: 'card', amount: '' }
      ]);
    } else {
      setMultiplePayments([]);
      setPaymentAmount(calculateTotals().total.toString());
    }
  };

  // Add payment method for mixed payments
  const addPaymentMethod = () => {
    setMultiplePayments([
      ...multiplePayments,
      { method: 'cash', amount: '', reference: '' }
    ]);
  };

  // Update payment in mixed payments
  const updatePaymentMethod = (index, field, value) => {
    const updated = multiplePayments.map((payment, i) => 
      i === index ? { ...payment, [field]: value } : payment
    );
    setMultiplePayments(updated);
  };

  // Remove payment method
  const removePaymentMethod = (index) => {
    setMultiplePayments(multiplePayments.filter((_, i) => i !== index));
  };

  // Validate payment amounts
  const validatePayments = () => {
    const { total } = calculateTotals();
    
    if (paymentMethod === 'mixed') {
      const totalPaid = multiplePayments.reduce((sum, payment) => 
        sum + (parseFloat(payment.amount) || 0), 0
      );
      return Math.abs(totalPaid - total) < 0.01; // Allow for rounding
    } else {
      const paid = parseFloat(paymentAmount) || 0;
      return paid >= total;
    }
  };

  // Process payment
  const processPayment = async () => {
    if (cart.length === 0) {
      showNotification('Cart is empty', 'error');
      return;
    }

    if (!validatePayments()) {
      showNotification('Payment amount is insufficient', 'error');
      return;
    }

    setIsProcessing(true);

    try {
      const { subtotal, discountAmount, gstAmount, total } = calculateTotals();
      
      // Prepare sale data
      const saleData = {
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percentage: 0 // Item-level discount if needed
        })),
        payment_method: paymentMethod,
        payment_details: paymentMethod === 'mixed' ? multiplePayments : [
          {
            method: paymentMethod,
            amount: parseFloat(paymentAmount),
            reference_number: paymentMethod !== 'cash' ? `REF${Date.now()}` : null
          }
        ],
        customer_name: customerInfo.name,
        customer_phone: customerInfo.phone,
        customer_email: customerInfo.email,
        discount_amount: discountAmount,
        notes: ''
      };

      // Create sale via API
      const response = await apiService.createSale(saleData);
      
      setLastSale(response.sale);
      setCart([]);
      setDiscount(0);
      setPaymentDialog(false);
      setReceiptDialog(true);
      setCustomerInfo({ name: '', phone: '', email: '' });
      setPaymentAmount('');
      setMultiplePayments([]);
      
      showNotification('Sale completed successfully!', 'success');
      
    } catch (error) {
      console.error('Payment error:', error);
      showNotification(error.message || 'Payment failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Print receipt
  const handlePrintReceipt = async (format = 'standard') => {
    if (!lastSale) return;
    
    try {
      await receiptPrinter.printReceipt(lastSale.id, format);
      showNotification('Receipt sent to printer', 'success');
    } catch (error) {
      console.error('Print error:', error);
      showNotification('Failed to print receipt', 'error');
    }
  };

  // Email receipt
  const handleEmailReceipt = async () => {
    if (!lastSale || !customerInfo.email) return;
    
    try {
      await receiptPrinter.emailReceipt(lastSale.id, customerInfo.email);
      showNotification('Receipt emailed successfully', 'success');
    } catch (error) {
      console.error('Email error:', error);
      showNotification('Failed to email receipt', 'error');
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount).toFixed(2)}`;
  };

  // Get stock status
  const getStockStatus = (quantity) => {
    if (quantity === 0) return { color: 'error', text: 'Out of Stock' };
    if (quantity <= 10) return { color: 'warning', text: 'Low Stock' };
    return { color: 'success', text: 'In Stock' };
  };

  const { subtotal, discountAmount, gstAmount, total } = calculateTotals();

 
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
      {/* Header */}
      <Paper 
        elevation={2} 
        sx={{ 
          p: 2, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'between',
          background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
          color: 'white'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CartIcon sx={{ fontSize: 32 }} />
          <Typography variant="h5" fontWeight="bold">
            Point of Sale System
          </Typography>
        </Box>
        <Typography variant="h6">
          My Shop - POS Terminal
        </Typography>
      </Paper>

      <Box sx={{ flex: 1, display: 'flex', p: 2, gap: 2 }}>
        {/* Left Panel - Product Search & Categories */}
        <Box sx={{ flex: 2 }}>
          <Paper elevation={2} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Product Search
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  ref={searchInputRef}
                  fullWidth
                  placeholder="Search by name, SKU, or scan barcode..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'grey.500' }} />
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleBarcodeScan}
                  startIcon={<ScannerIcon />}
                  sx={{ minWidth: 120 }}
                >
                  Scan
                </Button>
              </Box>

              {/* Search Results */}
              {isSearching && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              )}

              {searchResults.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Search Results:</Typography>
                  {searchResults.map((product) => {
                    const stockStatus = getStockStatus(product.current_quantity);
                    return (
                      <Card key={product.id} sx={{ mb: 1, cursor: 'pointer' }} onClick={() => addToCart(product)}>
                        <CardContent sx={{ py: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography variant="subtitle2">{product.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {product.sku} | {product.category_name}
                              </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography variant="h6" color="primary">
                                {formatCurrency(product.selling_price)}
                              </Typography>
                              <Chip 
                                label={`${product.current_quantity} ${stockStatus.text}`}
                                color={stockStatus.color}
                                size="small"
                              />
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              )}
            </Box>

            {/* Quick Add Buttons - Popular Products */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Quick Add - Popular Items
              </Typography>
              <Grid container spacing={1}>
                {products.slice(0, 8).map((product) => (
                  <Grid item xs={6} key={product.id}>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => addToCart(product)}
                      sx={{ 
                        height: 80, 
                        display: 'flex', 
                        flexDirection: 'column',
                        textTransform: 'none'
                      }}
                    >
                      <Typography variant="body2" noWrap>
                        {product.name}
                      </Typography>
                      <Typography variant="h6" color="primary">
                        {formatCurrency(product.selling_price)}
                      </Typography>
                    </Button>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Paper>
        </Box>

        {/* Right Panel - Cart & Checkout */}
        <Box sx={{ flex: 1 }}>
          <Paper elevation={2} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Shopping Cart ({cart.length} items)
              </Typography>
              <Button 
                onClick={clearCart} 
                disabled={cart.length === 0}
                startIcon={<ClearIcon />}
                color="error"
                size="small"
              >
                Clear
              </Button>
            </Box>

            {/* Cart Items */}
            <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
              {cart.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4, color: 'grey.500' }}>
                  <CartIcon sx={{ fontSize: 64, mb: 2 }} />
                  <Typography variant="body1">Cart is empty</Typography>
                  <Typography variant="body2">Search and add products to get started</Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell align="center">Qty</TableCell>
                        <TableCell align="right">Price</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cart.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Typography variant="body2">{item.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.sku} | GST: {item.gst_rate}%
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                              <IconButton 
                                size="small" 
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              >
                                <RemoveIcon fontSize="small" />
                              </IconButton>
                              <Typography variant="body2" sx={{ minWidth: 20, textAlign: 'center' }}>
                                {item.quantity}
                              </Typography>
                              <IconButton 
                                size="small" 
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              >
                                <AddIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(item.selling_price)}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(item.selling_price * item.quantity)}
                          </TableCell>
                          <TableCell>
                            <IconButton 
                              size="small" 
                              color="error" 
                              onClick={() => removeFromCart(item.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>

            {/* Totals */}
            <Divider sx={{ my: 2 }} />
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Subtotal:</Typography>
                <Typography variant="body2">{formatCurrency(subtotal)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">GST:</Typography>
                <Typography variant="body2">{formatCurrency(gstAmount)}</Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="h6" fontWeight="bold">Total:</Typography>
                <Typography variant="h6" fontWeight="bold" color="primary">
                  {formatCurrency(total)}
                </Typography>
              </Box>
            </Box>

            {/* Customer Info */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Customer Info (Optional)</Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Customer Name"
                value={customerInfo.name}
                onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                sx={{ mb: 1 }}
              />
              <TextField
                fullWidth
                size="small"
                placeholder="Phone Number"
                value={customerInfo.phone}
                onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
              />
            </Box>

            {/* Checkout Button */}
            <Button
              variant="contained"
              size="large"
              fullWidth
              disabled={cart.length === 0}
              startIcon={<PaymentIcon />}
              onClick={() => setPaymentDialog(true)}
              sx={{ py: 1.5, fontSize: '1.1rem' }}
            >
              Checkout - {formatCurrency(total)}
            </Button>
          </Paper>
        </Box>
      </Box>

      {/* Payment Dialog */}
      <Dialog open={paymentDialog} onClose={() => setPaymentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Complete Payment</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" color="primary" gutterBottom>
              Total Amount: {formatCurrency(total)}
            </Typography>
          </Box>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Payment Method</InputLabel>
            <Select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              label="Payment Method"
            >
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="card">Card</MenuItem>
              <MenuItem value="upi">UPI</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Payment Amount"
            type="number"
            value={paymentAmount || total}
            onChange={(e) => setPaymentAmount(e.target.value)}
            sx={{ mb: 2 }}
          />

          {paymentMethod === 'cash' && paymentAmount && (
            <Alert severity="info">
              Change to return: {formatCurrency(Math.max(0, parseFloat(paymentAmount) - total))}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={processPayment}
            disabled={isProcessing}
            startIcon={isProcessing ? <CircularProgress size={20} /> : <PaymentIcon />}
          >
            {isProcessing ? 'Processing...' : 'Complete Sale'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptDialog} onClose={() => setReceiptDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ textAlign: 'center' }}>
          <ReceiptIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
          <br />
          Sale Completed Successfully!
        </DialogTitle>
        <DialogContent>
          {lastSale && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Sale #{lastSale.sale_number}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {new Date(lastSale.sale_date).toLocaleString()}
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ textAlign: 'left', mb: 2 }}>
                {lastSale.items.map((item, index) => (
                  <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">
                      {item.product_name} x{item.quantity}
                    </Typography>
                    <Typography variant="body2">
                      {formatCurrency(item.total)}
                    </Typography>
                  </Box>
                ))}
              </Box>
              
              <Divider sx={{ mb: 2 }} />
              
              <Typography variant="h6" color="primary">
                Total: {formatCurrency(lastSale.total_amount)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Payment: {lastSale.payment_method.toUpperCase()}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReceiptDialog(false)}>Close</Button>
          <Button variant="contained" startIcon={<ReceiptIcon />}>
            Print Receipt
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
