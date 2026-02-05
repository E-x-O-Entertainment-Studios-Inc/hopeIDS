// Scan history page functionality

const API_BASE = '/api';

// Load scan history
async function loadScans() {
  try {
    const res = await fetch(`${API_BASE}/scans?limit=50`);
    const data = await res.json();
    
    const tbody = document.getElementById('scansBody');
    
    if (data.scans && data.scans.length > 0) {
      tbody.innerHTML = data.scans.map(scan => `
        <tr>
          <td>${formatDateTime(new Date(scan.scan_time))}</td>
          <td>${scan.source}</td>
          <td>${scan.threats_found}</td>
          <td>${scan.new_threats}</td>
          <td>${scan.notes || '-'}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="5" class="loading">No scans yet</td></tr>';
    }
  } catch (err) {
    console.error('Failed to load scans:', err);
    document.getElementById('scansBody').innerHTML = '<tr><td colspan="5">Error loading scan history</td></tr>';
  }
}

function formatDateTime(date) {
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Initialize
loadScans();

// Auto-refresh every 30 seconds
setInterval(loadScans, 30000);
