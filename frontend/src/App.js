import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import ProductManagement from './components/ProductManagement';
import InventoryTracking from './components/InventoryTracking';
import PoSSystem from './components/PoSSystem';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#42a5f5',
    },
  },
});

function App() {
  const [currentView, setCurrentView] = useState('products');

  const renderView = () => {
    switch (currentView) {
      case 'products':
        return <ProductManagement />;
      case 'inventory':
        return <InventoryTracking />;
      case 'pos':
        return <PoSSystem />;
      default:
        return <ProductManagement />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        {/* Simple Navigation */}
        <Box sx={{ width: 200, bgcolor: 'primary.main', height: '100vh', p: 2 }}>
          <button onClick={() => setCurrentView('products')}>Products</button>
          <button onClick={() => setCurrentView('inventory')}>Inventory</button>
          <button onClick={() => setCurrentView('pos')}>POS</button>
        </Box>
        
        {/* Main Content */}
        <Box sx={{ flexGrow: 1 }}>
          {renderView()}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;