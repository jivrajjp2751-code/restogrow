import { useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { useApp } from '../context/AppContext';
import { markPrintJobDone } from '../store/data';
import { printSplitKOT, printBillDirect } from '../utils/print';

export default function PrintListener() {
  const { config, currentSession, currentUser, categories } = useApp();
  
  // This listener should only run if the device is designated as a print station
  // For now, we'll run it for all, but user can toggle it in settings or we can check role
  const isPrintStation = localStorage.getItem('isPrintStation') === 'true';

  useEffect(() => {
    if (!isPrintStation || !currentUser || !supabase) return;

    const channel = supabase
      .channel('print_jobs_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'print_jobs',
          filter: `restaurant_id=eq.${currentUser.restaurant_id}`
        },
        async (payload) => {
          const job = payload.new;
          if (job.status !== 'pending') return;

          try {
            console.log('Incoming print job:', job.type);
            
            if (job.type === 'KOT') {
              // content: { order, tableLabel }
              printSplitKOT(job.content.order, job.content.tableLabel, categories || [], config);
            } else if (job.type === 'BILL') {
              // content: { bill }
              printBillDirect({ ...job.content.bill, currency: config.currency });
            }

            // Mark as done so others don't print it
            await markPrintJobDone(job.id);
          } catch (err) {
            console.error('Print job failed:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isPrintStation, currentUser, config, categories]);

  return null; // Or a small status indicator
}
