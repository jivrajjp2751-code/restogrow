import { useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { useApp } from '../context/AppContext';
import { markPrintJobDone } from '../store/data';
import { printSplitKOT, printBillDirect } from '../utils/print';

export default function PrintListener() {
  const { config, currentUser } = useApp();
  const isPrintStation = localStorage.getItem('isPrintStation') === 'true';
  const processingRef = useRef(new Set()); // Track jobs currently being processed
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!isPrintStation || !currentUser || !supabase) return;

    const restaurantId = currentUser.restaurant_id;
    if (!restaurantId) {
      console.warn('📠 PrintListener: No restaurant_id on currentUser');
      return;
    }

    console.log('📠 PrintListener ACTIVE — listening for print jobs (restaurant:', restaurantId, ')');

    // ===== Core job execution =====
    const executeJob = async (job) => {
      // Prevent double-processing
      if (processingRef.current.has(job.id)) return;
      processingRef.current.add(job.id);

      console.log(`📄 Processing job: ${job.type} [${job.id}]`);

      try {
        if (job.type === 'KOT') {
          const content = job.content;
          if (!content || !content.order) {
            console.error('❌ KOT job has no order data:', job.id);
            await markPrintJobDone(job.id);
            return;
          }
          const result = printSplitKOT(content.order, content.tableLabel, null, config);
          console.log(`🍴 KOT Result: ${result.success ? 'Printed' : 'No matching departments'}`);
        } else if (job.type === 'BILL') {
          const content = job.content;
          if (!content || !content.bill) {
            console.error('❌ BILL job has no bill data:', job.id);
            await markPrintJobDone(job.id);
            return;
          }
          printBillDirect({ ...content.bill, currency: config.currency });
          console.log('💵 Bill printed successfully');
        } else {
          console.warn('⚠️ Unknown job type:', job.type);
        }

        // Only mark done AFTER successful execution
        await markPrintJobDone(job.id);
        console.log(`✅ Job ${job.id} marked complete`);
      } catch (err) {
        console.error(`❌ Print job ${job.id} FAILED:`, err);
        // Don't mark as done — it will be retried on next poll
        // But if it's a data error (not a printer error), mark it done to avoid infinite retry
        if (err.message?.includes('No bill') || err.message?.includes('No order')) {
          await markPrintJobDone(job.id);
        }
      } finally {
        processingRef.current.delete(job.id);
      }
    };

    // ===== Fetch and process all pending jobs =====
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
          return;
        }

        if (data && data.length > 0) {
          console.log(`📠 Found ${data.length} pending print job(s)`);
          for (const job of data) {
            await executeJob(job);
          }
        }
      } catch (e) {
        console.error('📠 Poll exception:', e);
      }
    };

    // ===== 1. Initial fetch on mount =====
    fetchPendingJobs();

    // ===== 2. Supabase Realtime subscription for INSTANT pickup =====
    const channel = supabase
      .channel('print-jobs-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'print_jobs',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          console.log('📠 Realtime: New print job inserted!', payload.new?.id);
          if (payload.new && payload.new.status === 'pending') {
            executeJob(payload.new);
          }
        }
      )
      .subscribe((status) => {
        console.log('📠 Realtime subscription status:', status);
      });

    // ===== 3. Polling as fallback (every 5 seconds) =====
    // Realtime should handle most cases, but polling catches any missed events
    const intervalId = setInterval(fetchPendingJobs, 5000);

    return () => {
      console.log('📠 PrintListener cleanup');
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [isPrintStation, currentUser, config]);

  return null;
}
