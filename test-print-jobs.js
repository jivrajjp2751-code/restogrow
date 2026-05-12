// Quick test: Check if print_jobs table works
// Run: node test-print-jobs.js

import { createClient } from '@supabase/supabase-js';

// Read env from Vercel or hardcode temporarily
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log('❌ Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY env vars');
  console.log('   Or check your Vercel dashboard for the values');
  process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
  console.log('🔍 Testing print_jobs table...\n');

  // 1. Try SELECT
  const { data: selectData, error: selectErr } = await supabase
    .from('print_jobs')
    .select('*')
    .limit(5);

  if (selectErr) {
    console.log('❌ SELECT failed:', selectErr.message);
    console.log('   → The print_jobs table may not exist. Create it in Supabase SQL Editor:');
    console.log(`
CREATE TABLE IF NOT EXISTS print_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id),
  type TEXT NOT NULL,
  content JSONB,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated/anon users
CREATE POLICY "Allow all on print_jobs" ON print_jobs
  FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE print_jobs;
    `);
    return;
  }

  console.log('✅ SELECT works. Found', selectData?.length || 0, 'rows');
  if (selectData?.length > 0) {
    console.log('   Last job:', JSON.stringify(selectData[0], null, 2));
  }

  // 2. Check pending jobs
  const { data: pending } = await supabase
    .from('print_jobs')
    .select('id, type, status, created_at')
    .eq('status', 'pending');

  console.log(`\n📋 Pending jobs: ${pending?.length || 0}`);
  if (pending?.length > 0) {
    pending.forEach(j => console.log(`   - ${j.type} | ${j.id} | ${j.created_at}`));
  }
}

test().catch(console.error);
