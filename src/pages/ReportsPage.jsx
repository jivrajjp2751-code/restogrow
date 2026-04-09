import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getSplitReport, getMonthBills, getMostSoldLiquor, getSessionBills } from '../store/data';
import { TrendingUp, Calendar, DollarSign, PieChart, Printer, Wine, Coffee, Award } from 'lucide-react';

export default function ReportsPage() {
  const { config = {}, categories = [], bills = [], sessions = [] } = useApp();
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
  const totalBills = filteredBills.length;
  const totalItems = filteredBills.reduce((s, b) => s + (b.items || []).reduce((ss, i) => ss + (i.quantity || 0), 0), 0);
  
  // Split Report: bar vs kitchen
  const splitReport = getSplitReport(filteredBills, categories, config);

  // Payment Breakdown
  const paymentSales = { Cash: 0, Card: 0, UPI: 0 };
  filteredBills.forEach(bill => {
    if (paymentSales[bill.paymentMode] !== undefined) {
      paymentSales[bill.paymentMode] += bill.total;
    } else {
      paymentSales.Cash += bill.total;
    }
  });

  // Monthly most sold liquor
  const mostSoldLiquor = reportType === 'monthly' ? getMostSoldLiquor(selectedMonth, bills, categories) : [];

  // Category Breakdown
  const categorySales = {};
  filteredBills.forEach(bill => {
    (bill.items || []).forEach(item => {
      // bill_items only have categoryType, not categoryId
      const catType = item.categoryType || 'bar';
      const isKit = catType === 'kitchen';
      const catName = isKit ? splitReport.kitchenLabel : splitReport.barLabel;
      const catColor = isKit ? '#FDCB6E' : '#6C5CE7';
      if (!categorySales[catName]) categorySales[catName] = { qty: 0, revenue: 0, color: catColor, type: catType };
      categorySales[catName].qty += (item.quantity || 0);
      categorySales[catName].revenue += (item.price || 0) * (item.quantity || 0);
    });
  });
  const categoryData = Object.entries(categorySales).sort((a,b) => b[1].revenue - a[1].revenue);

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
<div class="d"></div>

<h3>Payment Breakdown</h3>
<div class="r"><span>Cash</span><span>${config.currency}${paymentSales.Cash}</span></div>
<div class="r"><span>Card</span><span>${config.currency}${paymentSales.Card}</span></div>
<div class="r"><span>UPI</span><span>${config.currency}${paymentSales.UPI}</span></div>
<div class="d"></div>

<h3>Sales Summary</h3>
${splitReport.isBarEnabled ? `<div class="r"><span>${splitReport.barLabel}: ${splitReport.barQty} items</span><span>${config.currency}${splitReport.barTotal}</span></div>` : ''}
${splitReport.isKitchenEnabled ? `<div class="r"><span>${splitReport.kitchenLabel}: ${splitReport.kitchenQty} items</span><span>${config.currency}${splitReport.kitchenTotal}</span></div>` : ''}
<div class="d"></div>

${splitReport.isBarEnabled ? `
<div class="section-title">${splitReport.barLabel.toUpperCase()} ITEMS</div>
<table>
<tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Revenue</th></tr>
${splitReport.bar.map(i => `<tr><td>${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${config.currency}${i.revenue}</td></tr>`).join('')}
<tr class="total-row"><td>${splitReport.barLabel.toUpperCase()} TOTAL</td><td style="text-align:center">${splitReport.barQty}</td><td style="text-align:right">${config.currency}${splitReport.barTotal}</td></tr>
</table>` : ''}

${splitReport.isKitchenEnabled ? `
<div class="section-title">${splitReport.kitchenLabel.toUpperCase()} ITEMS</div>
<table>
<tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Revenue</th></tr>
${splitReport.kitchen.map(i => `<tr><td>${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${config.currency}${i.revenue}</td></tr>`).join('')}
<tr class="total-row"><td>${splitReport.kitchenLabel.toUpperCase()} TOTAL</td><td style="text-align:center">${splitReport.kitchenQty}</td><td style="text-align:right">${config.currency}${splitReport.kitchenTotal}</td></tr>
</table>` : ''}

${reportType === 'monthly' && mostSoldLiquor.length > 0 && splitReport.isBarEnabled ? `
<div class="section-title">🏆 MOST SOLD ${splitReport.barLabel.toUpperCase()} (${reportLabel})</div>
<table>
<tr><th>#</th><th>Item</th><th style="text-align:center">Qty Sold</th><th style="text-align:right">Revenue</th></tr>
${mostSoldLiquor.slice(0, 20).map((i, idx) => `<tr><td>${idx + 1}</td><td>${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${config.currency}${i.revenue}</td></tr>`).join('')}
</table>` : ''}

<h3>Category Sales</h3>
<table>
<tr><th>Category</th><th style="text-align:center">Qty</th><th style="text-align:right">Revenue</th></tr>
${categoryData.map(([name, data]) => `<tr><td>${name}</td><td style="text-align:center">${data.qty}</td><td style="text-align:right">${config.currency}${data.revenue}</td></tr>`).join('')}
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
            <div className="stat-label">Total Bills</div>
            <div className="stat-value">{totalBills}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><Calendar size={20} /></div>
          <div>
            <div className="stat-label">Avg Order Value</div>
            <div className="stat-value">{config.currency}{totalBills ? Math.round(totalRevenue / totalBills) : 0}</div>
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
            <div className="card-header"><span className="card-title">{splitReport.barLabel.toUpperCase()} vs {splitReport.kitchenLabel.toUpperCase()}</span></div>
            <div className="card-body" style={{ padding: '0 12px' }}>
              <table className="data-table" style={{ marginBottom: '8px' }}>
                <tbody>
                  {splitReport.isBarEnabled && (
                    <tr>
                      <td style={{ fontWeight: 600 }}><Wine size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />{splitReport.barLabel.toUpperCase()}</td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{splitReport.barQty} items</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brand-primary-light)' }}>{config.currency}{splitReport.barTotal}</td>
                    </tr>
                  )}
                  {splitReport.isKitchenEnabled && (
                    <tr>
                      <td style={{ fontWeight: 600 }}><Coffee size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />{splitReport.kitchenLabel.toUpperCase()}</td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{splitReport.kitchenQty} items</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brand-warning)' }}>{config.currency}{splitReport.kitchenTotal}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category Sales */}
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header"><span className="card-title">SALES BY CATEGORY</span></div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead><tr><th>CATEGORY</th><th style={{ textAlign: 'center' }}>QTY</th><th style={{ textAlign: 'right' }}>REVENUE</th></tr></thead>
                <tbody>
                  {categoryData.length > 0 ? categoryData.map(([name, data]) => (
                    <tr key={name}>
                      <td style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: data.color, display: 'inline-block' }}></span>
                        {name}
                        <span className={`badge ${data.type === 'kitchen' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: '8px' }}>{data.type === 'kitchen' ? 'K' : 'B'}</span>
                      </td>
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
          {/* Bar Items Detail */}
          {splitReport.isBarEnabled && (
            <div className="card">
              <div className="card-header">
                <span className="card-title"><Wine size={12} style={{ display: 'inline', marginRight: '6px' }} />{splitReport.barLabel.toUpperCase()} ITEMS SOLD</span>
                <span className="badge badge-info">{splitReport.barQty} qty · {config.currency}{splitReport.barTotal}</span>
              </div>
              <div className="card-body" style={{ padding: 0, maxHeight: '250px', overflow: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>ITEM</th><th style={{ textAlign: 'center' }}>SOLD</th><th style={{ textAlign: 'right' }}>REVENUE</th></tr></thead>
                  <tbody>
                    {splitReport.bar.length > 0 ? splitReport.bar.map((item, idx) => (
                      <tr key={item.name}>
                        <td>
                          <span style={{ display: 'inline-block', width: '16px', color: 'var(--text-tertiary)', fontSize: '10px' }}>{idx+1}.</span>
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{item.qty}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{config.currency}{item.revenue}</td>
                      </tr>
                    )) : <tr><td colSpan="3" style={{ textAlign: 'center', padding: '16px' }}>No {splitReport.barLabel} items sold</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Kitchen Items Detail */}
          {splitReport.isKitchenEnabled && (
            <div className="card">
              <div className="card-header">
                <span className="card-title"><Coffee size={12} style={{ display: 'inline', marginRight: '6px' }} />{splitReport.kitchenLabel.toUpperCase()} ITEMS SOLD</span>
                <span className="badge badge-warning">{splitReport.kitchenQty} qty · {config.currency}{splitReport.kitchenTotal}</span>
              </div>
              <div className="card-body" style={{ padding: 0, maxHeight: '200px', overflow: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>ITEM</th><th style={{ textAlign: 'center' }}>SOLD</th><th style={{ textAlign: 'right' }}>REVENUE</th></tr></thead>
                  <tbody>
                    {splitReport.kitchen.length > 0 ? splitReport.kitchen.map((item, idx) => (
                      <tr key={item.name}>
                        <td>
                          <span style={{ display: 'inline-block', width: '16px', color: 'var(--text-tertiary)', fontSize: '10px' }}>{idx+1}.</span>
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{item.qty}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{config.currency}{item.revenue}</td>
                      </tr>
                    )) : <tr><td colSpan="3" style={{ textAlign: 'center', padding: '16px' }}>No {splitReport.kitchenLabel} items sold</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Most Sold Liquor (Monthly Only) */}
          {reportType === 'monthly' && splitReport.isBarEnabled && (
            <div className="card">
              <div className="card-header">
                <span className="card-title"><Award size={12} style={{ display: 'inline', marginRight: '6px' }} />MOST SOLD {splitReport.barLabel.toUpperCase()}</span>
              </div>
              <div className="card-body" style={{ padding: 0, maxHeight: '250px', overflow: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>#</th><th>ITEM</th><th style={{ textAlign: 'center' }}>SOLD</th><th style={{ textAlign: 'right' }}>REVENUE</th></tr></thead>
                  <tbody>
                    {mostSoldLiquor.length > 0 ? mostSoldLiquor.slice(0, 15).map((item, idx) => (
                      <tr key={item.name}>
                        <td style={{ fontWeight: 700, color: idx < 3 ? 'var(--brand-warning)' : 'var(--text-tertiary)', fontSize: '11px' }}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                        </td>
                        <td style={{ fontWeight: 600 }}>{item.name}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{item.qty}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{config.currency}{item.revenue}</td>
                      </tr>
                    )) : <tr><td colSpan="4" style={{ textAlign: 'center', padding: '16px' }}>No {splitReport.barLabel} sold this month</td></tr>}
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
