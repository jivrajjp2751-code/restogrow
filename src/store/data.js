import { supabase } from '../utils/supabase';

// Helper for UUID if crypto.randomUUID isn't available
const getUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

let _restaurantId = null;

// ===== MULTI-TENANT CONFIG =====
export function setTenant(id) {
  _restaurantId = id;
}

export function getTenant() {
  return _restaurantId;
}

// ===== AUTH =====
export async function authenticateUser(email, password) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .eq('password', password);

  if (error || !data || data.length === 0) throw new Error('Invalid email or password');
  
  const user = data[0];
  setTenant(user.restaurant_id);
  return user;
}

// ===== MULTI-TENANT DATA SYNC =====
export async function syncAll() {
  if (!_restaurantId) return null;
  
  const tableNames = ['tables', 'sections', 'menu_items', 'users', 'orders', 'order_items', 'bills', 'bill_items', 'sessions', 'config', 'inventory_log'];
  const results = {};

  try {
    const fetchPromises = tableNames.map(table => 
      supabase.from(table).select('*').eq('restaurant_id', _restaurantId)
    );
    
    // Also fetch restaurant status
    const restPromise = supabase.from('restaurants').select('status, name').eq('id', _restaurantId).single();
    
    const [responses, restRes] = await Promise.all([Promise.all(fetchPromises), restPromise]);
    
    if (restRes.data) {
      results.restaurant = restRes.data;
    }

    responses.forEach((res, index) => {
      const tableName = tableNames[index];
      if (res.error) {
        console.error(`Error fetching ${tableName}:`, res.error);
        return;
      }
      
      if (!res.data) return;

      // NORMALIZE ALL DATA IN SYNCALL
      const normalizedData = res.data.map(row => ({
        ...row,
        tableId: row.tableId || row.table_id || row.table_no,
        orderId: row.orderId || row.order_id,
        menuItemId: row.menuItemId || row.menu_item_id,
        categoryType: row.categoryType || row.category_type,
        sessionId: row.sessionId || row.session_id,
        createdAt: row.createdAt || row.created_at,
        billNumber: row.billNumber || row.bill_number,
        paymentMode: row.paymentMode || row.payment_mode
      }));

      if (tableName === 'config') {
        const cfg = { restaurantName: 'RestoGrow', currency: '₹', taxRate: 0, serviceChargeRate: 0 };
        normalizedData.forEach(r => {
          try { cfg[r.id] = JSON.parse(r.value); } catch { cfg[r.id] = r.value; }
        });
        results.config = cfg;
      } else {
        results[tableName] = normalizedData;
      }
    });

    // Post-process items into Maps
    const orderItemsMap = {};
    (results.order_items || []).forEach(item => {
      if (!orderItemsMap[item.orderId]) orderItemsMap[item.orderId] = [];
      orderItemsMap[item.orderId].push(item);
    });

    const billItemsMap = {};
    (results.bill_items || []).forEach(item => {
      item.quantity = item.quantity || item.qty || 0;
      if (!billItemsMap[item.billId]) billItemsMap[item.billId] = [];
      billItemsMap[item.billId].push(item);
    });

    (results.orders || []).forEach(o => {
      o.items = orderItemsMap[o.id] || [];
    });
    
    (results.bills || []).forEach(b => {
      b.items = billItemsMap[b.id] || [];
    });

    return results;
  } catch (err) {
    console.error('syncAll critical error:', err);
    return null;
  }
}

// ===== GENERIC HELPERS =====
async function dbInsert(table, data) {
  if (!_restaurantId) throw new Error('No restaurant ID set. Please reload the page.');
  const payload = { ...data, restaurant_id: _restaurantId };
  const { data: result, error } = await supabase
    .from(table)
    .insert([payload])
    .select()
    .single();
  if (error) {
    console.error(`dbInsert ${table} FAILED:`, error.message, 'payload keys:', Object.keys(payload));
    throw error;
  }
  return result;
}

async function dbUpdate(table, id, data) {
  const { error } = await supabase
    .from(table)
    .update(data)
    .eq('id', id)
    .eq('restaurant_id', _restaurantId);
  if (error) throw error;
}

async function dbDelete(table, id) {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
    .eq('restaurant_id', _restaurantId);
  if (error) throw error;
}

// ===== EXPORTED ACTIONS =====
export async function addTable(data) { 
  const { number, label, sectionId } = data;
  return dbInsert('tables', { number, label, sectionId: sectionId }); 
}

// --- PRINT QUEUE SYSTEM ---
export async function createPrintJob(type, content) {
  return dbInsert('print_jobs', {
    type,
    content,
    status: 'pending',
    created_at: new Date().toISOString()
  });
}

export async function markPrintJobDone(jobId) {
  return dbUpdate('print_jobs', jobId, { status: 'completed' });
}

export async function addSection(data) {
  const { name, icon, color, surcharge, surchargeDepts } = data;
  return dbInsert('sections', { name, icon, color, surcharge: Number(surcharge) || 0, surchargeDepts: surchargeDepts || [] });
}
export async function updateSection(id, data) {
  const { name, icon, color, surcharge, surchargeDepts } = data;
  return dbUpdate('sections', id, { name, icon, color, surcharge: Number(surcharge) || 0, surchargeDepts: surchargeDepts || [] });
}
export async function deleteSection(id) { return dbDelete('sections', id); }

export async function updateTable(id, data) {
  const { number, label, sectionId, status } = data;
  return dbUpdate('tables', id, { number, label, sectionId: sectionId, status });
}
export async function deleteTable(id) { return dbDelete('tables', id); }

// Category management removed - items linked to departments directly

export async function addMenuItem(data) { 
  const { name, code, price, buyingPrice, stock, deptId, section_ids } = data;
  return dbInsert('menu_items', { name, code, price, buyingPrice, stock, deptId, section_ids: section_ids || [] }); 
}
export async function updateMenuItem(id, data) { 
  const { name, code, price, buyingPrice, stock, deptId, section_ids } = data;
  return dbUpdate('menu_items', id, { name, code, price, buyingPrice, stock, deptId, section_ids: section_ids || [] }); 
}
export async function deleteMenuItem(id) { return dbDelete('menu_items', id); }

export async function createOrder(tableId, tableLabel, customerName, createdBy) {
  const orderId = getUUID();
  const orderData = { 
    id: orderId,
    tableId: tableId, 
    table_id: tableId, // Defensive
    tableLabel, 
    status: 'active', 
    customerName,
    createdBy,
  };
  const order = await dbInsert('orders', orderData);
  await dbUpdate('tables', tableId, { status: 'occupied' });
  return order;
}

export async function cancelOrder(orderId, tableId) {
  // 1. Cancel the specific order if we have ID
  if (orderId) {
    await dbUpdate('orders', orderId, { status: 'cancelled' });
  }
  
  // 2. Clear ALL active orders for this table to prevent it from going "Occupied" again
  if (tableId && _restaurantId) {
    // Try both tableId and table_id
    await supabase.from('orders')
      .update({ status: 'cancelled' })
      .eq('restaurant_id', _restaurantId)
      .eq('status', 'active')
      .or(`tableId.eq.${tableId},table_id.eq.${tableId}`);
      
    // 3. Mark table as available
    await dbUpdate('tables', tableId, { status: 'available' });
  }
}

export async function addItemToOrder(orderId, item) {
  // 1. Get order's table and section surcharge - checking BOTH column names for safety
  const { data: orderData, error: oErr } = await supabase.from('orders')
    .select('tableId, table_id')
    .eq('id', orderId)
    .single();
    
  if (oErr) {
    console.warn("Could not find order for surcharge check, proceeding without it.", oErr);
  }

  const tableId = orderData?.tableId || orderData?.table_id;
  let surcharge = 0;
  const itemDept = item.deptId || item.categoryType || 'bar';
  
  if (tableId) {
    const { data: table } = await supabase.from('tables')
      .select('sectionId, section_id')
      .eq('id', tableId)
      .single();
      
    const sectionId = table?.sectionId || table?.section_id;
    if (sectionId) {
      const { data: section } = await supabase.from('sections')
        .select('surcharge, surchargeDepts, surcharge_depts')
        .eq('id', sectionId)
        .single();
        
      if (section) {
        const surchargeDepts = section.surchargeDepts || section.surcharge_depts || [];
        const isApplicable = surchargeDepts.length === 0 || surchargeDepts.includes(itemDept);
        surcharge = isApplicable ? (section.surcharge || 0) : 0;
      }
    }
  }
  
  const surchargeFactor = 1 + (surcharge / 100);
  const finalPrice = Math.round((item.price || 0) * surchargeFactor);

  // Payload with ONLY standard camelCase columns to avoid "column not found" errors
  const payload = {
    orderId: orderId,
    menuItemId: item.id || item.menuItemId,
    name: item.name,
    price: finalPrice,
    quantity: item.quantity || 1,
    categoryType: itemDept,
    note: item.note || '',
    restaurant_id: _restaurantId
  };
  
  return dbInsert('order_items', payload);
}

export async function generateBill(orderId, paymentMode, discount) {
  // 1. Get Order & Items
  const { data: order, error: orderErr } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (orderErr) throw orderErr;
  
  // orderId is the actual column name in the DB
  const { data: items, error: itemsErr } = await supabase.from('order_items').select('*').eq('orderId', orderId);
  if (itemsErr) throw itemsErr;

  const { data: configData } = await supabase.from('config').select('*').eq('restaurant_id', _restaurantId);
  const cfg = { taxRate: 0, serviceChargeRate: 0, restaurantName: 'RestoGrow', currency: '₹' };
  configData?.forEach(r => { 
    try { cfg[r.id] = JSON.parse(r.value); } catch { cfg[r.id] = r.value; }
  });

  const subtotal = items.reduce((s, i) => s + ((i.price||0) * (i.quantity||i.qty||0)), 0);
  const taxAmount = (subtotal * (cfg.taxRate || 0)) / 100;
  const serviceCharge = (subtotal * (cfg.serviceChargeRate || 0)) / 100;
  const discountAmount = (subtotal * (discount || 0)) / 100;
  const total = Math.round(subtotal + taxAmount + serviceCharge - discountAmount);

  const billId = getUUID();
  const billNumber = `BILL-${Date.now().toString().slice(-6)}`;
  
  // Use camelCase
  const bill = await dbInsert('bills', {
    id: billId,
    orderId: orderId,
    billNumber: billNumber,
    total,
    paymentMode: paymentMode,
    createdAt: new Date().toISOString()
  });

  // Fetch buying prices for items to log profit accurately
  const { data: menuItemsData } = await supabase.from('menu_items').select('id, buyingPrice').eq('restaurant_id', _restaurantId);
  const buyingPriceMap = {};
  menuItemsData?.forEach(m => { buyingPriceMap[m.id] = m.buyingPrice || 0; });

  // Use camelCase for bill items
  const billItems = items.map(item => ({
    billId: billId,
    name: item.name,
    price: item.price,
    buyingPrice: buyingPriceMap[item.menuItemId || item.menu_item_id] || 0,
    quantity: item.quantity || item.qty || 0,
    categoryType: item.deptId || item.categoryType || item.category_type || 'bar',
    restaurant_id: _restaurantId
  }));
  
  if (billItems.length > 0) {
    const { error: biErr } = await supabase.from('bill_items').insert(billItems);
    if (biErr) throw new Error(`bill_items insert failed: ${biErr.message}`);
  }

  await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId);
  await supabase.from('tables').update({ status: 'available' }).eq('id', order.tableId);

  // Deduct stock
  for (const item of items) {
    const mid = item.menuItemId || item.menu_item_id;
    if (!mid) continue;
    const { data: menuI } = await supabase.from('menu_items').select('stock').eq('id', mid).single();
    if (menuI) {
      const newStock = Math.max(0, menuI.stock - (item.quantity || 1));
      await supabase.from('menu_items').update({ stock: newStock }).eq('id', mid);
    }
  }

  return { 
    bill: { 
      ...bill, 
      items, 
      subtotal,
      taxAmount,
      taxRate: cfg.taxRate,
      serviceCharge,
      serviceChargeRate: cfg.serviceChargeRate,
      discount,
      discountAmount,
      tableNumber: order.tableLabel,
      restaurantName: cfg.restaurantName,
      restaurantAddress: cfg.address || '',
      restaurantPhone: cfg.phone || '',
      gstNumber: cfg.gstNumber || '',
      currency: cfg.currency,
      billLayout: cfg.billLayout || {}
    } 
  };
}

export async function getOrderForTable(tableId) {
  if (!_restaurantId) return null;
  try {
    // Try snake_case first (standard)
    let { data: orders, error } = await supabase.from('orders')
      .select('*')
      .eq('restaurant_id', _restaurantId)
      .eq('table_id', tableId)
      .eq('status', 'active')
      .limit(1);
      
    // If not found, try camelCase (legacy/custom)
    if (!orders || orders.length === 0) {
      const res = await supabase.from('orders')
        .select('*')
        .eq('restaurant_id', _restaurantId)
        .eq('tableId', tableId)
        .eq('status', 'active')
        .limit(1);
      orders = res.data;
    }
      
    if (!orders || orders.length === 0) return null;
    const order = orders[0];
    
    // Normalize properties
    order.id = order.id || order.order_id;
    order.tableId = order.tableId || order.table_id;
    
    // Fetch items with dual-naming support
    let { data: items } = await supabase.from('order_items')
      .select('*')
      .eq('order_id', order.id);

    if (!items || items.length === 0) {
      const res = await supabase.from('order_items')
        .select('*')
        .eq('orderId', order.id);
      items = res.data;
    }
      
    order.items = (items || []).map(i => ({
      ...i,
      quantity: i.quantity || i.qty || 0,
      price: i.price || 0,
      name: i.name || 'Unknown Item'
    }));
    return order;
  } catch (err) {
    console.error("🚨 GET ORDER CRITICAL FAIL:", err);
    return null;
  }
}

export async function updateOrderItem(orderId, itemId, data) {
  return dbUpdate('order_items', itemId, data);
}

export async function removeOrderItem(orderId, itemId) {
  return dbDelete('order_items', itemId);
}

export async function updateConfig(updates) {
  for (const [id, value] of Object.entries(updates)) {
    const val = typeof value === 'string' ? value : JSON.stringify(value);
    await supabase.from('config').upsert({ id, value: val, restaurant_id: _restaurantId });
  }
}

export async function addUser(data) { return dbInsert('users', data); }
export async function updateUser(id, data) { return dbUpdate('users', id, data); }
export async function deleteUser(id) { return dbDelete('users', id); }

export async function addInventoryLog(data) {
  return dbInsert('inventory_log', data);
}

export async function addStock(menuItemId, qty, reason) {
  // Step 1: Get item info
  const { data: item, error: itmErr } = await supabase
    .from('menu_items').select('*').eq('id', menuItemId).single();
  if (itmErr || !item) throw new Error('Menu item not found: ' + (itmErr?.message || 'unknown'));

  // Step 2: Update stock (this is the critical part - must succeed)
  const newStock = (item.stock || 0) + Number(qty);
  const { error: updErr } = await supabase
    .from('menu_items')
    .update({ stock: newStock })
    .eq('id', menuItemId)
    .eq('restaurant_id', _restaurantId);
  
  if (updErr) throw new Error('Stock update failed: ' + updErr.message);

  // Step 3: Log the stock change (non-critical - wrapped in try/catch)
  try {
    await dbInsert('inventory_log', {
      menuItemId,
      itemName: item.name,
      changeQty: Number(qty),
      newStock,
      type: 'add',
      reason: reason || 'Manual restock'
    });
  } catch (logErr) {
    console.warn('Inventory log failed (non-critical):', logErr.message);
  }

  return { status: 'success', newStock };
}

export async function startSession(startedBy) {
  return dbInsert('sessions', {
    date: new Date().toLocaleDateString(),
    startedAt: new Date().toISOString(),
    startedBy,
    status: 'active'
  });
}

export async function endSession(endedBy) {
  const { error } = await supabase
    .from('sessions')
    .update({ status: 'ended', endedAt: new Date().toISOString(), endedBy })
    .eq('status', 'active')
    .eq('restaurant_id', _restaurantId);
  if (error) throw error;
}

export function subscribeToChanges(callback) {
  return supabase
    .channel('restogrow-changes')
    .on('postgres_changes', { event: '*', schema: 'public' }, () => callback())
    .subscribe();
}

// ===== COMPUTED HELPERS =====
export function getSplitReport(bills, _unused, config = {}) {
  const depts = config.departments || [{id: 'kitchen', name: 'Kitchen'}, {id: 'bar', name: 'Bar'}];

  if (!bills) return { departments: [] };
  
  const allItems = [];
  bills.forEach(bill => (bill.items || []).forEach(item => {
    const qty = item.quantity || 0;
    const price = item.price || 0;
    const cost = (item.buyingPrice || 0) * qty;
    const revenue = price * qty;
    const profit = revenue - cost;

    const existing = allItems.find(i => i.name === item.name);
    if (existing) {
       existing.qty += qty;
       existing.revenue += revenue;
       existing.profit += profit;
       existing.cost += cost;
    } else {
       allItems.push({ ...item, qty, revenue, cost, profit });
    }
  }));

  const departments = depts.map(dept => {
    const items = allItems.filter(i => {
      if (i.deptId === dept.id) return true;
      if (i.categoryType === dept.id) return true;
      return false;
    }).sort((a,b) => b.qty - a.qty);
    
    const qty = items.reduce((s,i) => s + i.qty, 0);
    const revenue = items.reduce((s,i) => s + i.revenue, 0);
    const profit = items.reduce((s,i) => s + i.profit, 0);
    
    return {
      id: dept.id, name: dept.name, items, qty, revenue, profit
    };
  });
  
  return { departments };
}

export function getSessionBills(session, bills) {
  if (!session || !bills) return [];
  
  const sessionId = session.id;
  
  return bills.filter(b => {
    // Primary: match by sessionId
    if (b.sessionId && b.sessionId === sessionId) return true;
    
    // Fallback: if bill has no sessionId, match by precise time window
    const bDate = new Date(b.createdAt || b.created_at);
    const sStart = new Date(session.startedAt);
    const sEnd = session.endedAt ? new Date(session.endedAt) : new Date();
    
    if (!b.sessionId && bDate >= sStart && bDate <= sEnd) return true;
    
    return false;
  });
}

// Client-side computed helpers
export function getInventoryLog(logs) { 
  return (logs || []).map(l => ({
    ...l,
    itemName: l.itemName || l.item_name,
    quantity: l.quantity || l.changeQty || l.change_qty,
    remainingStock: l.remainingStock || l.newStock || l.new_stock,
    timestamp: l.timestamp || l.created_at
  }));
}
export function getLowStockItems(items) { return (items || []).filter(i => (i.stock || 0) <= 10); }
export function getBills(bills) { return bills || []; }
export function getCategories() { return []; }
export function getSessions(sessions) { return sessions || []; }

export function getMonthBills(month, bills) {
  if (!bills) return [];
  return bills.filter(b => {
    const d = b.createdAt || b.created_at;
    return d?.startsWith(month);
  });
}

export function getMostSoldLiquor(month, bills, _unused, config = {}) {
  const barDepts = (config.departments || []).filter(d => 
    d.name.toLowerCase().includes('bar') || 
    d.name.toLowerCase().includes('bev') || 
    d.name.toLowerCase().includes('liquor')
  ).map(d => d.id);
  
  if (!bills) return [];
  const monthBills = bills.filter(b => {
    const d = b.createdAt || b.created_at;
    return d?.startsWith(month);
  });
  const itemMap = {};
  monthBills.forEach(bill => {
    (bill.items || []).forEach(item => {
      // Include if it matches a bar/bev department ID or has a legacy 'bar' categoryType
      const isBar = barDepts.includes(item.deptId) || barDepts.includes(item.categoryType) || item.categoryType === 'bar';
      if (!isBar) return;
      
      const key = item.name;
      if (!itemMap[key]) itemMap[key] = { name: item.name, qty: 0, revenue: 0 };
      itemMap[key].qty += item.quantity;
      itemMap[key].revenue += item.price * item.quantity;
    });
  });
  return Object.values(itemMap).sort((a, b) => b.qty - a.qty);
}

export function getCurrentSession() { return null; }

// Seeding helper removed — categories no longer used

