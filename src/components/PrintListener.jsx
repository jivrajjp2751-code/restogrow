import { useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabase';
import { useApp } from '../context/AppContext';
import { markPrintJobDone } from '../store/data';
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

    // ===== Core job execution =====
    const executeJob = async (job) => {
      if (processingRef.current.has(job.id)) return;
      // Respect pause state from Print Queue Panel
      if (localStorage.getItem('printingPaused') === 'true') {
        console.log('📠 Printing is PAUSED — skipping job', job.id);
        return;
      }
      processingRef.current.add(job.id);

      console.log(`📄 Processing: ${job.type} [${job.id}]`);
      setLastJob({ type: job.type, id: job.id, time: new Date().toLocaleTimeString() });

      try {
        if (job.type === 'KOT') {
          const content = job.content;
          if (!content || !content.order) {
            console.error('❌ KOT job missing order data:', job.id);
            await markPrintJobDone(job.id);
            return;
          }
          const result = printSplitKOT(content.order, content.tableLabel, null, config);
          console.log(`🍴 KOT: ${result.success ? 'PRINTED' : 'No dept match'}`);
        } else if (job.type === 'BILL') {
          const content = job.content;
          if (!content || !content.bill) {
            console.error('❌ BILL job missing bill data:', job.id);
            await markPrintJobDone(job.id);
            return;
          }
          printBillDirect({ ...content.bill, currency: config.currency });
          console.log('💵 Bill PRINTED');
        } else {
          console.warn('⚠️ Unknown job type:', job.type);
        }

        await markPrintJobDone(job.id);
        setJobCount(c => c + 1);
        console.log(`✅ Job ${job.id} done`);
      } catch (err) {
        console.error(`❌ Print FAILED [${job.id}]:`, err);
        if (err.message?.includes('No bill') || err.message?.includes('No order')) {
          await markPrintJobDone(job.id);
        }
      } finally {
        processingRef.current.delete(job.id);
      }
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
          console.error('📠 Poll error:', error.message);
          setStatus('error');
          return;
        }

        setStatus('active');

        if (data && data.length > 0) {
          console.log(`📠 Found ${data.length} pending job(s)`);
          for (const job of data) {
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
      if (channel) supabase.removeChannel(channel);
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
