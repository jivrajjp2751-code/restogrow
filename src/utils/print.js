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

// ===== BILL =====
function buildBillHTML(bill) {
  return `<!DOCTYPE html>
<html><head><title>${bill.billNumber}</title>
<style>
  @page { margin: 0; size: 80mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; padding: 4mm; font-size: 11px; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .name { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
  .sub { font-size: 9px; color: #444; }
  .dash { border-top: 2px dashed #000; margin: 5px 0; }
  .row { display: flex; justify-content: space-between; padding: 1px 0; }
  .row-bold { display: flex; justify-content: space-between; padding: 2px 0; font-weight: bold; }
  .total { font-size: 14px; font-weight: bold; }
  .item-note { color: #666; font-style: italic; padding-left: 10px; font-size: 9px; }
  .footer { text-align: center; font-size: 9px; color: #666; margin-top: 8px; }
</style></head><body>

<div class="center">
  <div class="name">${bill.restaurantName || 'POS System'}</div>
  ${bill.restaurantAddress ? `<div class="sub">${bill.restaurantAddress}</div>` : ''}
  ${bill.restaurantPhone ? `<div class="sub">Tel: ${bill.restaurantPhone}</div>` : ''}
  ${bill.gstNumber ? `<div class="sub">GST: ${bill.gstNumber}</div>` : ''}
</div>

<div class="dash"></div>

<div class="row">
  <span>${bill.billNumber}</span>
  <span>T${bill.tableNumber}</span>
</div>
<div class="row sub">
  <span>${new Date(bill.createdAt || bill.created_at).toLocaleDateString()}</span>
  <span>${new Date(bill.createdAt || bill.created_at).toLocaleTimeString()}</span>
</div>
${bill.customerName ? `<div class="row sub"><span>Customer: ${bill.customerName}</span></div>` : ''}

<div class="dash"></div>

<div class="row bold" style="font-size:10px">
  <span>ITEM</span>
  <span>AMT</span>
</div>
<div style="border-top:1px solid #000;margin:2px 0"></div>

${(bill.items || []).map(i => `
<div class="row">
  <span>${i.name} ×${i.quantity}</span>
  <span>₹${i.price * i.quantity}</span>
</div>
${i.note ? `<div class="item-note">→ ${i.note}</div>` : ''}
`).join('')}

<div class="dash"></div>

<div class="row"><span>Subtotal</span><span>₹${bill.subtotal}</span></div>
${bill.taxAmount > 0 ? `<div class="row"><span>Tax ${bill.taxRate}%</span><span>₹${Math.round(bill.taxAmount)}</span></div>` : ''}
${bill.serviceCharge > 0 ? `<div class="row"><span>Service ${bill.serviceChargeRate}%</span><span>₹${Math.round(bill.serviceCharge)}</span></div>` : ''}
${bill.discountAmount > 0 ? `<div class="row"><span>Discount ${bill.discount}%</span><span>-₹${Math.round(bill.discountAmount)}</span></div>` : ''}

<div class="dash"></div>

<div class="row total">
  <span>TOTAL</span>
  <span>₹${bill.total}</span>
</div>

<div style="margin-top:4px" class="row sub">
  <span>Payment: ${bill.paymentMode}</span>
</div>

<div class="dash"></div>

<div class="footer">
  <p>Thank you for visiting!</p>
  <p style="margin-top:4px">--- End ---</p>
</div>

</body></html>`;
}
