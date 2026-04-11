// ===== PRINT UTILITY =====
// Supports split KOT printing: Kitchen items → Kitchen printer, Bar items → Bar printer
// For counter/admin: separate Kitchen KOT and Bar KOT

/**
 * Print a bill receipt
 */
export function printBillDirect(bill) {
  const html = buildBillHTML(bill);
  silentPrint(html);
}

/**
 * Print split KOTs — Kitchen items on one KOT, Bar items on another
 * This is the main KOT function used from mobile/staff
 * Returns { kitchenKOT: bool, barKOT: bool }
 */
export function printSplitKOT(order, tableNumber, categories = [], config = {}) {
  const departments = config.departments || [{id: 'kitchen', name: 'Kitchen'}, {id: 'bar', name: 'Bar'}];
  
  let printedCount = 0;
  
  departments.forEach((dept) => {
    // Find all category IDs for this department
    const deptCatIds = categories.filter(c => c.type === dept.id).map(c => c.id);
    // Find all items in this order that belong to those categories
    const deptItems = (order?.items || []).filter(i => deptCatIds.includes(i.categoryId));
    
    if (deptItems.length > 0) {
      const deptOrder = { ...order, items: deptItems };
      const html = buildDeptKOTHTML(deptOrder, tableNumber, dept);
      
      // Delay prints slightly to prevent browser dropping them
      setTimeout(() => silentPrint(html), printedCount * 1500);
      printedCount++;
    }
  });
  
  return { success: printedCount > 0 };
}

/**
 * Legacy: Print all items as a single KOT (not used anymore — kept for fallback)
 */
export function printKOTDirect(order, tableNumber) {
  const html = buildKOTHTML(order, tableNumber);
  silentPrint(html);
}


// ===== INTERNAL PRINT HELPER =====
function silentPrint(html) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.opacity = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow || iframe.contentDocument;
  const printDoc = doc.document || doc;
  printDoc.open();
  printDoc.write(html);
  printDoc.close();

  iframe.onload = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.error('Print failed:', e);
    }
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);
  };
}

// ===== KOT STYLES (shared) =====
const kotStyles = `
  @page { margin: 0; size: 80mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; padding: 4mm; font-size: 12px; color: #000; }
  .center { text-align: center; }
  h2 { text-align: center; font-size: 20px; margin-bottom: 2px; font-weight: 900; }
  .type-label { text-align: center; font-size: 14px; font-weight: 900; letter-spacing: 2px; margin-bottom: 2px; padding: 4px; border: 2px solid #000; }
  .dash { border-top: 2px dashed #000; margin: 5px 0; }
  .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 14px; }
  .note { color: #666; font-style: italic; padding-left: 12px; font-size: 10px; }
  .meta { font-size: 10px; color: #444; }
  .item-row { padding: 2px 0; font-size: 13px; border-bottom: 1px dotted #ccc; }
  .item-row:last-child { border-bottom: none; }
`;

// ===== DEPARTMENT KOT =====
function buildDeptKOTHTML(order, tableNumber, dept) {
  return `<!DOCTYPE html>
<html><head><title>${dept.name.toUpperCase()} KOT - T${tableNumber}</title>
<style>${kotStyles}</style></head><body>

<h2>*** KOT ***</h2>
<div class="type-label">${dept.name.toUpperCase()}</div>

<div class="dash"></div>

<div class="row">
  <span><b>TABLE ${tableNumber}</b></span>
  <span class="meta">${new Date().toLocaleTimeString()}</span>
</div>
<div class="meta">${new Date().toLocaleDateString()}</div>

<div class="dash"></div>

${(order.items || []).map(i => `
<div class="item-row">
  <div class="row"><span><b>${i.quantity}×</b> ${i.name}</span></div>
  ${i.note ? `<div class="note">→ ${i.note}</div>` : ''}
</div>
`).join('')}

<div class="dash"></div>

<div class="center meta" style="margin-top:4px">
  <p style="font-size:12px;font-weight:bold">Total Items: ${order.items.reduce((s, i) => s + i.quantity, 0)}</p>
  <p style="margin-top:6px">--- END KOT ---</p>
</div>

</body></html>`;
}

// ===== COMBINED KOT (legacy) =====
function buildKOTHTML(order, tableNumber) {
  return `<!DOCTYPE html>
<html><head><title>KOT T${tableNumber}</title>
<style>${kotStyles}</style></head><body>

<h2>*** KOT ***</h2>
<div class="center meta">KITCHEN ORDER TICKET</div>

<div class="dash"></div>

<div class="row">
  <span><b>TABLE ${tableNumber}</b></span>
  <span class="meta">${new Date().toLocaleTimeString()}</span>
</div>
<div class="meta">${new Date().toLocaleDateString()}</div>

<div class="dash"></div>

${(order.items || []).map(i => `
<div class="item-row">
  <div class="row"><span><b>${i.quantity}×</b> ${i.name}</span></div>
  ${i.note ? `<div class="note">→ ${i.note}</div>` : ''}
</div>
`).join('')}

<div class="dash"></div>

<div class="center meta" style="margin-top:4px">
  <p>Total Items: ${(order.items || []).reduce((s, i) => s + (i.quantity || 0), 0)}</p>
  <p style="margin-top:6px">--- END KOT ---</p>
</div>

</body></html>`;
}

// ===== BILL (matches thermal receipt layout) =====
function buildBillHTML(bill) {
  const layout = bill.billLayout || {};
  const restaurantName = bill.restaurantName || layout.restaurantName || 'RESTAURANT';
  const address = bill.restaurantAddress || layout.address || '';
  const phone = bill.restaurantPhone || layout.phone || '';
  const gstin = bill.gstNumber || layout.gstin || '';
  const sacCode = layout.sacCode || '';
  const serviceType = layout.serviceType || 'RESTAURANT SERVICES';
  const footerLine1 = layout.footerLine1 || 'Thank you for your visit';
  const footerLine2 = layout.footerLine2 || 'Have a nice day';
  const footerLine3 = layout.footerLine3 || '';
  const showCashier = layout.showCashier !== false;
  const cashierName = bill.cashierName || layout.cashierName || '';
  const waiterCode = bill.waiterCode || '';
  const currency = bill.currency || '₹';
  
  // Tax breakdown — split GST into SGST & CGST
  const subtotal = bill.subtotal || 0;
  const taxRate = parseFloat(bill.taxRate) || 0;
  const halfTaxRate = taxRate / 2;
  const sgst = Math.round((subtotal * halfTaxRate) / 100 * 100) / 100;
  const cgst = Math.round((subtotal * halfTaxRate) / 100 * 100) / 100;
  const totalTax = sgst + cgst;
  const discountAmount = bill.discountAmount || 0;
  const serviceCharge = bill.serviceCharge || 0;
  const total = bill.total || Math.round(subtotal + totalTax + serviceCharge - discountAmount);

  const billDate = new Date(bill.createdAt || bill.created_at || Date.now());
  const dateStr = `${billDate.toLocaleDateString('en-IN')} ${billDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

  return `<!DOCTYPE html>
<html><head><title>${bill.billNumber}</title>
<style>
  @page { margin: 0; size: 80mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { 
    font-family: 'Courier New', monospace; 
    width: 72mm; 
    margin: 0 auto; 
    padding: 4mm; 
    font-size: 11px; 
    color: #000; 
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .restaurant-name { 
    font-size: 14px; 
    font-weight: 900; 
    text-align: center; 
    margin-bottom: 2px; 
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .sub-info { 
    font-size: 10px; 
    text-align: center; 
    color: #000; 
    line-height: 1.4;
  }
  .sac-code {
    font-size: 13px;
    font-weight: 900;
    text-align: center;
    margin: 4px 0 2px;
  }
  .service-type {
    font-size: 12px;
    font-weight: 700;
    text-align: center;
    margin-bottom: 2px;
  }
  .invoice-label {
    font-size: 13px;
    font-weight: 900;
    text-align: center;
    margin-bottom: 4px;
  }
  .dot-line { 
    border: none;
    border-top: 1px dotted #000; 
    margin: 4px 0; 
  }
  .dash-line { 
    border: none;
    border-top: 2px dashed #000; 
    margin: 5px 0; 
  }
  .info-row { 
    display: flex; 
    justify-content: space-between; 
    padding: 1px 0; 
    font-size: 11px; 
  }
  .info-left { text-align: left; }
  
  /* Item table */
  .item-table { 
    width: 100%; 
    border-collapse: collapse; 
    font-size: 11px; 
    margin: 2px 0;
  }
  .item-table th { 
    text-align: left; 
    padding: 2px 0; 
    font-size: 10px; 
    font-weight: 700; 
    border-bottom: 1px dotted #000;
  }
  .item-table th:nth-child(2),
  .item-table th:nth-child(3),
  .item-table th:nth-child(4) { text-align: right; }
  .item-table td { 
    padding: 2px 0; 
    vertical-align: top;
  }
  .item-table td:nth-child(2),
  .item-table td:nth-child(3),
  .item-table td:nth-child(4) { text-align: right; }
  .item-table td:first-child { 
    max-width: 100px; 
    word-wrap: break-word; 
    text-transform: uppercase;
    font-weight: 700;
  }
  
  /* Totals */
  .subtotal-row {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
    font-size: 12px;
    font-weight: 700;
  }
  .tax-row {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 1px 0;
    font-size: 11px;
  }
  .tax-label { }
  .tax-amount { min-width: 60px; text-align: right; }
  
  .grand-total {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 14px;
    font-weight: 900;
  }
  
  .cashier-row {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
    font-size: 11px;
    margin-top: 8px;
  }
  
  .footer { 
    text-align: center; 
    font-size: 11px; 
    margin-top: 8px; 
    line-height: 1.6;
  }
  .footer-bold {
    font-weight: 700;
  }
</style></head><body>

<div class="restaurant-name">${restaurantName}</div>
${address ? `<div class="sub-info">${address}</div>` : ''}
${phone ? `<div class="sub-info">PHONE NO :${phone}</div>` : ''}
${gstin ? `<div class="sub-info">GSTIN :${gstin}</div>` : ''}
${sacCode ? `<div class="sac-code">SAC ${sacCode}</div>` : ''}
${serviceType ? `<div class="service-type">[${serviceType.toUpperCase()}]</div>` : ''}
<div class="invoice-label">[INVOICE]</div>

<hr class="dot-line" />

<div class="info-row"><span>Bill No.: ${bill.billNumber || ''}</span></div>
<div class="info-row"><span>Date :${dateStr}</span></div>

<hr class="dot-line" />

<div class="info-row">
  <span>Table No.: ${bill.tableNumber || ''}</span>
  <span>Waiter Code: ${waiterCode}</span>
</div>

<hr class="dot-line" />

<table class="item-table">
  <thead>
    <tr>
      <th>Item Name</th>
      <th>Qty.</th>
      <th>Price</th>
      <th>Value</th>
    </tr>
  </thead>
  <tbody>
    ${(bill.items || []).map(i => {
      const qty = i.quantity || 1;
      const price = i.price || 0;
      const value = price * qty;
      return `<tr>
        <td>${(i.name || '').toUpperCase()}</td>
        <td>${qty.toFixed(2)}</td>
        <td>${price.toFixed(1)}</td>
        <td>${value.toFixed(2)}</td>
      </tr>`;
    }).join('')}
  </tbody>
</table>

<hr class="dot-line" />

<div class="subtotal-row">
  <span>SUB TOTAL</span>
  <span>${subtotal.toFixed(2)}</span>
</div>

${taxRate > 0 ? `
<br/>
<div class="tax-row">
  <span class="tax-label">Add S GST(${halfTaxRate.toFixed(3)}%) on ${subtotal.toFixed(2)}</span>
  <span class="tax-amount">${sgst.toFixed(2)}</span>
</div>
<div class="tax-row">
  <span class="tax-label">Add C GST(${halfTaxRate.toFixed(3)}%) on ${subtotal.toFixed(2)}</span>
  <span class="tax-amount">${cgst.toFixed(2)}</span>
</div>
` : ''}

${discountAmount > 0 ? `
<div class="tax-row">
  <span class="tax-label">Discount ${bill.discount || 0}%</span>
  <span class="tax-amount">-${discountAmount.toFixed(2)}</span>
</div>
` : ''}

${serviceCharge > 0 ? `
<div class="tax-row">
  <span class="tax-label">Service Charge</span>
  <span class="tax-amount">${serviceCharge.toFixed(2)}</span>
</div>
` : ''}

<div class="grand-total">
  <span>Amount Incl of All Taxes</span>
  <span>${total.toFixed(2)}</span>
</div>

<hr class="dash-line" />

${showCashier ? `
<div class="cashier-row">
  <span>Cashier : ${cashierName}</span>
  <span>E & C E</span>
</div>
` : ''}

<div class="footer">
  <div class="footer-bold">${footerLine1}</div>
  ${footerLine2 ? `<div class="footer-bold">${footerLine2}</div>` : ''}
  ${footerLine3 ? `<div style="margin-top:4px">${footerLine3}</div>` : ''}
</div>

</body></html>`;
}
