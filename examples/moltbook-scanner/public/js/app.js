// Dashboard functionality

const API_BASE = '/api';

// Load stats
async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    const stats = await res.json();
    
    document.getElementById('totalThreats').textContent = stats.totalThreats || 0;
    document.getElementById('activeThreats').textContent = stats.activeThreats || 0;
    document.getElementById('totalScans').textContent = stats.totalScans || 0;
    
    if (stats.lastScan) {
      const lastScanDate = new Date(stats.lastScan.scan_time);
      document.getElementById('lastScan').textContent = formatRelativeTime(lastScanDate);
    } else {
      document.getElementById('lastScan').textContent = 'Never';
    }
    
    // Load category chart
    if (stats.categoryCounts && stats.categoryCounts.length > 0) {
      displayCategoryChart(stats.categoryCounts);
    } else {
      document.getElementById('categoryChart').innerHTML = '<p class="loading">No threat data yet</p>';
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Load recent threats
async function loadRecentThreats() {
  try {
    const res = await fetch(`${API_BASE}/threats?limit=10`);
    const data = await res.json();
    
    const container = document.getElementById('recentThreats');
    
    if (data.threats && data.threats.length > 0) {
      container.innerHTML = data.threats.map(threat => `
        <div class="threat-item">
          <div class="threat-header">
            <span class="threat-intent">${threat.intent || 'Unknown'}</span>
            <span class="threat-risk risk-${getRiskLevel(threat.risk_score)}">${(threat.risk_score * 100).toFixed(0)}%</span>
          </div>
          <div class="threat-message">${escapeHtml(threat.message.substring(0, 150))}...</div>
          <div style="margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.85rem;">
            <span>Category: ${threat.category || 'unknown'}</span> • 
            <span>Found: ${formatRelativeTime(new Date(threat.first_seen))}</span>
            ${threat.author ? ` • Author: ${threat.author}` : ''}
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<p class="loading">No threats detected yet. Run a scan to get started.</p>';
    }
  } catch (err) {
    console.error('Failed to load threats:', err);
    document.getElementById('recentThreats').innerHTML = '<p class="loading">Error loading threats</p>';
  }
}

// Display category chart
function displayCategoryChart(categories) {
  const maxCount = Math.max(...categories.map(c => c.count));
  const container = document.getElementById('categoryChart');
  
  container.innerHTML = categories.map(cat => `
    <div class="category-bar">
      <div class="category-name">${cat.category}</div>
      <div class="category-progress">
        <div class="category-fill" style="width: ${(cat.count / maxCount * 100)}%"></div>
      </div>
      <div class="category-count">${cat.count}</div>
    </div>
  `).join('');
}

// Trigger manual scan
document.getElementById('triggerScan').addEventListener('click', async () => {
  const btn = document.getElementById('triggerScan');
  btn.disabled = true;
  btn.textContent = '⏳ Scanning...';
  
  try {
    const res = await fetch(`${API_BASE}/scan/trigger`, { method: 'POST' });
    const data = await res.json();
    
    if (data.ok) {
      alert('Scan started! Check back in a few minutes.');
      setTimeout(() => {
        loadStats();
        loadRecentThreats();
      }, 5000);
    }
  } catch (err) {
    alert('Failed to trigger scan: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔍 Scan Now';
  }
});

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

function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Initialize
loadStats();
loadRecentThreats();

// Auto-refresh every 30 seconds
setInterval(() => {
  loadStats();
  loadRecentThreats();
}, 30000);
