import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
  const { data: orders } = await supabase.from('orders').select('*').limit(1);
  const { data: orderItems } = await supabase.from('order_items').select('*').limit(1);
  const { data: tables } = await supabase.from('tables').select('*').limit(1);

  console.log("Orders columns:", orders && orders[0] ? Object.keys(orders[0]) : "Empty");
  console.log("OrderItems columns:", orderItems && orderItems[0] ? Object.keys(orderItems[0]) : "Empty");
  console.log("Tables columns:", tables && tables[0] ? Object.keys(tables[0]) : "Empty");
  process.exit(0);
}

inspectSchema();
