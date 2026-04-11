import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Since dotenv fails in some environments, I'll try to get them from file contents if found
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing ENV vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCounts() {
  const rid = '3c0a4c00-6468-45e2-8874-9b2f6fcdc020';
  const tables = ['bill_items', 'bills', 'order_items', 'orders', 'sessions', 'print_jobs', 'inventory_log'];
  
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true }).eq('restaurant_id', rid);
    console.log(`${t}: ${count} rows (Error: ${error?.message || 'none'})`);
  }
}

checkCounts();
