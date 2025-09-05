-- Shop Inventory Management System Database Schema
-- PostgreSQL Migration Script

-- Enable UUID extension for better ID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for authentication and role management
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'cashier')),
    full_name VARCHAR(100),
    phone VARCHAR(15),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Categories table for product organization
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Suppliers table for distributor management
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(15),
    email VARCHAR(100),
    address TEXT,
    gst_number VARCHAR(15),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products table for product information
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    sku VARCHAR(50) UNIQUE NOT NULL,
    barcode VARCHAR(100) UNIQUE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    selling_price DECIMAL(10,2) NOT NULL,
    gst_rate DECIMAL(5,2) NOT NULL CHECK (gst_rate IN (0, 5, 12, 18, 28)),
    unit VARCHAR(20) DEFAULT 'piece',
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inventory table for stock management
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    current_quantity INTEGER NOT NULL DEFAULT 0,
    minimum_threshold INTEGER DEFAULT 0,
    maximum_capacity INTEGER,
    reserved_quantity INTEGER DEFAULT 0, -- For pending orders
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id)
);

-- Inventory transactions for audit trail
CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('sale', 'purchase', 'adjustment', 'return')),
    quantity_change INTEGER NOT NULL, -- Positive for addition, negative for deduction
    reason VARCHAR(200),
    reference_id UUID, -- Reference to sale_id, purchase_order_id, etc.
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Purchase orders table
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    gst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'received', 'cancelled')),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Purchase order items
CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    gst_rate DECIMAL(5,2) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL
);

-- Sales table for transaction recording
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_number VARCHAR(50) UNIQUE NOT NULL,
    sale_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    subtotal DECIMAL(12,2) NOT NULL,
    gst_amount DECIMAL(12,2) NOT NULL,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'upi', 'mixed')),
    customer_name VARCHAR(100),
    customer_phone VARCHAR(15),
    customer_email VARCHAR(100),
    cashier_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sale items for detailed transaction recording
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    gst_rate DECIMAL(5,2) NOT NULL,
    gst_amount DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL
);

-- Payment details for multi-payment transactions
CREATE TABLE payment_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    payment_method VARCHAR(20) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    reference_number VARCHAR(100), -- For card/UPI transactions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Customer table (optional enhancement)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) UNIQUE,
    email VARCHAR(100),
    address TEXT,
    loyalty_points INTEGER DEFAULT 0,
    total_purchases DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- System settings table
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_cashier ON sales(cashier_id);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);
CREATE INDEX idx_inventory_transactions_product ON inventory_transactions(product_id);
CREATE INDEX idx_inventory_transactions_date ON inventory_transactions(created_at);

-- Create triggers for automatic inventory updates
CREATE OR REPLACE FUNCTION update_inventory_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    -- Update inventory quantity when sale is completed
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Deduct inventory for each item in the sale
        UPDATE inventory 
        SET current_quantity = current_quantity - si.quantity,
            last_updated = CURRENT_TIMESTAMP
        FROM sale_items si
        WHERE si.sale_id = NEW.id AND inventory.product_id = si.product_id;
        
        -- Insert inventory transaction records
        INSERT INTO inventory_transactions (product_id, transaction_type, quantity_change, reference_id, created_by)
        SELECT si.product_id, 'sale', -si.quantity, NEW.id, NEW.cashier_id
        FROM sale_items si
        WHERE si.sale_id = NEW.id;
    END IF;
    
    -- Handle refunds
    IF NEW.status = 'refunded' AND OLD.status = 'completed' THEN
        -- Add back inventory for each item
        UPDATE inventory 
        SET current_quantity = current_quantity + si.quantity,
            last_updated = CURRENT_TIMESTAMP
        FROM sale_items si
        WHERE si.sale_id = NEW.id AND inventory.product_id = si.product_id;
        
        -- Insert inventory transaction records for refund
        INSERT INTO inventory_transactions (product_id, transaction_type, quantity_change, reference_id, created_by)
        SELECT si.product_id, 'return', si.quantity, NEW.id, NEW.cashier_id
        FROM sale_items si
        WHERE si.sale_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_on_sale
    AFTER UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_on_sale();

-- Function to update product updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123 - change in production!)
INSERT INTO users (username, email, password_hash, role, full_name) VALUES 
('admin', 'admin@shop.com', '$2b$10$YourHashedPasswordHere', 'admin', 'System Administrator');

-- Insert default categories
INSERT INTO categories (name, description) VALUES 
('Electronics', 'Electronic items and gadgets'),
('Groceries', 'Food and grocery items'),
('Clothing', 'Clothing and accessories'),
('Home & Garden', 'Home improvement and garden supplies'),
('Health & Beauty', 'Health and beauty products');

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES 
('shop_name', 'My Shop', 'Name of the shop'),
('shop_address', '123 Main Street, City, State', 'Shop address for receipts'),
('shop_phone', '+91-9876543210', 'Shop contact number'),
('shop_gst_number', '22AAAAA0000A1Z5', 'Shop GST registration number'),
('receipt_footer_message', 'Thank you for shopping with us!', 'Footer message on receipts'),
('low_stock_threshold_default', '10', 'Default minimum threshold for low stock alerts');

-- Create view for inventory status with product details
CREATE VIEW inventory_status AS
SELECT 
    p.id,
    p.name,
    p.sku,
    p.barcode,
    p.selling_price,
    p.gst_rate,
    c.name as category_name,
    i.current_quantity,
    i.minimum_threshold,
    i.maximum_capacity,
    i.reserved_quantity,
    CASE 
        WHEN i.current_quantity <= i.minimum_threshold THEN 'low_stock'
        WHEN i.current_quantity = 0 THEN 'out_of_stock'
        ELSE 'in_stock'
    END as stock_status,
    i.last_updated
FROM products p
LEFT JOIN inventory i ON p.id = i.product_id
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.is_active = true;

-- Create view for sales summary
CREATE VIEW sales_summary AS
SELECT 
    s.id,
    s.sale_number,
    s.sale_date,
    s.total_amount,
    s.gst_amount,
    s.payment_method,
    s.customer_name,
    s.status,
    u.full_name as cashier_name,
    COUNT(si.id) as item_count
FROM sales s
LEFT JOIN users u ON s.cashier_id = u.id
LEFT JOIN sale_items si ON s.id = si.sale_id
GROUP BY s.id, u.full_name;

-- Function to generate unique sale numbers
CREATE OR REPLACE FUNCTION generate_sale_number()
RETURNS TEXT AS $$
DECLARE
    today_date TEXT;
    counter INTEGER;
BEGIN
    today_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    
    -- Get count of sales today
    SELECT COUNT(*) + 1 INTO counter
    FROM sales 
    WHERE DATE(sale_date) = CURRENT_DATE;
    
    RETURN 'SL' || today_date || LPAD(counter::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to calculate GST amount
CREATE OR REPLACE FUNCTION calculate_gst(amount DECIMAL, gst_rate DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    RETURN ROUND((amount * gst_rate / 100), 2);
END;
$$ LANGUAGE plpgsql;

-- Function to get low stock alerts
CREATE OR REPLACE FUNCTION get_low_stock_products()
RETURNS TABLE (
    product_id UUID,
    product_name VARCHAR,
    sku VARCHAR,
    current_quantity INTEGER,
    minimum_threshold INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.sku,
        i.current_quantity,
        i.minimum_threshold
    FROM products p
    JOIN inventory i ON p.id = i.product_id
    WHERE i.current_quantity <= i.minimum_threshold
      AND p.is_active = true
    ORDER BY (i.current_quantity::FLOAT / NULLIF(i.minimum_threshold, 0)) ASC;
END;
$$ LANGUAGE plpgsql;