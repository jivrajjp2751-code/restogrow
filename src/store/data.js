import { supabase } from '../utils/supabase';

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
  
  const tables = ['tables', 'sections', 'categories', 'menu_items', 'users', 'orders', 'order_items', 'bills', 'bill_items', 'sessions', 'config'];
  const results = {};

  for (const table of tables) {
    const { data } = await supabase
      .from(table)
      .select('*')
      .eq('restaurant_id', _restaurantId);
    
    if (table === 'config') {
      const cfg = { restaurantName: 'RestoGrow', currency: '₹', taxRate: 0, serviceChargeRate: 0 };
      (data || []).forEach(r => {
        try { cfg[r.id] = JSON.parse(r.value); } catch { cfg[r.id] = r.value; }
      });
      results.config = cfg;
    } else {
      results[table] = data || [];
    }
  }
  
  // Attach items to orders for UI convenience
  (results.orders || []).forEach(o => {
    o.items = (results.order_items || []).filter(item => item.orderId === o.id);
  });
  (results.bills || []).forEach(b => {
    b.items = (results.bill_items || []).filter(item => item.billId === b.id);
  });

  return results;
}

// ===== GENERIC HELPERS =====
async function dbInsert(table, data) {
  const { data: result, error } = await supabase
    .from(table)
    .insert([{ ...data, restaurant_id: _restaurantId }])
    .select()
    .single();
  if (error) throw error;
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
export async function updateTable(id, data) {
  const { number, label, sectionId, status } = data;
  return dbUpdate('tables', id, { number, label, sectionId: sectionId, status });
}
export async function deleteTable(id) { return dbDelete('tables', id); }

export async function addSection(data) { return dbInsert('sections', data); }
export async function updateSection(id, data) { return dbUpdate('sections', id, data); }
export async function deleteSection(id) { return dbDelete('sections', id); }

export async function addCategory(data) { 
  const { name, icon, type } = data;
  return dbInsert('categories', { name, icon, type }); 
}
export async function updateCategory(id, data) { 
  const { name, icon, type } = data;
  return dbUpdate('categories', id, { name, icon, type }); 
}
export async function deleteCategory(id) { return dbDelete('categories', id); }

export async function addMenuItem(data) { 
  const { name, code, price, stock, categoryId } = data;
  return dbInsert('menu_items', { name, code, price, stock, categoryId: categoryId }); 
}
export async function updateMenuItem(id, data) { 
  const { name, code, price, stock, categoryId } = data;
  return dbUpdate('menu_items', id, { name, code, price, stock, categoryId: categoryId }); 
}
export async function deleteMenuItem(id) { return dbDelete('menu_items', id); }

export async function createOrder(tableId, tableLabel, customerName, createdBy) {
  // customerName is not in the orders table, skipping for now
  return dbInsert('orders', { 
    id: crypto.randomUUID(), tableId: tableId, tableLabel, status: 'active', createdBy 
  });
}

export async function addItemToOrder(orderId, menuItem) {
  return dbInsert('order_items', {
    orderId: orderId, 
    menuItemId: menuItem.id, 
    name: menuItem.name, 
    price: menuItem.price, 
    quantity: 1, 
    categoryType: menuItem.categoryType || 'bar'
  });
}

export async function generateBill(orderId, paymentMode, discount) {
  // 1. Get Order & Items
  const { data: order, error: orderErr } = await supabase.from('orders').select('*').eq('id', orderId).single();
  if (orderErr) throw orderErr;
  
  const { data: items, error: itemsErr } = await supabase.from('order_items').select('*').eq('orderId', orderId);
  if (itemsErr) throw itemsErr;

  const { data: configData } = await supabase.from('config').select('*').eq('restaurant_id', _restaurantId);
  const cfg = { taxRate: 0, serviceChargeRate: 0, restaurantName: 'RestoGrow', currency: '₹' };
  configData?.forEach(r => { cfg[r.id] = r.value; });

  const subtotal = items.reduce((s, i) => s + (i.price * i.quantity), 0);
  const taxAmount = (subtotal * (cfg.taxRate || 0)) / 100;
  const serviceCharge = (subtotal * (cfg.serviceChargeRate || 0)) / 100;
  const discountAmount = (subtotal * (discount || 0)) / 100;
  const total = Math.round(subtotal + taxAmount + serviceCharge - discountAmount);

  const billId = crypto.randomUUID();
  const billNumber = `BILL-${Date.now().toString().slice(-6)}`;
  
  const bill = await dbInsert('bills', {
    id: billId,
    orderId: orderId,
    billNumber,
    customerName: '', // Order table doesn't have it, so leaving empty for now
    total,
    paymentMode,
    subtotal,
    taxRate: cfg.taxRate,
    taxAmount,
    discountAmount
  });

  const billItems = items.map(item => ({
    billId,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    categoryType: item.categoryType,
    restaurant_id: _restaurantId
  }));
  await supabase.from('bill_items').insert(billItems);

  await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId);
  await supabase.from('tables').update({ status: 'available' }).eq('id', order.tableId);

  for (const item of items) {
    const { data: menuI } = await supabase.from('menu_items').select('stock').eq('id', item.menuItemId).single();
    if (menuI) {
      await supabase.from('menu_items').update({ stock: Math.max(0, menuI.stock - item.quantity) }).eq('id', item.menuItemId);
    }
  }

  return { 
    bill: { 
      ...bill, 
      items, 
      tableNumber: order.tableLabel,
      restaurantName: cfg.restaurantName,
      currency: cfg.currency
    } 
  };
}

export async function getOrderForTable(tableId) {
  if (!_restaurantId) return null;
  const { data: order } = await supabase.from('orders').select('*').eq('restaurant_id', _restaurantId).eq('tableId', tableId).eq('status', 'active').maybeSingle();
  if (!order) return null;
  const { data: items } = await supabase.from('order_items').select('*').eq('orderId', order.id);
  order.items = items || [];
  return order;
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
  const { data: item } = await supabase.from('menu_items').select('*').eq('id', menuItemId).single();
  const newStock = (item?.stock || 0) + parseInt(qty);
  await dbUpdate('menu_items', menuItemId, { stock: newStock });
  return dbInsert('inventory_log', {
    menuItemId, itemName: item?.name, changeQty: qty,
    newStock, type: 'add', reason: reason || 'Manual restock'
  });
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

// ===== COMPUTED HELPERS (Same as before) =====
export function getSplitReport(bills, categories) {
  if (!bills || !categories) return { bar: [], kitchen: [], barTotal: 0, kitchenTotal: 0, barQty: 0, kitchenQty: 0 };
  const allItems = [];
  bills.forEach(bill => (bill.items || []).forEach(item => {
    const existing = allItems.find(i => i.name === item.name);
    if (existing) {
       existing.qty += item.quantity;
       existing.revenue += item.price * item.quantity;
    } else {
       allItems.push({ ...item, qty: item.quantity, revenue: item.price * item.quantity });
    }
  }));
  const bar = allItems.filter(i => i.categoryType !== 'kitchen').sort((a,b) => b.qty - a.qty);
  const kitchen = allItems.filter(i => i.categoryType === 'kitchen').sort((a,b) => b.qty - a.qty);
  return {
    bar, kitchen,
    barTotal: bar.reduce((s,i) => s + i.revenue, 0),
    kitchenTotal: kitchen.reduce((s,i) => s + i.revenue, 0),
    barQty: bar.reduce((s,i) => s + i.qty, 0),
    kitchenQty: kitchen.reduce((s,i) => s + i.qty, 0),
  };
}

export function getSessionBills(sessionId, bills) {
  return (bills || []).filter(b => b.sessionId === sessionId);
}

// Client-side computed helpers (legacy support)
export function getInventoryLog() { return []; }
export function getLowStockItems() { return []; }
export function getBills() { return []; }
export function getCategories() { return []; }
export function getSessions() { return []; }

export function getMonthBills(month, bills) {
  if (!bills) return [];
  return bills.filter(b => b.createdAt?.startsWith(month));
}

export function getMostSoldLiquor(month, bills, categories) {
  if (!bills || !categories) return [];
  const monthBills = bills.filter(b => b.createdAt?.startsWith(month));
  const itemMap = {};
  monthBills.forEach(bill => {
    (bill.items || []).forEach(item => {
      if (item.categoryType === 'kitchen') return;
      const key = item.name;
      if (!itemMap[key]) itemMap[key] = { name: item.name, qty: 0, revenue: 0 };
      itemMap[key].qty += item.quantity;
      itemMap[key].revenue += item.price * item.quantity;
    });
  });
  return Object.values(itemMap).sort((a, b) => b.qty - a.qty);
}

export function getCurrentSession() { return null; }

// ===== SEEDING HELPERS =====
export async function injectFakeData() {
  if (!_restaurantId) throw new Error('No restaurant selected');
  
  // 1. Categories
  const cats = [
    { name: 'Starters', icon: '🍟', type: 'kitchen' },
    { name: 'Main Course', icon: '🍛', type: 'kitchen' },
    { name: 'Desserts', icon: '🍰', type: 'kitchen' },
    { name: 'Beers', icon: '🍺', type: 'bar' },
    { name: 'Cocktails', icon: '🍸', type: 'bar' }
  ];
  
  const createdCats = [];
  for (const c of cats) {
    createdCats.push(await addCategory(c));
  }

  // 2. Menu Items
  const items = [
    { catIdx: 0, name: 'French Fries', code: 'FF', price: 120, stock: 50 },
    { catIdx: 0, name: 'Paneer Tikka', code: 'PT', price: 250, stock: 30 },
    { catIdx: 1, name: 'Butter Chicken', code: 'BC', price: 380, stock: 40 },
    { catIdx: 1, name: 'Dal Makhani', code: 'DM', price: 280, stock: 45 },
    { catIdx: 2, name: 'Brownie Sizzler', code: 'BS', price: 220, stock: 25 },
    { catIdx: 3, name: 'Kingfisher Premium', code: 'KP', price: 180, stock: 200 },
    { catIdx: 3, name: 'Corona Extra', code: 'CE', price: 350, stock: 150 },
    { catIdx: 4, name: 'Mojito', code: 'MO', price: 280, stock: 100 },
    { catIdx: 4, name: 'Long Island Iced Tea', code: 'LIIT', price: 450, stock: 80 }
  ];

  for (const item of items) {
    const parentCat = createdCats[item.catIdx];
    await addMenuItem({
      name: item.name, code: item.code, price: item.price, stock: item.stock, categoryId: parentCat.id
    });
  }

  // 3. Sections & Tables
  const s1 = await addSection({ name: 'Main Hall', color: '#6C5CE7', icon: '🍽️' });
  const s2 = await addSection({ name: 'Lounge', color: '#E84393', icon: '✨' });

  for (let i = 1; i <= 6; i++) {
    await addTable({ sectionId: s1.id, number: i, label: `H${i}`, status: 'available' });
  }
  for (let i = 7; i <= 10; i++) {
    await addTable({ sectionId: s2.id, number: i, label: `V${i}`, status: 'available' });
  }
}
