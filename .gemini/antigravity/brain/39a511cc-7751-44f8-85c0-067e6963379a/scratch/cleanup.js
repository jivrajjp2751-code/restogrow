import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const rid = '3c0a4c00-6468-45e2-8874-9b2f6fcdc020';

async function cleanup() {
  console.log('🧹 Starting cleanup for restaurant...', rid);
  const tables = [
    'bill_items', 
    'bills', 
    'order_items', 
    'orders', 
    'sessions', 
    'print_jobs', 
    'inventory_log'
  ];

  for (const t of tables) {
    console.log(`Deleting from ${t}...`);
    const { error } = await supabase.from(t).delete().eq('restaurant_id', rid);
    if (error) {
      console.error(`❌ Error in ${t}:`, error.message);
    } else {
      console.log(`✅ ${t} cleared`);
    }
  }

  console.log('Resetting table statuses...');
  await supabase.from('tables').update({ status: 'available' }).eq('restaurant_id', rid);
  console.log('✅ All tables reset to available');
  
  process.exit(0);
}

cleanup();
