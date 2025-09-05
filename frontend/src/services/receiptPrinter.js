// services/receiptPrinter.js - Receipt Printing Service
import apiService from './api';

class ReceiptPrinterService {
  constructor() {
    this.shopInfo = {
      name: 'My Shop',
      address: '123 Main Street, City, State',
      phone: '+91-9876543210',
      gst: '22AAAAA0000A1Z5',
      email: 'info@myshop.com'
    };
  }

  // Format currency for printing
  formatCurrency(amount) {
    return `₹${parseFloat(amount).toFixed(2)}`;
  }

  // Format date for printing
  formatDate(date) {
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Generate receipt HTML
  generateReceiptHTML(receiptData) {
    const { sale, items, payments, shop } = receiptData;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt - ${sale.sale_number}</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            margin: 0;
            padding: 10px;
            background: white;
            color: black;
          }
          .receipt {
            max-width: 300px;
            margin: 0 auto;
          }
          .center { text-align: center; }
          .left { text-align: left; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .large { font-size: 14px; }
          .separator {
            border-top: 1px dashed #000;
            margin: 10px 0;
            padding-top: 10px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
          }
          .item-row {
            margin: 3px 0;
          }
          .item-name {
            font-weight: bold;
          }
          .item-details {
            font-size: 11px;
            color: #333;
          }
          .total-section {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #000;
          }
          .grand-total {
            font-size: 14px;
            font-weight: bold;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            padding: 5px 0;
            margin: 5px 0;
          }
          .footer {
            margin-top: 15px;
            font-size: 11px;
          }
          @media print {
            body { margin: 0; padding: 5px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <!-- Header -->
          <div class="center">
            <div class="bold large">${shop?.shop_name || this.shopInfo.name}</div>
            <div>${shop?.shop_address || this.shopInfo.address}</div>
            <div>Phone: ${shop?.shop_phone || this.shopInfo.phone}</div>
            ${shop?.shop_gst_number || this.shopInfo.gst ? 
              `<div>GST No: ${shop?.shop_gst_number || this.shopInfo.gst}</div>` : ''}
          </div>
          
          <div class="separator"></div>
          
          <!-- Sale Info -->
          <div class="center">
            <div class="bold">CASH RECEIPT</div>
            <div>Bill No: ${sale.sale_number}</div>
            <div>Date: ${this.formatDate(sale.sale_date)}</div>
            ${sale.customer_name ? `<div>Customer: ${sale.customer_name}</div>` : ''}
            ${sale.customer_phone ? `<div>Phone: ${sale.customer_phone}</div>` : ''}
          </div>
          
          <div class="separator"></div>
          
          <!-- Items -->
          <div>
            ${items.map(item => `
              <div class="item-row">
                <div class="item-name">${item.product_name}</div>
                <div class="item-details">
                  ${item.sku ? `SKU: ${item.sku} | ` : ''}${item.unit || 'Qty'}: ${item.quantity} @ ${this.formatCurrency(item.unit_price)}
                  ${item.gst_rate > 0 ? ` (${item.gst_rate}% GST)` : ''}
                </div>
                <div class="row">
                  <span>Amount</span>
                  <span class="bold">${this.formatCurrency(item.total_amount)}</span>
                </div>
              </div>
            `).join('')}
          </div>
          
          <!-- Totals -->
          <div class="total-section">
            <div class="row">
              <span>Subtotal</span>
              <span>${this.formatCurrency(sale.subtotal)}</span>
            </div>
            ${sale.discount_amount > 0 ? `
              <div class="row">
                <span>Discount</span>
                <span>-${this.formatCurrency(sale.discount_amount)}</span>
              </div>
            ` : ''}
            <div class="row">
              <span>GST</span>
              <span>${this.formatCurrency(sale.gst_amount)}</span>
            </div>
            
            <div class="grand-total">
              <div class="row">
                <span>TOTAL</span>
                <span>${this.formatCurrency(sale.total_amount)}</span>
              </div>
            </div>
          </div>
          
          <!-- Payment Details -->
          <div class="separator"></div>
          <div>
            <div class="bold center">PAYMENT DETAILS</div>
            ${payments.map(payment => `
              <div class="row">
                <span>${payment.payment_method.toUpperCase()}</span>
                <span>${this.formatCurrency(payment.amount)}</span>
              </div>
              ${payment.reference_number ? 
                `<div class="item-details">Ref: ${payment.reference_number}</div>` : ''}
            `).join('')}
          </div>
          
          <!-- Footer -->
          <div class="separator"></div>
          <div class="footer center">
            <div>Thank you for shopping with us!</div>
            <div>${shop?.receipt_footer_message || 'Visit us again soon!'}</div>
            <div style="margin-top: 10px;">
              ${shop?.shop_email || this.shopInfo.email}
            </div>
          </div>
          
          <!-- Print Controls (hidden in print) -->
          <div class="no-print" style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px;">
              Print Receipt
            </button>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 14px; margin-left: 10px;">
              Close
            </button>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate thermal printer format (80mm)
  generateThermalReceiptHTML(receiptData) {
    const { sale, items, payments, shop } = receiptData;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt - ${sale.sale_number}</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            line-height: 1.2;
            margin: 0;
            padding: 5px;
            background: white;
            color: black;
            width: 72mm; /* 80mm thermal paper with margins */
          }
          .center { text-align: center; }
          .left { text-align: left; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .large { font-size: 13px; }
          .small { font-size: 10px; }
          .separator {
            border-top: 1px dashed #000;
            margin: 5px 0;
          }
          .double-line {
            border-top: 2px solid #000;
            margin: 5px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          .item-table td {
            padding: 1px 0;
            vertical-align: top;
          }
          .qty-price {
            text-align: right;
          }
          .total-table {
            margin-top: 5px;
          }
          .total-table td {
            padding: 1px 0;
          }
          @media print {
            body { margin: 0; padding: 0; }
            @page { 
              size: 80mm auto;
              margin: 0;
            }
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="center">
          <div class="bold large">${shop?.shop_name || this.shopInfo.name}</div>
          <div class="small">${shop?.shop_address || this.shopInfo.address}</div>
          <div class="small">Ph: ${shop?.shop_phone || this.shopInfo.phone}</div>
          ${shop?.shop_gst_number || this.shopInfo.gst ? 
            `<div class="small">GST: ${shop?.shop_gst_number || this.shopInfo.gst}</div>` : ''}
        </div>
        
        <div class="separator"></div>
        
        <!-- Sale Info -->
        <div class="center">
          <div class="bold">CASH RECEIPT</div>
        </div>
        
        <table class="item-table">
          <tr>
            <td>Bill No:</td>
            <td class="right">${sale.sale_number}</td>
          </tr>
          <tr>
            <td>Date:</td>
            <td class="right">${this.formatDate(sale.sale_date)}</td>
          </tr>
          ${sale.customer_name ? `
            <tr>
              <td>Customer:</td>
              <td class="right">${sale.customer_name}</td>
            </tr>
          ` : ''}
        </table>
        
        <div class="separator"></div>
        
        <!-- Items -->
        <table class="item-table">
          ${items.map(item => `
            <tr>
              <td colspan="2" class="bold">${item.product_name}</td>
            </tr>
            <tr>
              <td class="small">${item.quantity} x ${this.formatCurrency(item.unit_price)}</td>
              <td class="right">${this.formatCurrency(item.total_amount)}</td>
            </tr>
            ${item.gst_rate > 0 ? `
              <tr>
                <td class="small">GST ${item.gst_rate}%</td>
                <td class="right small">${this.formatCurrency(item.gst_amount)}</td>
              </tr>
            ` : ''}
          `).join('')}
        </table>
        
        <div class="separator"></div>
        
        <!-- Totals -->
        <table class="total-table">
          <tr>
            <td>Subtotal:</td>
            <td class="right">${this.formatCurrency(sale.subtotal)}</td>
          </tr>
          ${sale.discount_amount > 0 ? `
            <tr>
              <td>Discount:</td>
              <td class="right">-${this.formatCurrency(sale.discount_amount)}</td>
            </tr>
          ` : ''}
          <tr>
            <td>Total GST:</td>
            <td class="right">${this.formatCurrency(sale.gst_amount)}</td>
          </tr>
        </table>
        
        <div class="double-line"></div>
        
        <table class="total-table">
          <tr class="bold large">
            <td>TOTAL:</td>
            <td class="right">${this.formatCurrency(sale.total_amount)}</td>
          </tr>
        </table>
        
        <div class="separator"></div>
        
        <!-- Payment -->
        <table class="total-table">
          ${payments.map(payment => `
            <tr>
              <td>${payment.payment_method.toUpperCase()}:</td>
              <td class="right">${this.formatCurrency(payment.amount)}</td>
            </tr>
          `).join('')}
        </table>
        
        <div class="separator"></div>
        
        <!-- Footer -->
        <div class="center small">
          <div>Thank you for shopping!</div>
          <div>${shop?.receipt_footer_message || 'Visit us again!'}</div>
          <div style="margin-top: 5px;">
            ${shop?.shop_email || this.shopInfo.email}
          </div>
          <div style="margin-top: 5px;">
            Powered by Shop Management System
          </div>
        </div>
      </body>
      </html>
    `;
  }

  
      
  // Print receipt in new window
  async printReceipt(saleId, format = 'standard') {
    try {
      // Get receipt data from API
      const receiptData = await apiService.getReceiptData(saleId);
      
      // Generate HTML based on format
      const html = format === 'thermal' 
        ? this.generateThermalReceiptHTML(receiptData.receipt)
        : this.generateReceiptHTML(receiptData.receipt);
      
      // Open new window and print
      const printWindow = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
      printWindow.document.write(html);
      printWindow.document.close();
      
      // Auto-print after content loads
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 100);
      };
      
      return { success: true, message: 'Receipt sent to printer' };
    } catch (error) {
      console.error('Print receipt error:', error);
      throw new Error('Failed to print receipt: ' + error.message);
    }
  }

  // Print receipt directly (for thermal printers)
  async printReceiptDirect(saleId) {
    try {
      const receiptData = await apiService.getReceiptData(saleId);
      
      // Generate ESC/POS commands for thermal printer
      const escPosCommands = this.generateESCPOSCommands(receiptData.receipt);
      
      // Send to thermal printer (requires backend endpoint)
      const response = await fetch(`${process.env.REACT_APP_API_URL}/print/thermal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          commands: escPosCommands,
          printer_ip: process.env.REACT_APP_THERMAL_PRINTER_IP
        })
      });
      
      if (!response.ok) {
        throw new Error('Thermal printer not responding');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Direct print error:', error);
      // Fallback to window print
      return this.printReceipt(saleId, 'thermal');
    }
  }

  // Generate ESC/POS commands for thermal printers
  generateESCPOSCommands(receiptData) {
    const { sale, items, payments, shop } = receiptData;
    const ESC = '\x1B';
    const commands = [];
    
    // Initialize printer
    commands.push(ESC + '@'); // Initialize
    commands.push(ESC + 'a' + '\x01'); // Center alignment
    
    // Header
    commands.push(ESC + '!' + '\x08'); // Double height
    commands.push(shop?.shop_name || this.shopInfo.name);
    commands.push('\n');
    
    commands.push(ESC + '!' + '\x00'); // Normal size
    commands.push(shop?.shop_address || this.shopInfo.address);
    commands.push('\n');
    commands.push(`Phone: ${shop?.shop_phone || this.shopInfo.phone}`);
    commands.push('\n');
    
    if (shop?.shop_gst_number || this.shopInfo.gst) {
      commands.push(`GST: ${shop?.shop_gst_number || this.shopInfo.gst}`);
      commands.push('\n');
    }
    
    // Separator
    commands.push('--------------------------------\n');
    
    // Sale info
    commands.push('CASH RECEIPT\n');
    commands.push(`Bill No: ${sale.sale_number}\n`);
    commands.push(`Date: ${this.formatDate(sale.sale_date)}\n`);
    
    if (sale.customer_name) {
      commands.push(`Customer: ${sale.customer_name}\n`);
    }
    
    commands.push('--------------------------------\n');
    
    // Items
    commands.push(ESC + 'a' + '\x00'); // Left alignment
    
    items.forEach(item => {
      commands.push(ESC + '!' + '\x08'); // Bold
      commands.push(item.product_name);
      commands.push('\n');
      
      commands.push(ESC + '!' + '\x00'); // Normal
      const itemLine = `${item.quantity} x ${this.formatCurrency(item.unit_price)}`;
      const spaces = ' '.repeat(Math.max(1, 32 - itemLine.length - this.formatCurrency(item.total_amount).length));
      commands.push(itemLine + spaces + this.formatCurrency(item.total_amount));
      commands.push('\n');
      
      if (item.gst_rate > 0) {
        commands.push(`GST ${item.gst_rate}%: ${this.formatCurrency(item.gst_amount)}\n`);
      }
    });
    
    commands.push('--------------------------------\n');
    
    // Totals
    const addTotal = (label, amount) => {
      const spaces = ' '.repeat(Math.max(1, 32 - label.length - amount.length));
      commands.push(label + spaces + amount + '\n');
    };
    
    addTotal('Subtotal:', this.formatCurrency(sale.subtotal));
    
    if (sale.discount_amount > 0) {
      addTotal('Discount:', `-${this.formatCurrency(sale.discount_amount)}`);
    }
    
    addTotal('Total GST:', this.formatCurrency(sale.gst_amount));
    
    commands.push('================================\n');
    
    // Grand total
    commands.push(ESC + '!' + '\x18'); // Double width and height
    const totalLine = `TOTAL: ${this.formatCurrency(sale.total_amount)}`;
    commands.push(ESC + 'a' + '\x01'); // Center
    commands.push(totalLine);
    commands.push('\n');
    
    commands.push(ESC + '!' + '\x00'); // Normal size
    commands.push('================================\n');
    
    // Payment details
    commands.push(ESC + 'a' + '\x00'); // Left alignment
    payments.forEach(payment => {
      addTotal(`${payment.payment_method.toUpperCase()}:`, this.formatCurrency(payment.amount));
    });
    
    commands.push('--------------------------------\n');
    
    // Footer
    commands.push(ESC + 'a' + '\x01'); // Center alignment
    commands.push('Thank you for shopping!\n');
    commands.push(shop?.receipt_footer_message || 'Visit us again!\n');
    commands.push('\n');
    commands.push(shop?.shop_email || this.shopInfo.email);
    commands.push('\n\n');
    
    // Cut paper
    commands.push(ESC + 'd' + '\x03'); // Feed 3 lines
    commands.push('\x1D' + 'V' + '\x42' + '\x00'); // Full cut
    
    return commands.join('');
  }

  // Save receipt as PDF
  async saveReceiptAsPDF(saleId) {
    try {
      const receiptData = await apiService.getReceiptData(saleId);
      const html = this.generateReceiptHTML(receiptData.receipt);
      
      // Create a temporary window for PDF generation
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      printWindow.document.write(html);
      printWindow.document.close();
      
      // Wait for content to load then trigger save as PDF
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          // Note: Modern browsers will show print dialog with save as PDF option
        }, 100);
      };
      
      return { success: true, message: 'Receipt ready for PDF save' };
    } catch (error) {
      console.error('Save PDF error:', error);
      throw new Error('Failed to generate PDF: ' + error.message);
    }
  }

  // Email receipt
  async emailReceipt(saleId, emailAddress) {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/receipts/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sale_id: saleId,
          email: emailAddress
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send email');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Email receipt error:', error);
      throw new Error('Failed to email receipt: ' + error.message);
    }
  }

  // Print duplicate receipt
  async printDuplicate(saleId) {
    try {
      const receiptData = await apiService.getReceiptData(saleId);
      
      // Add duplicate marking to the receipt
      const modifiedReceipt = {
        ...receiptData.receipt,
        sale: {
          ...receiptData.receipt.sale,
          sale_number: receiptData.receipt.sale.sale_number + ' (DUPLICATE)'
        }
      };
      
      const html = this.generateReceiptHTML(modifiedReceipt);
      
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      printWindow.document.write(html);
      printWindow.document.close();
      
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 100);
      };
      
      return { success: true, message: 'Duplicate receipt sent to printer' };
    } catch (error) {
      console.error('Print duplicate error:', error);
      throw new Error('Failed to print duplicate: ' + error.message);
    }
  }

  // Bulk print receipts
  async bulkPrintReceipts(saleIds) {
    try {
      const results = [];
      
      for (const saleId of saleIds) {
        try {
          await this.printReceipt(saleId);
          results.push({ saleId, success: true });
        } catch (error) {
          results.push({ saleId, success: false, error: error.message });
        }
        
        // Small delay between prints
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      return results;
    } catch (error) {
      console.error('Bulk print error:', error);
      throw error;
    }
  }

  // Get printer status (for thermal printers)
  async getPrinterStatus() {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/print/status`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        return { connected: false, status: 'offline' };
      }
      
      return await response.json();
    } catch (error) {
      console.error('Printer status error:', error);
      return { connected: false, status: 'error', message: error.message };
    }
  }

  // Test print
  async testPrint() {
    try {
      const testReceiptHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Courier New', monospace; font-size: 12px; margin: 20px; }
            .center { text-align: center; }
          </style>
        </head>
        <body>
          <div class="center">
            <h3>TEST PRINT</h3>
            <p>Printer is working correctly!</p>
            <p>Date: ${new Date().toLocaleString()}</p>
            <p>Shop Management System</p>
          </div>
        </body>
        </html>
      `;
      
      const printWindow = window.open('', '_blank', 'width=400,height=300');
      printWindow.document.write(testReceiptHTML);
      printWindow.document.close();
      
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 100);
      };
      
      return { success: true, message: 'Test print completed' };
    } catch (error) {
      console.error('Test print error:', error);
      throw new Error('Test print failed: ' + error.message);
    }
  }
}


// Create singleton instance
const receiptPrinter = new ReceiptPrinterService();

export default receiptPrinter;