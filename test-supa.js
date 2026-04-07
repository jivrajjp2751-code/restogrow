import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: bills } = await supabase.from('bills').select('*').limit(1);
  const { data: bItems } = await supabase.from('bill_items').select('*').limit(1);
  const { data: ords } = await supabase.from('orders').select('*').limit(1);
  const { data: oItems } = await supabase.from('order_items').select('*').limit(1);

  console.log("Bill:", bills ? Object.keys(bills[0] || {}) : 'none');
  console.log("Bill Item:", bItems ? Object.keys(bItems[0] || {}) : 'none');
  console.log("Order:", ords ? Object.keys(ords[0] || {}) : 'none');
  console.log("Order Item:", oItems ? Object.keys(oItems[0] || {}) : 'none');
}

check();
