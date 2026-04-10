const fs = require('fs');
const file = 'src/pages/InventoryPage.jsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `              <div className="input-group">
                <label className="input-label">Type</label>
                <select className="select" value={catForm.type} onChange={e => setCatForm(f => ({ ...f, type: e.target.value }))}>
                  {config.isKitchenEnabled !== false && <option value="kitchen">{config.kitchenLabel || 'Kitchen'}</option>}
                  {config.isBarEnabled !== false && <option value="bar">{config.barLabel || 'Bar'}</option>}
                </select>
              </div>`;

const rep1 = `              <div className="input-group">
                <label className="input-label">Type (Department)</label>
                <select className="select" value={catForm.type} onChange={e => setCatForm(f => ({ ...f, type: e.target.value }))}>
                  {(config.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}]).map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>`;

const target2 = `  const barCategories = categories.filter(c => c.type !== 'kitchen');
  const kitchenCategories = categories.filter(c => c.type === 'kitchen');`;
const rep2 = `  // Fallback map in case category type doesn't exist
  const getDeptName = (deptId) => {
    const d = (config.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}]).find(x => x.id === deptId);
    return d ? d.name : 'Other';
  };`;

content = content.replace(target1, rep1).replace(target2, rep2);

// Re-write the category list grouping replacing the old hardcoded blocks
// This is tricky, let's just make it render categories straight up or grouped dynamically

fs.writeFileSync(file, content, 'utf8');
