import { useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabase';
import { useApp } from '../context/AppContext';
import { printSplitKOT, printBillDirect } from '../utils/print';

export default function PrintListener() {
  const { config, currentUser } = useApp();
  const isPrintStation = localStorage.getItem('isPrintStation') === 'true';
  const processingRef = useRef(new Set());
  const mountedRef = useRef(true);
  const [status, setStatus] = useState('idle'); // idle, active, error
  const [lastJob, setLastJob] = useState(null);
  const [jobCount, setJobCount] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!isPrintStation || !currentUser || !supabase) {
      if (isPrintStation && !currentUser) {
        console.log('📠 PrintListener: waiting for currentUser...');
      }
      return;
    }

    const restaurantId = currentUser.restaurant_id;
    if (!restaurantId) {
      console.warn('📠 PrintListener: No restaurant_id on currentUser');
      setStatus('error');
      return;
    }

    console.log('📠 PrintListener ACTIVE — restaurant:', restaurantId);
    setStatus('active');

    // ===== Safely mark a job as completed (handles already-deleted/missing rows) =====
    const safeMarkDone = async (jobId) => {
      if (!jobId) return;
      try {
        // Safe to update - skip redundant check to speed up processing
        // The pre-check in executeJob already verified it's pending
        const { error: updateErr } = await supabase
          .from('print_jobs')
          .update({ status: 'completed' })
          .eq('id', jobId)
          .eq('restaurant_id', restaurantId);

        if (updateErr) {
          console.warn('📠 Mark done update failed (non-critical):', updateErr.message);
        }
      } catch (err) {
        // Completely swallow — marking done is never critical
        console.warn('📠 safeMarkDone exception (non-critical):', err.message);
      }
    };

    // ===== Core job execution =====
    const executeJob = async (job) => {
      if (!job || !job.id) return;
      if (processingRef.current.has(job.id)) return;

      // Respect pause state from Print Queue Panel
      if (localStorage.getItem('printingPaused') === 'true') {
        console.log('📠 Printing is PAUSED — skipping job', job.id);
        return;
      }

      // Check if the job still exists before processing (user may have cancelled it)
      try {
        const { data: fresh, error: freshErr } = await supabase
          .from('print_jobs')
          .select('id, status')
          .eq('id', job.id)
          .eq('restaurant_id', restaurantId)
          .maybeSingle();

        if (freshErr || !fresh) {
          console.log(`📠 Job ${job.id} no longer exists — skipping`);
          return;
        }
        if (fresh.status !== 'pending') {
          console.log(`📠 Job ${job.id} status is '${fresh.status}' — skipping`);
          return;
        }
      } catch (e) {
        console.warn('📠 Pre-check failed, proceeding anyway:', e.message);
      }

      processingRef.current.add(job.id);

      console.log(`📄 Processing: ${job.type} [${job.id}]`);
      setLastJob({ type: job.type, id: job.id, time: new Date().toLocaleTimeString() });

      try {
        // Mark the job as done BEFORE printing!
        // This is CRITICAL because iframe.contentWindow.print() can block the JS thread (print dialog).
        // If we wait until after printing to mark it done, the network request gets blocked,
        // and the queue gets stuck or infinite loops.
        await safeMarkDone(job.id);

        if (job.type === 'KOT') {
          const content = job.content;
          if (!content || !content.order) {
            console.error('❌ KOT job missing order data:', job.id);
            return;
          }
          try {
            const result = printSplitKOT(content.order, content.tableLabel, null, config);
            console.log(`🍴 KOT: ${result?.success ? 'PRINTED' : 'No dept match'}`);
          } catch (printErr) {
            console.error('❌ KOT print error:', printErr.message);
          }
        } else if (job.type === 'BILL') {
          const content = job.content;
          if (!content || !content.bill) {
            console.error('❌ BILL job missing bill data:', job.id);
            return;
          }
          try {
            printBillDirect({ ...content.bill, currency: config.currency });
            console.log('💵 Bill PRINTED');
          } catch (printErr) {
            console.error('❌ Bill print error:', printErr.message);
          }
        } else {
          console.warn('⚠️ Unknown job type:', job.type);
        }

        setJobCount(c => c + 1);
        console.log(`✅ Job ${job.id} done`);
      } catch (err) {
        console.error(`❌ Print FAILED [${job.id}]:`, err);
        // Always mark done on failure to prevent infinite retry loop
        await safeMarkDone(job.id);
      } finally {
        processingRef.current.delete(job.id);
      }
    };

    // ===== Dedup: remove duplicate pending jobs to prevent paper waste =====
    const deduplicateJobs = async (jobs) => {
      if (!jobs || jobs.length <= 1) return jobs;

      const seen = new Map(); // signature → first job
      const dupeIds = [];

      for (const job of jobs) {
        let sig = '';
        if (job.type === 'BILL') {
          const billNo = job.content?.bill?.billNumber;
          sig = billNo ? `BILL:${billNo}` : `BILL:${job.id}`;
        } else if (job.type === 'KOT') {
          const orderId = job.content?.order?.id;
          const tableLabel = job.content?.tableLabel || '';
          const itemSig = (job.content?.order?.items || [])
            .map(i => `${i.name}:${i.quantity}`)
            .sort()
            .join('|');
          sig = orderId ? `KOT:${orderId}:${tableLabel}:${itemSig}` : `KOT:${job.id}`;
        } else {
          sig = `OTHER:${job.id}`;
        }

        if (seen.has(sig)) {
          // This is a duplicate — mark for removal
          dupeIds.push(job.id);
        } else {
          seen.set(sig, job);
        }
      }

      // Auto-remove duplicates from the database
      if (dupeIds.length > 0) {
        console.warn(`📠 AUTO-DEDUP: Removing ${dupeIds.length} duplicate job(s) to prevent paper waste`);
        for (const dupeId of dupeIds) {
          try {
            await supabase
              .from('print_jobs')
              .delete()
              .eq('id', dupeId)
              .eq('restaurant_id', restaurantId);
            console.log(`📠 Duplicate removed: ${dupeId}`);
          } catch (e) {
            console.warn(`📠 Failed to remove duplicate ${dupeId}:`, e.message);
          }
        }
      }

      return Array.from(seen.values());
    };

    // ===== Poll for pending jobs =====
    const fetchPendingJobs = async () => {
      if (!mountedRef.current) return;
      try {
        const { data, error } = await supabase
          .from('print_jobs')
          .select('*')
          .eq('status', 'pending')
          .eq('restaurant_id', restaurantId)
          .order('created_at', { ascending: true });

        if (error) {
          // Handle missing table gracefully
          if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            console.warn('📠 print_jobs table does not exist — printing disabled');
            setStatus('error');
            return;
          }
          console.error('📠 Poll error:', error.message);
          setStatus('error');
          return;
        }

        setStatus('active');

        if (data && data.length > 0) {
          // Deduplicate before processing — prevents same bill/KOT printing multiple times
          const uniqueJobs = await deduplicateJobs(data);
          console.log(`📠 Found ${data.length} pending → ${uniqueJobs.length} unique job(s)`);
          for (const job of uniqueJobs) {
            if (!mountedRef.current) break;
            await executeJob(job);
          }
        }
      } catch (e) {
        console.error('📠 Poll exception:', e);
        setStatus('error');
      }
    };

    // 1. Initial fetch
    fetchPendingJobs();

    // 2. Realtime subscription
    let channel = null;
    try {
      channel = supabase
        .channel('print-jobs-rt-' + restaurantId)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'print_jobs',
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          (payload) => {
            console.log('📠 REALTIME: New job!', payload.new?.id);
            if (payload.new && payload.new.status === 'pending') {
              executeJob(payload.new);
            }
          }
        )
        .subscribe((subStatus) => {
          console.log('📠 Realtime status:', subStatus);
        });
    } catch (rtErr) {
      console.warn('📠 Realtime setup failed (using polling only):', rtErr.message);
    }

    // 3. Polling fallback every 3 seconds
    const intervalId = setInterval(fetchPendingJobs, 3000);

    return () => {
      console.log('📠 PrintListener cleanup');
      clearInterval(intervalId);
      if (channel) {
        try { supabase.removeChannel(channel); } catch (e) { /* cleanup error, safe to ignore */ }
      }
    };
  }, [isPrintStation, currentUser, config]);

  // Show a small status badge when this is a print station
  if (!isPrintStation) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '8px',
        right: '8px',
        zIndex: 9999,
        background: status === 'active' ? 'rgba(78, 205, 196, 0.95)' : status === 'error' ? 'rgba(255, 107, 107, 0.95)' : 'rgba(150,150,150,0.9)',
        color: '#fff',
        padding: '6px 12px',
        borderRadius: '20px',
        fontSize: '10px',
        fontWeight: 700,
        fontFamily: 'monospace',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      title={`Status: ${status}\nJobs printed: ${jobCount}\nLast: ${lastJob ? `${lastJob.type} at ${lastJob.time}` : 'none'}`}
      onClick={() => {
        alert(`🖨️ PRINT STATION STATUS\n\nStatus: ${status.toUpperCase()}\nJobs printed this session: ${jobCount}\nLast job: ${lastJob ? `${lastJob.type} at ${lastJob.time} [${lastJob.id}]` : 'None yet'}\nRestaurant: ${currentUser?.restaurant_id || 'unknown'}\n\nIf status is ERROR, check:\n1. Internet connection\n2. Browser console (F12) for details`);
      }}
    >
      🖨️ {status === 'active' ? `PRINTER ✓ (${jobCount})` : status === 'error' ? 'PRINTER ✗' : 'PRINTER...'}
    </div>
  );
}
