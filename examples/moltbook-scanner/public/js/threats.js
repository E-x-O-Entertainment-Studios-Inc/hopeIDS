// Threats page functionality

const API_BASE = '/api';
let allThreats = [];
let selectedThreats = new Set();

// Load all threats
async function loadThreats() {
  try {
    const res = await fetch(`${API_BASE}/threats?limit=500`);
    const data = await res.json();
    allThreats = data.threats || [];
    displayThreats(allThreats);
  } catch (err) {
    console.error('Failed to load threats:', err);
    document.getElementById('threatsBody').innerHTML = '<tr><td colspan="10">Error loading threats</td></tr>';
  }
}

// Display threats in table
function displayThreats(threats) {
  const tbody = document.getElementById('threatsBody');
  
  if (threats.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="loading">No threats found</td></tr>';
    return;
  }
  
  tbody.innerHTML = threats.map(threat => `
    <tr>
      <td><input type="checkbox" class="threat-checkbox" data-id="${threat.id}" /></td>
      <td>${threat.id}</td>
      <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(threat.message)}">
        ${escapeHtml(threat.message.substring(0, 100))}${threat.message.length > 100 ? '...' : ''}
      </td>
      <td>${threat.intent || 'Unknown'}</td>
      <td class="risk-${getRiskLevel(threat.risk_score)}">${(threat.risk_score * 100).toFixed(0)}%</td>
      <td>${threat.category || 'unknown'}</td>
      <td>${threat.author || '-'}</td>
      <td>${threat.status}</td>
      <td>${formatDate(new Date(threat.first_seen))}</td>
      <td>
        <button onclick="viewThreat(${threat.id})" class="btn-secondary" style="font-size: 0.8rem; padding: 0.3rem 0.6rem;">View</button>
      </td>
    </tr>
  `).join('');
  
  // Add checkbox listeners
  document.querySelectorAll('.threat-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const id = parseInt(e.target.dataset.id);
      if (e.target.checked) {
        selectedThreats.add(id);
      } else {
        selectedThreats.delete(id);
      }
    });
  });
}

// Search threats
document.getElementById('searchBox').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = allThreats.filter(threat => 
    threat.message.toLowerCase().includes(query) ||
    (threat.intent && threat.intent.toLowerCase().includes(query)) ||
    (threat.category && threat.category.toLowerCase().includes(query))
  );
  displayThreats(filtered);
});

// Select all
document.getElementById('selectAll').addEventListener('change', (e) => {
  const checkboxes = document.querySelectorAll('.threat-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = e.target.checked;
    const id = parseInt(cb.dataset.id);
    if (e.target.checked) {
      selectedThreats.add(id);
    } else {
      selectedThreats.delete(id);
    }
  });
});

// Export selected threats
document.getElementById('exportBtn').addEventListener('click', async () => {
  if (selectedThreats.size === 0) {
    alert('Please select threats to export');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/export/hopeids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threatIds: Array.from(selectedThreats) })
    });
    
    const data = await res.json();
    
    // Download as JSON file
    const blob = new Blob([JSON.stringify(data.patterns, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hopeids-patterns-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert(`Exported ${data.count} threats as hopeIDS patterns`);
  } catch (err) {
    alert('Export failed: ' + err.message);
  }
});

// View threat details
function viewThreat(id) {
  const threat = allThreats.find(t => t.id === id);
  if (!threat) return;
  
  alert(`Threat ID: ${threat.id}\n\nMessage:\n${threat.message}\n\nIntent: ${threat.intent}\nRisk: ${(threat.risk_score * 100).toFixed(0)}%\nCategory: ${threat.category}\nFlags: ${threat.flags || 'none'}`);
}

// Utility functions
function getRiskLevel(score) {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(date) {
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Initialize
loadThreats();
