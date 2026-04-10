const fs = require('fs');
const file = 'src/pages/SettingsPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// We need to replace the DEPARTMENTS section
const newSection = `
      <div className="config-section">
        <h3 className="config-section-title">?? DEPARTMENTS</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '12px' }}>
          Add or remove service areas like Kitchen, Bar, Shisha Lounge, etc.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {(form.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}]).map((dept, idx) => (
             <div key={dept.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
               <input className="input" value={dept.name} onChange={e => {
                  const newDepts = [...(form.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}])];
                  newDepts[idx].name = e.target.value;
                  setForm(f => ({ ...f, departments: newDepts }));
               }} />
               <button className="btn btn-ghost" style={{ color: 'var(--brand-danger)' }} onClick={() => {
                  const newDepts = [...(form.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}])];
                  newDepts.splice(idx, 1);
                  setForm(f => ({ ...f, departments: newDepts }));
               }}>X</button>
             </div>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => {
           const newDepts = [...(form.departments || [{id:'kitchen', name:'Kitchen'}, {id:'bar', name:'Bar'}])];
           newDepts.push({ id: 'dept_' + Date.now(), name: 'New Dept' });
           setForm(f => ({ ...f, departments: newDepts }));
        }}>+ ADD DEPARTMENT</button>
      </div>`;

const startIdx = content.indexOf('<h3 className="config-section-title">?? DEPARTMENTS</h3>');
const outerDivStart = content.lastIndexOf('<div className="config-section">', startIdx);
const endIdx = content.indexOf('<div className="config-section"', outerDivStart + 10);
const replaceRangeEnd = content.indexOf('<div className="config-section"', outerDivStart + 10) || (content.lastIndexOf('</div>') - 10); // Find next section

// Let's use regex for safety
const updated = content.replace(/<div className="config-section">\s*<h3 className="config-section-title">?? DEPARTMENTS<\/h3>[\s\S]*?<\/div>\s*<div className="config-section"/, newSection + '\n\n      <div className="config-section"');

if (updated !== content) {
    fs.writeFileSync(file, updated, 'utf8');
    console.log('Updated SettingsPage.jsx');
} else {
    console.log('Failed to match regex');
}

