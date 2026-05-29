import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Printer, X, Trash2, PauseCircle, PlayCircle, Trash, Eye, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { fetchPendingPrintJobs, cancelPrintJob, clearAllPendingPrintJobs } from '../store/data';
import { useToast } from '../context/AppContext';

export default function PrintQueuePanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [isPaused, setIsPaused] = useState(() => localStorage.getItem('printingPaused') === 'true');
  const [loading, setLoading] = useState(false);
  const [expandedJob, setExpandedJob] = useState(null); // job id to show detail
  const [previewJob, setPreviewJob] = useState(null); // job to show full bill preview
  const { addToast } = useToast();
  const intervalRef = useRef(null);

  // ===== Duplicate Detection =====
  // Compute a content signature for each job to detect duplicates
  const getJobSignature = useCallback((job) => {
    if (job.type === 'BILL') {
      const billNo = job.content?.bill?.billNumber;
      return billNo ? `BILL:${billNo}` : `BILL:${job.id}`;
    } else if (job.type === 'KOT') {
      const orderId = job.content?.order?.id;
      const tableLabel = job.content?.tableLabel || '';
      const itemSig = (job.content?.order?.items || [])
        .map(i => `${i.name}:${i.quantity}`)
        .sort()
        .join('|');
      return orderId ? `KOT:${orderId}:${tableLabel}:${itemSig}` : `KOT:${job.id}`;
    }
    return `OTHER:${job.id}`;
  }, []);

  // Find which jobs are duplicates (keep the oldest, mark rest as dupes)
  const { duplicateIds, duplicateCount } = useMemo(() => {
    const sigMap = new Map(); // signature → first job id
    const dupes = new Set();
    for (const job of jobs) {
      const sig = getJobSignature(job);
      if (sigMap.has(sig)) {
        dupes.add(job.id); // this is a duplicate
      } else {
        sigMap.set(sig, job.id);
      }
    }
    return { duplicateIds: dupes, duplicateCount: dupes.size };
  }, [jobs, getJobSignature]);

  const loadJobs = useCallback(async () => {
    try {
      const data = await fetchPendingPrintJobs();
      setJobs(data);
    } catch {
      // silent — panel is informational
    }
  }, []);

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
      if (expandedJob === jobId) setExpandedJob(null);
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
      setExpandedJob(null);
      addToast('🧹 Queue cleared', 'success');
    } catch {
      addToast('Failed to clear queue', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Remove all duplicate jobs (keep oldest of each)
  const handleRemoveDuplicates = async () => {
    if (duplicateCount === 0) return;
    setLoading(true);
    try {
      const idsToRemove = [...duplicateIds];
      for (const id of idsToRemove) {
        try {
          await cancelPrintJob(id);
        } catch { /* continue */ }
      }
      setJobs(prev => prev.filter(j => !duplicateIds.has(j.id)));
      setExpandedJob(null);
      addToast(`🧹 Removed ${idsToRemove.length} duplicate(s)`, 'success');
    } catch {
      addToast('Failed to remove duplicates', 'error');
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

  // Extract useful info from job content
  const getJobInfo = (job) => {
    const c = job.content || {};
    if (job.type === 'BILL') {
      const bill = c.bill || {};
      return {
        tableLabel: bill.tableNumber || '',
        total: bill.total || 0,
        billNumber: bill.billNumber || '',
        itemCount: (bill.items || []).length,
        items: bill.items || [],
        restaurantName: bill.restaurantName || '',
        subtotal: bill.subtotal || 0,
        discount: bill.discount || 0,
        taxRate: bill.taxRate || 0,
        cashierName: bill.cashierName || '',
        hasBillData: !!bill.billNumber,
      };
    } else {
      // KOT
      const order = c.order || {};
      return {
        tableLabel: c.tableLabel || order.tableNumber || order.tableLabel || '',
        total: (order.items || []).reduce((s, i) => s + ((i.price || 0) * (i.quantity || 0)), 0),
        billNumber: '',
        itemCount: (order.items || []).length,
        items: order.items || [],
        hasBillData: false,
      };
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
      {isOpen && <div className="pq-backdrop" onClick={() => { setIsOpen(false); setExpandedJob(null); }} />}

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
          <button className="pq-close-btn" onClick={() => { setIsOpen(false); setExpandedJob(null); }}>
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

        {/* Duplicate warning */}
        {duplicateCount > 0 && (
          <div className="pq-status-bar duplicate">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
              <AlertTriangle size={13} />
              <span>{duplicateCount} duplicate{duplicateCount > 1 ? 's' : ''} detected</span>
            </div>
            <button className="pq-dedup-btn" onClick={handleRemoveDuplicates} disabled={loading}>
              REMOVE DUPLICATES
            </button>
          </div>
        )}

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
            jobs.map((job) => {
              const info = getJobInfo(job);
              const isExpanded = expandedJob === job.id;
              return (
                <div key={job.id} className="pq-job-wrapper">
                  <div className="pq-job-item" onClick={() => setExpandedJob(isExpanded ? null : job.id)} style={{ cursor: 'pointer' }}>
                    <div className={`pq-job-type ${job.type === 'KOT' ? 'kot' : 'bill'}`}>
                      {job.type === 'KOT' ? '🍴' : '💵'}
                    </div>
                    <div className="pq-job-info">
                      <div className="pq-job-name">
                        {job.type || 'PRINT'}
                        {info.tableLabel && (
                          <span className="pq-job-table"> — T{info.tableLabel}</span>
                        )}
                        {info.billNumber && (
                          <span className="pq-job-billno"> #{info.billNumber}</span>
                        )}
                        {duplicateIds.has(job.id) && (
                          <span className="pq-job-dupe-badge">DUPLICATE</span>
                        )}
                      </div>
                      <div className="pq-job-meta">
                        {formatTime(job.created_at)}
                        <span className="pq-job-detail-chip">{info.itemCount} item{info.itemCount !== 1 ? 's' : ''}</span>
                        {info.total > 0 && (
                          <span className="pq-job-total">₹{Math.round(info.total)}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />}
                      <button
                        className="pq-job-remove"
                        onClick={(e) => { e.stopPropagation(); handleCancelJob(job.id); }}
                        disabled={loading}
                        title="Remove from queue"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="pq-job-detail">
                      {/* Items list */}
                      <div className="pq-detail-items">
                        <div className="pq-detail-items-header">
                          <span>ITEM</span>
                          <span>QTY</span>
                          <span>PRICE</span>
                        </div>
                        {info.items.slice(0, 15).map((item, i) => (
                          <div key={i} className="pq-detail-item-row">
                            <span className="pq-detail-item-name">{item.name}</span>
                            <span className="pq-detail-item-qty">×{item.quantity || 1}</span>
                            <span className="pq-detail-item-price">₹{((item.price || 0) * (item.quantity || 1)).toFixed(0)}</span>
                          </div>
                        ))}
                        {info.items.length > 15 && (
                          <div className="pq-detail-more">+{info.items.length - 15} more items</div>
                        )}
                      </div>

                      {/* Summary row */}
                      {info.total > 0 && (
                        <div className="pq-detail-summary">
                          <span>TOTAL</span>
                          <span className="pq-detail-total-value">₹{Math.round(info.total)}</span>
                        </div>
                      )}

                      {/* View full bill button (for BILL type only) */}
                      {job.type === 'BILL' && info.hasBillData && (
                        <button className="pq-detail-view-btn" onClick={(e) => { e.stopPropagation(); setPreviewJob(job); }}>
                          <Eye size={12} /> VIEW FULL BILL
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Full Bill Preview Modal */}
      {previewJob && (() => {
        const bill = previewJob.content?.bill || {};
        const halfRate = (parseFloat(bill.taxRate) || 0) / 2;
        const subtotal = bill.subtotal || 0;
        const sgst = Math.round((subtotal * halfRate) / 100 * 100) / 100;
        const cgst = sgst;
        return (
          <div className="pq-preview-backdrop" onClick={() => setPreviewJob(null)}>
            <div className="pq-preview-modal" onClick={e => e.stopPropagation()}>
              <div className="pq-preview-header">
                <span>📄 BILL PREVIEW</span>
                <button className="pq-close-btn" onClick={() => setPreviewJob(null)}><X size={16} /></button>
              </div>
              <div className="pq-preview-body">
                <div className="pq-receipt">
                  <div className="pq-receipt-restaurant">{bill.restaurantName || 'RESTAURANT'}</div>
                  {bill.restaurantAddress && <div className="pq-receipt-sub">{bill.restaurantAddress}</div>}
                  {bill.restaurantPhone && <div className="pq-receipt-sub">Phone: {bill.restaurantPhone}</div>}
                  {bill.gstNumber && <div className="pq-receipt-sub">GSTIN: {bill.gstNumber}</div>}
                  <div className="pq-receipt-divider" />
                  <div className="pq-receipt-invoice">[INVOICE]</div>
                  <div className="pq-receipt-divider" />
                  <div className="pq-receipt-row"><span>Bill No.: {bill.billNumber}</span></div>
                  <div className="pq-receipt-row"><span>Date: {bill.createdAt ? new Date(bill.createdAt).toLocaleString('en-IN') : ''}</span></div>
                  <div className="pq-receipt-row"><span>Table: {bill.tableNumber || '-'}</span>{bill.cashierName && <span>Cashier: {bill.cashierName}</span>}</div>
                  <div className="pq-receipt-divider" />
                  <div className="pq-receipt-items-header">
                    <span style={{ flex: 2 }}>Item</span>
                    <span style={{ flex: 1, textAlign: 'right' }}>Qty</span>
                    <span style={{ flex: 1, textAlign: 'right' }}>Amt</span>
                  </div>
                  {(bill.items || []).map((item, i) => (
                    <div key={i} className="pq-receipt-item-row">
                      <span style={{ flex: 2, textTransform: 'uppercase' }}>{item.name}</span>
                      <span style={{ flex: 1, textAlign: 'right' }}>{item.quantity || 1}</span>
                      <span style={{ flex: 1, textAlign: 'right' }}>{((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="pq-receipt-divider" />
                  <div className="pq-receipt-total-row"><span>Subtotal</span><span>{subtotal.toFixed(2)}</span></div>
                  {halfRate > 0 && (
                    <>
                      <div className="pq-receipt-tax-row"><span>SGST {halfRate.toFixed(1)}%</span><span>{sgst.toFixed(2)}</span></div>
                      <div className="pq-receipt-tax-row"><span>CGST {halfRate.toFixed(1)}%</span><span>{cgst.toFixed(2)}</span></div>
                    </>
                  )}
                  {(bill.discountAmount || 0) > 0 && (
                    <div className="pq-receipt-tax-row" style={{ color: 'var(--brand-success)' }}><span>Discount {bill.discount}%</span><span>-{bill.discountAmount.toFixed(2)}</span></div>
                  )}
                  <div className="pq-receipt-divider-thick" />
                  <div className="pq-receipt-grand-total"><span>TOTAL</span><span>₹{(bill.total || 0).toFixed(2)}</span></div>
                  <div className="pq-receipt-divider" />
                  <div className="pq-receipt-footer">Thank you for your visit</div>
                  <div className="pq-receipt-branding">Powered by RestoGrow</div>
                </div>
              </div>
              <div className="pq-preview-footer">
                <button className="pq-preview-close-btn" onClick={() => setPreviewJob(null)}>CLOSE</button>
                <button className="pq-preview-remove-btn" onClick={() => { handleCancelJob(previewJob.id); setPreviewJob(null); }}>
                  <Trash2 size={13} /> REMOVE FROM QUEUE
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
