import { useState, useEffect, useCallback, useRef } from 'react';
import { Printer, X, Trash2, PauseCircle, PlayCircle, Trash } from 'lucide-react';
import { fetchPendingPrintJobs, cancelPrintJob, clearAllPendingPrintJobs } from '../store/data';
import { useToast } from '../context/AppContext';

export default function PrintQueuePanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [isPaused, setIsPaused] = useState(() => localStorage.getItem('printingPaused') === 'true');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();
  const intervalRef = useRef(null);

  const loadJobs = useCallback(async () => {
    try {
      const data = await fetchPendingPrintJobs();
      setJobs(data);
    } catch {
      // silent — panel is informational
    }
  }, []);

  // Poll for jobs every 3 seconds when panel is open, or every 10s when closed (for badge count)
  useEffect(() => {
    loadJobs();
    const interval = isOpen ? 3000 : 10000;
    intervalRef.current = setInterval(loadJobs, interval);
    return () => clearInterval(intervalRef.current);
  }, [loadJobs, isOpen]);

  const handleTogglePause = () => {
    const newState = !isPaused;
    setIsPaused(newState);
    localStorage.setItem('printingPaused', newState.toString());
    addToast(newState ? '⏸ Printing PAUSED' : '▶ Printing RESUMED', 'info');
  };

  const handleCancelJob = async (jobId) => {
    setLoading(true);
    try {
      await cancelPrintJob(jobId);
      setJobs(prev => prev.filter(j => j.id !== jobId));
      addToast('Job removed from queue', 'success');
    } catch {
      addToast('Failed to remove job', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (jobs.length === 0) return;
    setLoading(true);
    try {
      await clearAllPendingPrintJobs();
      setJobs([]);
      addToast('🧹 Queue cleared', 'success');
    } catch {
      addToast('Failed to clear queue', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        className="pq-fab"
        onClick={() => setIsOpen(!isOpen)}
        title="Print Queue"
        id="print-queue-toggle"
      >
        <Printer size={18} />
        {jobs.length > 0 && (
          <span className="pq-badge">{jobs.length > 99 ? '99+' : jobs.length}</span>
        )}
        {isPaused && <span className="pq-paused-dot" />}
      </button>

      {/* Backdrop */}
      {isOpen && <div className="pq-backdrop" onClick={() => setIsOpen(false)} />}

      {/* Slide-out Panel */}
      <div className={`pq-panel ${isOpen ? 'open' : ''}`}>
        <div className="pq-panel-header">
          <div className="pq-panel-title">
            <Printer size={14} />
            <span>PRINT QUEUE</span>
            {jobs.length > 0 && (
              <span className="pq-panel-count">{jobs.length}</span>
            )}
          </div>
          <button className="pq-close-btn" onClick={() => setIsOpen(false)}>
            <X size={16} />
          </button>
        </div>

        {/* Controls */}
        <div className="pq-controls">
          <button
            className={`pq-control-btn ${isPaused ? 'paused' : 'active'}`}
            onClick={handleTogglePause}
          >
            {isPaused ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
            <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
          </button>
          <button
            className="pq-control-btn clear"
            onClick={handleClearAll}
            disabled={jobs.length === 0 || loading}
          >
            <Trash size={14} />
            <span>CLEAR ALL</span>
          </button>
        </div>

        {/* Status bar */}
        {isPaused && (
          <div className="pq-status-bar paused">
            ⏸ Printing is paused — jobs are queued but not sent to printer
          </div>
        )}

        {/* Job list */}
        <div className="pq-job-list">
          {jobs.length === 0 ? (
            <div className="pq-empty">
              <Printer size={28} strokeWidth={1.5} />
              <div className="pq-empty-title">Queue is empty</div>
              <div className="pq-empty-text">No pending print jobs</div>
            </div>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="pq-job-item">
                <div className={`pq-job-type ${job.type === 'KOT' ? 'kot' : 'bill'}`}>
                  {job.type === 'KOT' ? '🍴' : '💵'}
                </div>
                <div className="pq-job-info">
                  <div className="pq-job-name">
                    {job.type || 'PRINT'}
                    {job.content?.tableLabel && (
                      <span className="pq-job-table"> — T{job.content.tableLabel}</span>
                    )}
                  </div>
                  <div className="pq-job-meta">
                    {formatTime(job.created_at)}
                    <span className="pq-job-id">#{(job.id || '').slice(-6)}</span>
                  </div>
                </div>
                <button
                  className="pq-job-remove"
                  onClick={() => handleCancelJob(job.id)}
                  disabled={loading}
                  title="Remove from queue"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
