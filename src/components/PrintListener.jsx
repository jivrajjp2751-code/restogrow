import { useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { useApp } from '../context/AppContext';
import { markPrintJobDone } from '../store/data';
import { printSplitKOT, printBillDirect } from '../utils/print';

export default function PrintListener() {
  const { config, currentUser } = useApp();
  
  // This listener should only run if the device is designated as a print station
  // For now, we'll run it for all, but user can toggle it in settings or we can check role
  const isPrintStation = localStorage.getItem('isPrintStation') === 'true';

  useEffect(() => {
    if (!isPrintStation || !currentUser || !supabase) return;

    let isPolling = false;

    const pollJobs = async () => {
      if (isPolling) return;
      isPolling = true;
      try {
        const { data, error } = await supabase
          .from('print_jobs')
          .select('*')
          .eq('status', 'pending')
          .eq('restaurant_id', currentUser.restaurant_id)
          .order('created_at', { ascending: true });
          
        if (error) throw error;
        
        if (data && data.length > 0) {
          console.log(`📠 Found ${data.length} new print jobs`);
          for (const job of data) {
            console.log('📄 Executing:', job.type, job.id);
            
            // Mark immediately so we don't double print
            await markPrintJobDone(job.id);

            try {
              if (job.type === 'KOT') {
                const results = printSplitKOT(job.content.order, job.content.tableLabel, null, config);
                console.log(`🍴 KOT Split Result: ${results.success ? 'Success' : 'No items matched departments'}`);
              } else if (job.type === 'BILL') {
                printBillDirect({ ...job.content.bill, currency: config.currency });
                console.log('💵 Bill printed');
              }
            } catch (err) {
              console.error('❌ Print job execution failed:', err);
            }
          }
        }
      } catch (e) {
        console.error('Print queue polling error:', e);
      } finally {
        isPolling = false;
      }
    };

    // Initial check
    pollJobs();
    
    // Poll every 4 seconds
    const intervalId = setInterval(pollJobs, 4000);

    return () => clearInterval(intervalId);
  }, [isPrintStation, currentUser, config]);

  return null; // Or a small status indicator
}
