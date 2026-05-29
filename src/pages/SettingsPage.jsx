import { useState, useEffect } from 'react';
import { useApp, useToast } from '../context/AppContext';
import { updateConfig } from '../store/data';
import { Settings, Store, Receipt, FileText } from 'lucide-react';

const DEFAULT_BILL_LAYOUT = {
  restaurantName: '',
  address: '',
  phone: '',
  gstin: '',
  sacCode: '',
  serviceType: 'RESTAURANT SERVICES',
  cashierName: '',
  footerLine1: 'Thank you for your visit',
  footerLine2: 'Have a nice day',
  footerLine3: '',
  showCashier: true,
  showWaiter: true,
  showSACCode: true,
};

export default function SettingsPage() {
  const { config = {}, refresh, sections = [] } = useApp();
  const { addToast } = useToast();
  const [form, setForm] = useState({ ...config });
  const [billLayout, setBillLayout] = useState({ ...DEFAULT_BILL_LAYOUT, ...(config.billLayout || {}) });
  const [isPrintStation, setIsPrintStation] = useState(localStorage.getItem('isPrintStation') === 'true');

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(f => ({ ...f, billLayout }));
  }, [billLayout]);

  const handleSave = async () => {
    if (busy) return;
    setBusy(true);
    try { 
      await updateConfig({ ...form, billLayout }); 
      localStorage.setItem('isPrintStation', isPrintStation);
      refresh(); 
      addToast('Settings saved', 'success'); 
    }
    catch { addToast('Failed', 'error'); }
    finally { setBusy(false); }
  };





  // Preview data for bill layout
  const previewName = billLayout.restaurantName || form.restaurantName || 'YOUR RESTAURANT';
  const previewAddr = billLayout.address || form.address || '';
  const previewPhone = billLayout.phone || form.phone || '';
  const previewGstin = billLayout.gstin || form.gstNumber || '';
  const previewTaxRate = Number(form.taxRate) || 0;
  const halfTax = previewTaxRate / 2;

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title"><Settings size={16} /> SETTINGS</div>
        <button className="btn btn-success" onClick={handleSave}>SAVE</button>
      </div>

      <div className="config-section">
        <h3 className="config-section-title"><Store size={14} /> RESTAURANT</h3>
        <div className="config-grid">
          <div className="input-group"><label className="input-label">Name</label>
            <input className="input" value={form.restaurantName || ''} onChange={e => setForm(f => ({ ...f, restaurantName: e.target.value }))} /></div>
          <div className="input-group"><label className="input-label">Phone</label>
            <input className="input" value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div className="input-group" style={{ gridColumn: '1/-1' }}><label className="input-label">Address</label>
            <input className="input" value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
        </div>
      </div>

      <div className="config-section">
        <h3 className="config-section-title"><Receipt size={14} /> BILLING</h3>
        <div className="config-grid">
          <div className="input-group"><label className="input-label">GST Number</label>
            <input className="input" value={form.gstNumber || ''} onChange={e => setForm(f => ({ ...f, gstNumber: e.target.value }))} /></div>
          <div className="input-group"><label className="input-label">Currency</label>
            <input className="input" value={form.currency || ''} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} /></div>
          <div className="input-group"><label className="input-label">Tax Rate (%) — Split into SGST + CGST</label>
            <input type="number" className="input" value={form.taxRate || 0} onChange={e => setForm(f => ({ ...f, taxRate: Number(e.target.value) }))} min="0" max="100" />
            <p style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px' }}>e.g. 5% → SGST 2.5% + CGST 2.5%</p>
          </div>
          <div className="input-group"><label className="input-label">Service Charge (%)</label>
            <input type="number" className="input" value={form.serviceChargeRate || 0} onChange={e => setForm(f => ({ ...f, serviceChargeRate: Number(e.target.value) }))} min="0" max="100" /></div>
        </div>
      </div>

      {/* BILL LAYOUT EDITOR + LIVE PREVIEW */}
      <div className="config-section" style={{ borderColor: 'rgba(94, 92, 230, 0.3)' }}>
        <h3 className="config-section-title"><FileText size={14} /> BILL LAYOUT / RECEIPT DESIGN</h3>

        <div className="bill-layout-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
          {/* Editor */}
          <div>
            <div className="config-grid">
              <div className="input-group">
                <label className="input-label">Restaurant Name (on bill)</label>
                <input className="input" value={billLayout.restaurantName} placeholder={form.restaurantName || 'AMRIK SUKHDEV DHABA'}
                  onChange={e => setBillLayout(f => ({ ...f, restaurantName: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Address (on bill)</label>
                <input className="input" value={billLayout.address} placeholder="G.T. ROAD, MURTHAL"
                  onChange={e => setBillLayout(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Phone (on bill)</label>
                <input className="input" value={billLayout.phone} placeholder="7082135999"
                  onChange={e => setBillLayout(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">GSTIN (on bill)</label>
                <input className="input" value={billLayout.gstin} placeholder="06ABIFS3901K1Z3"
                  onChange={e => setBillLayout(f => ({ ...f, gstin: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">SAC Code</label>
                <input className="input" value={billLayout.sacCode} placeholder="996331"
                  onChange={e => setBillLayout(f => ({ ...f, sacCode: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Service Type Label</label>
                <input className="input" value={billLayout.serviceType} placeholder="RESTAURANT SERVICES"
                  onChange={e => setBillLayout(f => ({ ...f, serviceType: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '8px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>FOOTER / THANK-YOU</div>
              <div className="config-grid">
                <div className="input-group">
                  <label className="input-label">Footer Line 1</label>
                  <input className="input" value={billLayout.footerLine1} onChange={e => setBillLayout(f => ({ ...f, footerLine1: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Footer Line 2</label>
                  <input className="input" value={billLayout.footerLine2} onChange={e => setBillLayout(f => ({ ...f, footerLine2: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Footer Line 3</label>
                  <input className="input" value={billLayout.footerLine3} placeholder="जल ही जीवन है।"
                    onChange={e => setBillLayout(f => ({ ...f, footerLine3: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Default Cashier</label>
                  <input className="input" value={billLayout.cashierName} placeholder="CN"
                    onChange={e => setBillLayout(f => ({ ...f, cashierName: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '8px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>SHOW/HIDE</div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {[
                  { key: 'showCashier', label: 'Cashier' },
                  { key: 'showWaiter', label: 'Waiter' },
                  { key: 'showSACCode', label: 'SAC Code' },
                ].map(opt => (
                  <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={billLayout[opt.key] !== false}
                      onChange={e => setBillLayout(f => ({ ...f, [opt.key]: e.target.checked }))}
                      style={{ width: '16px', height: '16px' }} />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>


          </div>

          {/* LIVE PREVIEW */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>LIVE PREVIEW</div>
            <div style={{
              background: '#fff', color: '#000', padding: '14px', borderRadius: '8px',
              fontFamily: "'Courier New', monospace", fontSize: '10px', lineHeight: '1.5',
              border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)',
              maxHeight: '500px', overflowY: 'auto',
            }}>
              <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '12px', marginBottom: '2px' }}>
                {previewName}
              </div>
              {previewAddr && <div style={{ textAlign: 'center', fontSize: '9px' }}>{previewAddr}</div>}
              {previewPhone && <div style={{ textAlign: 'center', fontSize: '9px' }}>PHONE NO :{previewPhone}</div>}
              {previewGstin && <div style={{ textAlign: 'center', fontSize: '9px' }}>GSTIN :{previewGstin}</div>}
              {billLayout.sacCode && billLayout.showSACCode !== false && (
                <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '11px', marginTop: '2px' }}>SAC {billLayout.sacCode}</div>
              )}
              {billLayout.serviceType && (
                <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '10px' }}>[{billLayout.serviceType}]</div>
              )}
              <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '11px' }}>[INVOICE]</div>

              <hr style={{ border: 'none', borderTop: '1px dotted #000', margin: '4px 0' }} />

              <div>Bill No.: BILL-SAMPLE</div>
              <div>Date :{new Date().toLocaleString('en-IN')}</div>

              <hr style={{ border: 'none', borderTop: '1px dotted #000', margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Table No.: A1</span>
                {billLayout.showWaiter !== false && <span>Waiter Code:</span>}
              </div>

              <hr style={{ border: 'none', borderTop: '1px dotted #000', margin: '4px 0' }} />

              <div style={{ display: 'flex', fontWeight: 700, fontSize: '9px', borderBottom: '1px dotted #000', paddingBottom: '2px' }}>
                <span style={{ flex: 2 }}>Item Name</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Qty.</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Price</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Value</span>
              </div>

              <div style={{ display: 'flex', fontWeight: 700, padding: '2px 0' }}>
                <span style={{ flex: 2 }}>SAMPLE ITEM</span>
                <span style={{ flex: 1, textAlign: 'right' }}>1.00</span>
                <span style={{ flex: 1, textAlign: 'right' }}>500.0</span>
                <span style={{ flex: 1, textAlign: 'right' }}>500.00</span>
              </div>

              <hr style={{ border: 'none', borderTop: '1px dotted #000', margin: '4px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>SUB TOTAL</span><span>500.00</span>
              </div>

              {previewTaxRate > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                    <span>Add S GST({halfTax.toFixed(3)}%) on 500.00</span>
                    <span>{(500 * halfTax / 100).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                    <span>Add C GST({halfTax.toFixed(3)}%) on 500.00</span>
                    <span>{(500 * halfTax / 100).toFixed(2)}</span>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '11px', marginTop: '4px' }}>
                <span>Amount Incl of All Taxes</span><span>{(500 + 500 * previewTaxRate / 100).toFixed(2)}</span>
              </div>

              <hr style={{ border: 'none', borderTop: '2px dashed #000', margin: '4px 0' }} />

              {billLayout.showCashier !== false && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                  <span>Cashier : {billLayout.cashierName || 'CN'}</span><span>E & C E</span>
                </div>
              )}

              <div style={{ textAlign: 'center', marginTop: '6px', fontWeight: 700 }}>
                {billLayout.footerLine1 || 'Thank you for your visit'}
              </div>
              {billLayout.footerLine2 && <div style={{ textAlign: 'center', fontWeight: 700 }}>{billLayout.footerLine2}</div>}
              {billLayout.footerLine3 && <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '2px' }}>{billLayout.footerLine3}</div>}
              <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '12px', color: '#000', fontWeight: 'bold', fontStyle: 'italic' }}>Powered by RestoGrow</div>
            </div>
          </div>
        </div>
      </div>

      <div className="config-section">
        <h3 className="config-section-title">🏢 DEPARTMENTS</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '12px' }}>
          Add or remove service areas like Kitchen, Bar, Shisha Lounge, etc.
        </p>
        <div className="config-grid" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(form.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}]).map((dept, idx) => (
            <div key={dept.id} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border:'1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom:'8px' }}>
                <input className="input" value={dept.name} onChange={e => {
                  const newDepts = [...(form.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}])];
                  newDepts[idx] = { ...newDepts[idx], name: e.target.value };
                  setForm(f => ({ ...f, departments: newDepts }));
                }} style={{flex:1}} />
                <button className="btn btn-ghost" style={{ color: 'var(--brand-danger)' }} onClick={() => {
                  const newDepts = [...(form.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}])];
                  newDepts.splice(idx, 1);
                  setForm(f => ({ ...f, departments: newDepts }));
                }}>X</button>
              </div>
              <div style={{fontSize:'10px', color:'var(--text-secondary)', marginBottom:'4px'}}>Show in specific sections (Optional):</div>
              <div style={{display:'flex', flexWrap:'wrap', gap:'8px'}}>
                {sections.map(s => (
                  <label key={s.id} style={{fontSize:'11px', display:'flex', alignItems:'center', gap:'4px', cursor:'pointer'}}>
                    <input type="checkbox" checked={dept.section_ids?.includes(s.id)} onChange={e => {
                      const newDepts = [...(form.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}])];
                      const currentIds = newDepts[idx].section_ids || [];
                      const newIds = e.target.checked ? [...currentIds, s.id] : currentIds.filter(id => id !== s.id);
                      newDepts[idx] = { ...newDepts[idx], section_ids: newIds };
                      setForm(f => ({ ...f, departments: newDepts }));
                    }} />
                    {s.name}
                  </label>
                ))}
                {sections.length === 0 && <span style={{fontSize:'9px'}}>Create sections first</span>}
              </div>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const newDepts = [...(form.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}])];
            newDepts.push({ id: 'dept_' + Date.now(), name: 'New Dept', section_ids: [] });
            setForm(f => ({ ...f, departments: newDepts }));
          }}>+ ADD DEPARTMENT</button>
        </div>
      </div>

      <div className="config-section">
        <h3 className="config-section-title">🖨️ REMOTE PRINTING</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '12px' }}>
          Enable this on the primary PC connected to the printer. Other PCs will send print jobs to this station.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isPrintStation ? 'rgba(78, 205, 196, 0.1)' : '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid', borderColor: isPrintStation ? '#4ecdc4' : 'transparent' }}>
          <input type="checkbox" checked={isPrintStation} onChange={e => {
            setIsPrintStation(e.target.checked);
            localStorage.setItem('isPrintStation', e.target.checked);
            addToast(e.target.checked ? '✅ Print station ENABLED — reload page to activate listener' : '⏸️ Print station DISABLED', 'info');
          }} style={{ width: '20px', height: '20px' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px' }}>Mark this device as PRINT STATION</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Status: {isPrintStation ? '✅ LISTENING FOR JOBS' : '⏸️ INACTIVE — prints will be queued for the main PC'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={async () => {
            try {
              const { createPrintJob } = await import('../store/data');
              await createPrintJob('KOT', {
                order: { items: [{ name: 'TEST ITEM', quantity: 1, categoryType: 'kitchen', deptId: 'kitchen' }] },
                tableLabel: 'TEST'
              });
              addToast('✅ Test KOT sent to print queue! Check the main PC.', 'success');
            } catch (e) { addToast('❌ Test failed: ' + e.message, 'error'); }
          }}>📤 Send Test Print</button>
          <button className="btn btn-warning btn-sm" onClick={async () => {
            const results = [];
            try {
              const { supabase } = await import('../utils/supabase');
              const rid = localStorage.getItem('rg_tenant_id');
              results.push('Restaurant ID: ' + (rid || 'NOT SET ❌'));
              results.push('isPrintStation: ' + localStorage.getItem('isPrintStation'));

              // Step 1: Can we SELECT from print_jobs?
              const { data: selData, error: selErr } = await supabase.from('print_jobs').select('id, status, type').limit(5);
              if (selErr) {
                results.push('❌ SELECT FAILED: ' + selErr.message);
                results.push('');
                results.push('⚠️ The print_jobs TABLE does not exist!');
                results.push('Go to Supabase SQL Editor and run:');
                results.push('');
                results.push('CREATE TABLE print_jobs (');
                results.push('  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,');
                results.push('  restaurant_id UUID,');
                results.push('  type TEXT NOT NULL,');
                results.push('  content JSONB,');
                results.push('  status TEXT DEFAULT \'pending\',');
                results.push('  created_at TIMESTAMPTZ DEFAULT now()');
                results.push(');');
                results.push('ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;');
                results.push('CREATE POLICY "Allow all" ON print_jobs FOR ALL USING (true) WITH CHECK (true);');
                results.push('ALTER PUBLICATION supabase_realtime ADD TABLE print_jobs;');
                alert(results.join('\n'));
                return;
              }
              results.push('✅ Table exists (' + (selData?.length || 0) + ' rows found)');

              // Step 2: Check pending jobs
              const { data: pending } = await supabase.from('print_jobs').select('id, type, created_at').eq('status', 'pending').eq('restaurant_id', rid);
              results.push('📋 Pending jobs: ' + (pending?.length || 0));
              if (pending?.length > 0) {
                pending.forEach(j => results.push('   → ' + j.type + ' | ' + j.created_at));
              }

              // Step 3: Try INSERT
              const testId = crypto.randomUUID ? crypto.randomUUID() : 'test-' + Date.now();
              const { error: insErr } = await supabase.from('print_jobs').insert([{
                id: testId, restaurant_id: rid, type: 'DIAG', content: { test: true }, status: 'pending', created_at: new Date().toISOString()
              }]);
              if (insErr) {
                results.push('❌ INSERT FAILED: ' + insErr.message);
                results.push('→ Check RLS policies on print_jobs table');
              } else {
                results.push('✅ INSERT works');
                // Clean up
                await supabase.from('print_jobs').delete().eq('id', testId);
                results.push('✅ DELETE works (cleaned up test)');
              }

              results.push('');
              results.push('If all checks pass but printing still fails:');
              results.push('1. On MAIN PC: ensure "Print Station" is checked');
              results.push('2. On MAIN PC: RELOAD the page (Ctrl+Shift+R)');
              results.push('3. On MAIN PC: look for green "PRINTER ✓" badge bottom-right');
              results.push('4. On MAIN PC: open console (F12) - look for 📠 logs');
            } catch (e) {
              results.push('❌ Error: ' + e.message);
            }
            alert(results.join('\n'));
          }}>🔧 Run Diagnostics</button>
          <button className="btn btn-ghost btn-sm" onClick={async () => {
            try {
              const { supabase } = await import('../utils/supabase');
              const rid = localStorage.getItem('rg_tenant_id');
              const { error } = await supabase.from('print_jobs').delete().eq('restaurant_id', rid).eq('status', 'pending');
              if (error) throw error;
              addToast('🧹 Cleared all pending print jobs', 'info');
            } catch (e) { addToast('Clear failed: ' + e.message, 'error'); }
          }}>🧹 Clear Queue</button>
        </div>
        <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
          💡 <b>How it works:</b> Non-print-station PCs send jobs to Supabase → Main PC (print station) picks them up instantly and prints.
          The main PC shows a green <b>🖨️ PRINTER ✓</b> badge in the bottom-right corner when active.
        </p>
      </div>


    </div>
  );


}
