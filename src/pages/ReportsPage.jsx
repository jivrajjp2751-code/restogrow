import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getSplitReport, getMonthBills, getMostSoldLiquor, getSessionBills } from '../store/data';
import { TrendingUp, DollarSign, PieChart, Printer, Award } from 'lucide-react';

export default function ReportsPage() {
  const { config = {}, bills = [], sessions = [] } = useApp();
  const [reportType, setReportType] = useState('daily'); // daily, monthly, session
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedSessionId, setSelectedSessionId] = useState('');
  
  const today = new Date().toISOString().split('T')[0];
  
  // Get filtered bills based on report type
  let filteredBills = [];
  let reportLabel = '';
  if (reportType === 'daily') {
    filteredBills = (bills || []).filter(b => {
      const d = b.createdAt || b.created_at;
      return d?.startsWith(today);
    });
    reportLabel = `Today — ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  } else if (reportType === 'monthly') {
    filteredBills = getMonthBills(selectedMonth, bills || []);
    const [y, m] = selectedMonth.split('-');
    reportLabel = `${new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;
  } else if (reportType === 'session' && selectedSessionId) {
    const s = sessions.find(se => se.id === selectedSessionId);
    filteredBills = getSessionBills(s, bills);
    reportLabel = s ? `Session: ${s.date} (${s.startedBy})` : '';
  }

  // KPI Calculations
  const totalRevenue = filteredBills.reduce((s, b) => s + (b.total || 0), 0);
  const totalCost = filteredBills.reduce((s, b) => s + (b.items || []).reduce((ss, i) => ss + ((i.buyingPrice || 0) * (i.quantity || 0)), 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const totalBills = filteredBills.length;
  const totalItems = filteredBills.reduce((s, b) => s + (b.items || []).reduce((ss, i) => ss + (i.quantity || 0), 0), 0);
  
  // Split Report: bar vs kitchen
  const splitReport = getSplitReport(filteredBills, null, config);

  // Payment Breakdown
  const paymentSales = { Cash: 0, Card: 0, UPI: 0 };
  filteredBills.forEach(bill => {
    if (paymentSales[bill.paymentMode] !== undefined) {
      paymentSales[bill.paymentMode] += bill.total;
    } else {
      paymentSales.Cash += bill.total;
    }
  });

  // Monthly most sold items
  const mostSoldLiquor = reportType === 'monthly' ? getMostSoldLiquor(selectedMonth, bills, null, config) : [];

  // Department Breakdown
  const deptSales = {};
  filteredBills.forEach(bill => {
    (bill.items || []).forEach(item => {
      let deptName = 'Other';
      splitReport.departments?.forEach(d => {
         if (item.categoryType === d.id || item.deptId === d.id || (d.items && d.items.find(i => i.name === item.name))) {
            deptName = d.name;
         }
      });
      if (!deptSales[deptName]) deptSales[deptName] = { qty: 0, revenue: 0 };
      deptSales[deptName].qty += (item.quantity || 0);
      deptSales[deptName].revenue += (item.price || 0) * (item.quantity || 0);
    });
  });
  const deptData = Object.entries(deptSales).sort((a,b) => b[1].revenue - a[1].revenue);

  const handlePrintReport = () => {
    const html = buildPrintableReport();
    printHTML(html);
  };

  function buildPrintableReport() {
    return `<!DOCTYPE html>
<html><head><title>${reportType === 'daily' ? 'Daily' : reportType === 'monthly' ? 'Monthly' : 'Session'} Sales Report</title>
<style>
  @page { margin: 10mm; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; padding: 10mm; font-size: 12px; color: #000; max-width: 800px; margin: 0 auto; }
  .c { text-align: center; } .b { font-weight: bold; }
  .d { border-top: 2px dashed #000; margin: 8px 0; }
  .r { display: flex; justify-content: space-between; padding: 2px 0; }
  h2 { font-size: 16px; text-align: center; margin-bottom: 6px; }
  h3 { font-size: 13px; margin: 10px 0 4px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0 8px; }
  th { text-align: left; padding: 3px 6px; font-size: 10px; border-bottom: 1px solid #000; text-transform: uppercase; }
  td { padding: 2px 6px; font-size: 11px; border-bottom: 1px solid #eee; }
  .total-row td { font-weight: bold; border-top: 2px solid #000; border-bottom: none; }
  .section-title { font-size: 12px; font-weight: bold; margin: 12px 0 4px; padding: 3px 6px; background: #f0f0f0; }
</style></head><body>

<div class="c b" style="font-size:20px">${config.restaurantName || 'RestoGrow POS'}</div>
${config.address ? `<div class="c" style="font-size:10px">${config.address}</div>` : ''}
<h2>${reportType.toUpperCase()} SALES REPORT</h2>
<div class="c">${reportLabel}</div>
<div class="d"></div>

<div class="r b"><span>Total Bills</span><span>${totalBills}</span></div>
<div class="r b"><span>Total Items Sold</span><span>${totalItems}</span></div>
<div class="r b" style="font-size:14px"><span>TOTAL REVENUE</span><span>${config.currency}${totalRevenue}</span></div>
<div class="r b" style="font-size:14px"><span>TOTAL PROFIT</span><span>${config.currency}${totalProfit}</span></div>
<div class="d"></div>

<h3>Payment Breakdown</h3>
<div class="r"><span>Cash</span><span>${config.currency}${paymentSales.Cash}</span></div>
<div class="r"><span>Card</span><span>${config.currency}${paymentSales.Card}</span></div>
<div class="r"><span>UPI</span><span>${config.currency}${paymentSales.UPI}</span></div>
<div class="d"></div>

<h3>Sales Summary</h3>
${(splitReport.departments || []).map(d => `<div class="r"><span>${d.name}: ${d.qty} items</span><span>Rev: ${config.currency}${d.revenue} | Prf: ${config.currency}${d.profit}</span></div>`).join('')}
<div class="d"></div>

${(splitReport.departments || []).map(d => `
<div class="section-title">${d.name.toUpperCase()} ITEMS</div>
<table>
<tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Revenue</th><th style="text-align:right">Profit</th></tr>
${d.items.map(i => `<tr><td>${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${config.currency}${i.revenue}</td><td style="text-align:right">${config.currency}${i.profit}</td></tr>`).join('')}
<tr class="total-row"><td>${d.name.toUpperCase()} TOTAL</td><td style="text-align:center">${d.qty}</td><td style="text-align:right">${config.currency}${d.revenue}</td><td style="text-align:right">${config.currency}${d.profit}</td></tr>
</table>`).join('')}

${reportType === 'monthly' && mostSoldLiquor.length > 0 ? `
<div class="section-title">🏆 TOP SELLING ITEMS (${reportLabel})</div>
<table>
<tr><th>#</th><th>Item</th><th style="text-align:center">Qty Sold</th><th style="text-align:right">Revenue</th></tr>
${mostSoldLiquor.slice(0, 20).map((i, idx) => `<tr><td>${idx + 1}</td><td>${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${config.currency}${i.revenue}</td></tr>`).join('')}
</table>` : ''}

<h3>Department Sales</h3>
<table>
<tr><th>Department</th><th style="text-align:center">Qty</th><th style="text-align:right">Revenue</th></tr>
${deptData.map(([name, data]) => `<tr><td>${name}</td><td style="text-align:center">${data.qty}</td><td style="text-align:right">${config.currency}${data.revenue}</td></tr>`).join('')}
</table>

<div class="d"></div>
<div class="c" style="margin-top:16px; font-size:10px">Generated on ${new Date().toLocaleString()}</div>
<div class="c" style="margin-top:6px">--- END REPORT ---</div>

</body></html>`;
  }

  const endedSessions = sessions.filter(s => s.status === 'ended').reverse().slice(0, 30);

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title"><TrendingUp size={16} /> REPORTS</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="tabs" style={{ marginBottom: 0, border: 'none' }}>
            <button className={`tab ${reportType === 'daily' ? 'active' : ''}`} onClick={() => setReportType('daily')}>TODAY</button>
            <button className={`tab ${reportType === 'monthly' ? 'active' : ''}`} onClick={() => setReportType('monthly')}>MONTHLY</button>
            <button className={`tab ${reportType === 'session' ? 'active' : ''}`} onClick={() => setReportType('session')}>SESSION</button>
          </div>
          <button className="btn btn-secondary" onClick={handlePrintReport} title="Print Report">
            <Printer size={14} /> PRINT
          </button>
        </div>
      </div>

      {/* Month selector for monthly */}
      {reportType === 'monthly' && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
          <label className="input-label" style={{ marginBottom: 0 }}>MONTH:</label>
          <input type="month" className="input" value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{ width: '180px' }} />
        </div>
      )}

      {/* Session selector */}
      {reportType === 'session' && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
          <label className="input-label" style={{ marginBottom: 0 }}>SESSION:</label>
          <select className="select" value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)}
            style={{ width: '300px' }}>
            <option value="">— Select a session —</option>
            {endedSessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.date} — {s.startedBy} ({new Date(s.startedAt).toLocaleTimeString()} to {new Date(s.endedAt).toLocaleTimeString()})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Report Label */}
      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}>
        {reportLabel}
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><DollarSign size={20} /></div>
          <div>
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value" style={{ color: 'var(--brand-success)' }}>{config.currency}{totalRevenue}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><PieChart size={20} /></div>
          <div>
            <div className="stat-label">Net Profit</div>
            <div className="stat-value" style={{ color: 'var(--brand-primary-light)' }}>{config.currency}{totalProfit}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><Award size={20} /></div>
          <div>
            <div className="stat-label">Total Bills</div>
            <div className="stat-value">{totalBills}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px', marginTop: '12px' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Payment Breakdown */}
          <div className="card">
            <div className="card-header"><span className="card-title">PAYMENTS</span></div>
            <div className="card-body" style={{ padding: '0 12px' }}>
              <table className="data-table" style={{ marginTop: '4px', marginBottom: '8px' }}>
                <tbody>
                  <tr><td style={{ fontWeight: 600 }}>CASH</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{config.currency}{paymentSales.Cash}</td></tr>
                  <tr><td style={{ fontWeight: 600 }}>CARD</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{config.currency}{paymentSales.Card}</td></tr>
                  <tr><td style={{ fontWeight: 600 }}>UPI</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{config.currency}{paymentSales.UPI}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Bar vs Kitchen Split */}
          <div className="card">
            <div className="card-header"><span className="card-title">DEPARTMENT SALES</span></div>
            <div className="card-body" style={{ padding: '0 12px' }}>
              <table className="data-table" style={{ marginBottom: '8px' }}>
                <tbody>
                  {(splitReport.departments || []).map(d => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}><PieChart size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />{d.name.toUpperCase()}</td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{d.qty} items</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brand-primary-light)' }}>
                        <div style={{ fontSize: '11px' }}>{config.currency}{d.revenue}</div>
                        <div style={{ fontSize: '9px', opacity: 0.7 }}>P: {config.currency}{d.profit}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Department Sales */}
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header"><span className="card-title">SALES BY DEPARTMENT</span></div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead><tr><th>DEPARTMENT</th><th style={{ textAlign: 'center' }}>QTY</th><th style={{ textAlign: 'right' }}>REVENUE</th></tr></thead>
                <tbody>
                  {deptData.length > 0 ? deptData.map(([name, data]) => (
                    <tr key={name}>
                      <td style={{ fontWeight: 600 }}>{name}</td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{data.qty}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{config.currency}{data.revenue}</td>
                    </tr>
                  )) : <tr><td colSpan="3" style={{ textAlign: 'center', padding: '16px' }}>No sales data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(splitReport.departments || []).map(d => (
            <div key={d.id} className="card">
              <div className="card-header">
                <span className="card-title"><PieChart size={12} style={{ display: 'inline', marginRight: '6px' }} />{d.name.toUpperCase()} ITEMS SOLD</span>
                <span className="badge badge-info">{d.qty} qty · {config.currency}{d.revenue}</span>
              </div>
              <div className="card-body" style={{ padding: 0, maxHeight: '250px', overflow: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>ITEM</th><th style={{ textAlign: 'center' }}>SOLD</th><th style={{ textAlign: 'right' }}>REVENUE</th></tr></thead>
                  <tbody>
                    {d.items && d.items.length > 0 ? d.items.map((item, idx) => (
                      <tr key={item.name}>
                        <td>
                          <span style={{ display: 'inline-block', width: '16px', color: 'var(--text-tertiary)', fontSize: '10px' }}>{idx+1}.</span>
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{item.qty}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          <div style={{ fontWeight: 700 }}>{config.currency}{item.revenue}</div>
                          <div style={{ fontSize: '9px', color: 'var(--brand-success)' }}>P: {config.currency}{item.profit}</div>
                        </td>
                      </tr>
                    )) : <tr><td colSpan="3" style={{ textAlign: 'center', padding: '16px' }}>No items sold</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Top Selling Items (Monthly Only) */}
          {reportType === 'monthly' && mostSoldLiquor.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title"><Award size={12} style={{ display: 'inline', marginRight: '6px' }} />TOP SELLING ITEMS</span>
              </div>
              <div className="card-body" style={{ padding: 0, maxHeight: '250px', overflow: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>#</th><th>ITEM</th><th style={{ textAlign: 'center' }}>SOLD</th><th style={{ textAlign: 'right' }}>REVENUE</th></tr></thead>
                  <tbody>
                    {mostSoldLiquor.slice(0, 15).map((item, idx) => (
                      <tr key={item.name}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{item.name}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{item.qty}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{config.currency}{item.revenue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
    try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch { /* ignore */ }
    setTimeout(() => document.body.removeChild(iframe), 2000);
  };
}
