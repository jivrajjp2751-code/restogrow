const { initDB } = require('./backend/db.cjs');
const path = require('path');
const userDataPath = __dirname;
const db = initDB(userDataPath);

console.log('Seeding fake data...');

// Add sections
db.prepare('INSERT OR IGNORE INTO sections (id, name, color, icon) VALUES (?, ?, ?, ?)').run('sec-2', 'Patio', '#00CEC9', '🌿');
db.prepare('INSERT OR IGNORE INTO sections (id, name, color, icon) VALUES (?, ?, ?, ?)').run('sec-3', 'VIP Lounge', '#E84393', '✨');

// Add tables
for (let i = 7; i <= 10; i++) db.prepare('INSERT OR IGNORE INTO tables (id, sectionId, number, label, status) VALUES (?, ?, ?, ?, ?)').run(`tbl-${i}`, 'sec-2', i, `P${i}`, 'available');
for (let i = 11; i <= 12; i++) db.prepare('INSERT OR IGNORE INTO tables (id, sectionId, number, label, status) VALUES (?, ?, ?, ?, ?)').run(`tbl-${i}`, 'sec-3', i, `V${i}`, 'available');

// Add categories
db.prepare('INSERT OR IGNORE INTO categories (id, name, icon, type) VALUES (?, ?, ?, ?)').run('cat-3', 'Main Course', '🍛', 'kitchen');
db.prepare('INSERT OR IGNORE INTO categories (id, name, icon, type) VALUES (?, ?, ?, ?)').run('cat-4', 'Cocktails', '🍸', 'bar');
db.prepare('INSERT OR IGNORE INTO categories (id, name, icon, type) VALUES (?, ?, ?, ?)').run('cat-5', 'Dessert', '🍰', 'kitchen');

// Add menu items
const items = [
  { id: 'm-1', cat: 'cat-1', name: 'French Fries', code: 'FF', price: 120, stock: 50 },
  { id: 'm-2', cat: 'cat-1', name: 'Chicken Wings', code: 'CW', price: 250, stock: 30 },
  { id: 'm-3', cat: 'cat-2', name: 'Kingfisher Premium', code: 'KP', price: 180, stock: 200 },
  { id: 'm-4', cat: 'cat-2', name: 'Budweiser', code: 'BW', price: 200, stock: 150 },
  { id: 'm-5', cat: 'cat-3', name: 'Butter Chicken', code: 'BC', price: 350, stock: 40 },
  { id: 'm-6', cat: 'cat-3', name: 'Paneer Tikka', code: 'PT', price: 280, stock: 45 },
  { id: 'm-7', cat: 'cat-4', name: 'Mojito', code: 'MO', price: 280, stock: 100 },
  { id: 'm-8', cat: 'cat-4', name: 'Margarita', code: 'MG', price: 320, stock: 80 },
  { id: 'm-9', cat: 'cat-5', name: 'Chocolate Brownie', code: 'CB', price: 150, stock: 25 },
];

const insertItem = db.prepare('INSERT OR IGNORE INTO menu_items (id, categoryId, name, code, price, stock) VALUES (?, ?, ?, ?, ?, ?)');
items.forEach(i => insertItem.run(i.id, i.cat, i.name, i.code, i.price, i.stock));

console.log('Done seeding!');
