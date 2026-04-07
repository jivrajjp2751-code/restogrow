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
export async function authenticateUser(pin) {
  if (!_restaurantId) throw new Error('No restaurant selected');
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('restaurant_id', _restaurantId)
    .eq('pin', pin)
    .single();

  if (error || !data) throw new Error('Invalid PIN');
  return data;
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
export async function addTable(data) { return dbInsert('tables', data); }
export async function updateTable(id, data) { return dbUpdate('tables', id, data); }
export async function deleteTable(id) { return dbDelete('tables', id); }

export async function addSection(data) { return dbInsert('sections', data); }
export async function updateSection(id, data) { return dbUpdate('sections', id, data); }
export async function deleteSection(id) { return dbDelete('sections', id); }

export async function addCategory(data) { return dbInsert('categories', data); }
export async function updateCategory(id, data) { return dbUpdate('categories', id, data); }
export async function deleteCategory(id) { return dbDelete('categories', id); }

export async function addMenuItem(data) { return dbInsert('menu_items', data); }
export async function updateMenuItem(id, data) { return dbUpdate('menu_items', id, data); }
export async function deleteMenuItem(id) { return dbDelete('menu_items', id); }

export async function createOrder(tableId, tableLabel, customerName, createdBy) {
  return dbInsert('orders', { 
    id: crypto.randomUUID(), tableId, tableLabel, status: 'active', 
    createdAt: new Date().toISOString(), createdBy 
  });
}

export async function addItemToOrder(orderId, menuItem) {
  return dbInsert('order_items', {
    orderId, menuItemId: menuItem.id, name: menuItem.name, 
    price: menuItem.price, quantity: 1, categoryType: menuItem.categoryType || 'bar'
  });
}

export async function generateBill(orderId, paymentMode, discount) {
  // Complex bill logic moved to CloudDB...
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
