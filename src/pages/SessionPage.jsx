import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useToast } from '../context/AppContext';
import { startSession, endSession, getCurrentSession, getSessionBills, getSplitReport, getCategories, getSessions } from '../store/data';
import { Play, Square, Clock, DollarSign, Printer, TrendingUp, BarChart3, Coffee, Wine, Calendar, ChevronDown, ChevronUp, Eye } from 'lucide-react';

export default function SessionPage() {
  const { currentUser, currentSession, refresh, config, sessions: allSessions, categories, bills, refreshing = false } = useApp();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [endReport, setEndReport] = useState(null);
  const [viewingSession, setViewingSession] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState(false);

  const pastSessions = (allSessions || []).filter(s => s.status === 'ended').reverse();
  const displayedSessions = expandedHistory ? pastSessions : pastSessions.slice(0, 5);

  const handleStartSession = async () => {
    try {
      await startSession(currentUser?.name || 'Admin');
      await refresh();
      addToast('✅ New session started! Good luck today.', 'success');
    } catch (e) { addToast('Failed: ' + e.message, 'error'); }
  };

  const handleEndSession = async () => {
    if (!currentSession) return;
    const sessionBills = getSessionBills(currentSession.id, bills);
    const splitReport = getSplitReport(sessionBills, categories);

    const report = buildReportData(currentSession, sessionBills, splitReport);

    try {
      await endSession(currentUser?.name || 'Admin');
      await refresh();
      setEndReport(report);
      setShowEndConfirm(false);
      addToast('Session ended. Daily report ready.', 'success');
    } catch (e) { addToast('Failed: ' + e.message, 'error'); }
  };

  const handleViewSession = (session) => {
    const sessionBills = getSessionBills(session.id, bills);
    const splitReport = getSplitReport(sessionBills, categories);
    const report = buildReportData(session, sessionBills, splitReport);
    setViewingSession(report);
  };

  function buildReportData(session, sessionBills, splitReport) {
    const report = {
      session: { ...session },
      bills: sessionBills,
      totalRevenue: sessionBills.reduce((s, b) => s + (b.total || 0), 0),
      totalBills: sessionBills.length,
      totalItems: sessionBills.reduce((s, b) => s + (b.items || []).reduce((ss, i) => ss + (i.quantity || 0), 0), 0),
      paymentBreakdown: { Cash: 0, Card: 0, UPI: 0 },
      split: splitReport,
    };
    sessionBills.forEach(b => {
      report.paymentBreakdown[b.paymentMode] = (report.paymentBreakdown[b.paymentMode] || 0) + b.total;
    });
    return report;
  }

  const handlePrintReport = (reportData) => {
    const r = reportData || endReport;
    if (!r) return;
    const html = buildDailyReportHTML(r, config);
    printHTML(html);
  };

  const formatTime = (isoStr) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };
  const formatDate = (isoStr) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const getDuration = (start, end) => {
    if (!start || !end) return '—';
    const ms = new Date(end) - new Date(start);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // ===== Viewing a past session report =====
  if (viewingSession) {
    return renderReport(viewingSession, 'SESSION REPORT', () => setViewingSession(null), handlePrintReport);
  }

  // ===== End-of-day report (just ended) =====
  if (endReport) {
    return renderReport(endReport, 'END OF DAY REPORT', () => setEndReport(null), handlePrintReport);
  }

  function renderReport(r, title, onDone, onPrint) {
    return (
      <div className="page-content">
        <div className="page-header">
          <div className="page-title"><BarChart3 size={16} /> {title}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => onPrint(r)}>
              <Printer size={14} /> PRINT REPORT
            </button>
            <button className="btn btn-primary" onClick={onDone}>
              DONE
            </button>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
          {formatDate(r.session.startedAt)} · {formatTime(r.session.startedAt)} — {formatTime(r.session.endedAt)} · By {r.session.startedBy}
        </div>

        {/* Summary Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon green"><DollarSign size={20} /></div>
            <div>
              <div className="stat-label">Total Revenue</div>
              <div className="stat-value" style={{ color: 'var(--brand-success)' }}>{config.currency}{r.totalRevenue}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple"><TrendingUp size={20} /></div>
            <div>
              <div className="stat-label">Total Bills</div>
              <div className="stat-value">{r.totalBills}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange"><Clock size={20} /></div>
            <div>
              <div className="stat-label">Duration</div>
              <div className="stat-value" style={{ fontSize: '14px' }}>
                {getDuration(r.session.startedAt, r.session.endedAt)}
              </div>
            </div>
          </div>
        </div>

        {/* Payment + Bar/Kitchen */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
          <div className="card">
            <div className="card-header"><span className="card-title">PAYMENT BREAKDOWN</span></div>
            <div className="card-body" style={{ padding: '0 12px' }}>
              <table className="data-table" style={{ marginBottom: '8px' }}>
                <tbody>
                  <tr><td style={{ fontWeight: 600 }}>CASH</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{config.currency}{r.paymentBreakdown.Cash}</td></tr>
                  <tr><td style={{ fontWeight: 600 }}>CARD</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{config.currency}{r.paymentBreakdown.Card}</td></tr>
                  <tr><td style={{ fontWeight: 600 }}>UPI</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{config.currency}{r.paymentBreakdown.UPI}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">BAR vs KITCHEN</span></div>
            <div className="card-body" style={{ padding: '0 12px' }}>
              <table className="data-table" style={{ marginBottom: '8px' }}>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600 }}><Wine size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />BAR</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{r.split.barQty} items</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brand-primary-light)' }}>{config.currency}{r.split.barTotal}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}><Coffee size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />KITCHEN</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{r.split.kitchenQty} items</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brand-warning)' }}>{config.currency}{r.split.kitchenTotal}</td>
                  </tr>
                  <tr style={{ borderTop: '2px solid var(--border-color)' }}>
                    <td style={{ fontWeight: 800 }}>TOTAL</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{r.split.barQty + r.split.kitchenQty} items</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--brand-success)' }}>{config.currency}{r.totalRevenue}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Detailed Bar + Kitchen Items */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title"><Wine size={12} style={{ display: 'inline', marginRight: '6px' }} />BAR ITEMS SOLD</span>
              <span className="badge badge-info">{r.split.barQty} qty</span>
            </div>
            <div className="card-body" style={{ padding: 0, maxHeight: '300px', overflow: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>ITEM</th><th style={{ textAlign: 'center' }}>QTY</th><th style={{ textAlign: 'right' }}>REVENUE</th></tr></thead>
                <tbody>
                  {r.split.bar.length > 0 ? r.split.bar.map(item => (
                    <tr key={item.name}><td style={{ fontWeight: 600 }}>{item.name}</td><td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{item.qty}</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{config.currency}{item.revenue}</td></tr>
                  )) : <tr><td colSpan="3" style={{ textAlign: 'center', padding: '16px' }}>No bar items sold</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title"><Coffee size={12} style={{ display: 'inline', marginRight: '6px' }} />KITCHEN ITEMS</span>
              <span className="badge badge-warning">{r.split.kitchenQty} qty</span>
            </div>
            <div className="card-body" style={{ padding: 0, maxHeight: '300px', overflow: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>ITEM</th><th style={{ textAlign: 'center' }}>QTY</th><th style={{ textAlign: 'right' }}>REVENUE</th></tr></thead>
                <tbody>
                  {r.split.kitchen.length > 0 ? r.split.kitchen.map(item => (
                    <tr key={item.name}><td style={{ fontWeight: 600 }}>{item.name}</td><td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{item.qty}</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{config.currency}{item.revenue}</td></tr>
                  )) : <tr><td colSpan="3" style={{ textAlign: 'center', padding: '16px' }}>No kitchen items sold</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== MAIN SESSION SCREEN =====
  return (
    <div className="page-content">
      <div className="session-hero">
        <div className="session-branding">
          <div className="session-logo">RG</div>
          <h1 className="session-title">{config.restaurantName || 'RestoGrow POS'}</h1>
          <p className="session-date">{formatDate(new Date().toISOString())} — {new Date().toLocaleDateString('en-IN', { weekday: 'long' })}</p>
        </div>

        {currentSession ? (
          <div className="session-active-panel">
            <div className="session-status-badge active">
              <span className="pulse-dot" /> SESSION ACTIVE
            </div>
            <div className="session-info">
              <div className="session-info-row">
                <Clock size={14} />
                <span>Started at {formatTime(currentSession.startedAt)}</span>
              </div>
              <div className="session-info-row">
                <span>By: {currentSession.startedBy}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-success btn-lg" style={{ flex: 1 }} onClick={() => navigate('/tables')}>
                <Play size={16} /> GO TO TABLES
              </button>
              {currentUser?.role === 'admin' && (
                <button className="btn btn-danger btn-lg" onClick={() => setShowEndConfirm(true)}>
                  <Square size={16} /> END SESSION
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="session-start-panel">
            <div className="session-status-badge inactive">
              NO ACTIVE SESSION
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '16px', textAlign: 'center' }}>
              Start a new session to begin taking orders for today.
            </p>
            <button className="btn btn-success btn-lg session-start-btn" onClick={handleStartSession}>
              <Play size={18} /> START NEW SESSION
            </button>
          </div>
        )}
      </div>

      {/* ===== PAST SESSIONS HISTORY ===== */}
      {pastSessions.length > 0 && (
        <div className="past-sessions-section">
          <div className="past-sessions-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={14} />
              <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>PAST SESSIONS</span>
              <span className="badge badge-info">{pastSessions.length}</span>
            </div>
          </div>

          <div className="past-sessions-list">
            {displayedSessions.map(session => {
              const sessionBills = getSessionBills(session.id, bills || []);
              const revenue = sessionBills.reduce((s, b) => s + (b.total || 0), 0);
              return (
                <div key={session.id} className="past-session-row" onClick={() => handleViewSession(session)}>
                  <div className="past-session-date">
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>{formatDate(session.startedAt)}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                      {formatTime(session.startedAt)} — {formatTime(session.endedAt)}
                    </div>
                  </div>
                  <div className="past-session-meta">
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>By {session.startedBy}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                      {getDuration(session.startedAt, session.endedAt)}
                    </div>
                  </div>
                  <div className="past-session-stats">
                    <div style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--brand-success)' }}>
                      {config.currency}{revenue}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                      {sessionBills.length} bills
                    </div>
                  </div>
                  <div className="past-session-action">
                    <Eye size={14} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {pastSessions.length > 5 && (
            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '8px', fontSize: '11px' }}
              onClick={() => setExpandedHistory(!expandedHistory)}
            >
              {expandedHistory ? <><ChevronUp size={12} /> SHOW LESS</> : <><ChevronDown size={12} /> SHOW ALL {pastSessions.length} SESSIONS</>}
            </button>
          )}
        </div>
      )}

      {/* End Session Confirm Modal */}
      {showEndConfirm && (
        <div className="modal-backdrop" onClick={() => setShowEndConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">END SESSION?</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowEndConfirm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '8px', color: 'var(--text-secondary)' }}>
                This will end the current session and generate a daily sales report.
              </p>
              <p style={{ color: 'var(--brand-danger)', fontSize: '11px', fontWeight: 600 }}>
                ⚠ Make sure all tables are cleared and bills are settled before ending.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEndConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleEndSession}>
                <Square size={14} /> END SESSION & GENERATE REPORT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Print HTML helpers =====
function buildDailyReportHTML(report, config) {
  const r = report;
  return `<!DOCTYPE html>
<html><head><title>Daily Report - ${r.session.date}</title>
<style>
  @page { margin: 0; size: 80mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; padding: 4mm; font-size: 11px; color: #000; }
  .c { text-align: center; } .b { font-weight: bold; }
  .d { border-top: 2px dashed #000; margin: 5px 0; }
  .r { display: flex; justify-content: space-between; padding: 2px 0; }
  h2 { font-size: 14px; text-align: center; margin-bottom: 4px; }
  h3 { font-size: 11px; margin: 6px 0 3px; text-transform: uppercase; font-weight: 900; }
  .item { display: flex; justify-content: space-between; padding: 1px 0; font-size: 10px; }
  .total-row { display: flex; justify-content: space-between; padding: 2px 0; font-weight: bold; border-top: 1px solid #000; margin-top: 2px; }
</style></head><body>

<div class="c b" style="font-size:14px">${config.restaurantName || 'RestoGrow POS'}</div>
${config.address ? `<div class="c" style="font-size:9px">${config.address}</div>` : ''}
${config.phone ? `<div class="c" style="font-size:9px">Tel: ${config.phone}</div>` : ''}

<div class="d"></div>

<h2>DAILY REPORT</h2>
<div class="c" style="font-size:9px">${r.session.date}</div>
<div class="c" style="font-size:9px">${new Date(r.session.startedAt).toLocaleTimeString()} — ${r.session.endedAt ? new Date(r.session.endedAt).toLocaleTimeString() : 'Active'}</div>
<div class="c" style="font-size:9px">By: ${r.session.startedBy}</div>

<div class="d"></div>

<div class="r b"><span>Total Bills</span><span>${r.totalBills}</span></div>
<div class="r b"><span>Items Sold</span><span>${r.totalItems}</span></div>
<div class="r b" style="font-size:13px"><span>REVENUE</span><span>${config.currency}${r.totalRevenue}</span></div>

<div class="d"></div>

<h3>Payment</h3>
<div class="r"><span>Cash</span><span>${config.currency}${r.paymentBreakdown.Cash}</span></div>
<div class="r"><span>Card</span><span>${config.currency}${r.paymentBreakdown.Card}</span></div>
<div class="r"><span>UPI</span><span>${config.currency}${r.paymentBreakdown.UPI}</span></div>

<div class="d"></div>

<h3>Bar vs Kitchen</h3>
<div class="r"><span>🍸 Bar (${r.split.barQty})</span><span>${config.currency}${r.split.barTotal}</span></div>
<div class="r"><span>🍽️ Kitchen (${r.split.kitchenQty})</span><span>${config.currency}${r.split.kitchenTotal}</span></div>

<div class="d"></div>

<h3>🍸 Bar Items</h3>
${r.split.bar.map(i => `<div class="item"><span>${i.name} ×${i.qty}</span><span>${config.currency}${i.revenue}</span></div>`).join('')}
${r.split.bar.length === 0 ? '<div class="item"><span>—</span></div>' : ''}
<div class="total-row"><span>BAR TOTAL</span><span>${config.currency}${r.split.barTotal}</span></div>

<div style="margin-top:4px"></div>

<h3>🍽️ Kitchen Items</h3>
${r.split.kitchen.map(i => `<div class="item"><span>${i.name} ×${i.qty}</span><span>${config.currency}${i.revenue}</span></div>`).join('')}
${r.split.kitchen.length === 0 ? '<div class="item"><span>—</span></div>' : ''}
<div class="total-row"><span>KITCHEN TOTAL</span><span>${config.currency}${r.split.kitchenTotal}</span></div>

<div class="d"></div>

<div class="c" style="font-size:9px;margin-top:4px">
  ${new Date().toLocaleString()}
</div>
<div class="c" style="margin-top:4px;font-size:10px">--- END REPORT ---</div>

</body></html>`;
}

function printHTML(html) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.opacity = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow || iframe.contentDocument;
  const printDoc = doc.document || doc;
  printDoc.open();
  printDoc.write(html);
  printDoc.close();
  iframe.onload = () => {
    try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch(e) {}
    setTimeout(() => document.body.removeChild(iframe), 2000);
  };
}
