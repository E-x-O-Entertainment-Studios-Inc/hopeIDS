# 🛡️ Moltbook Threat Scanner

A containerized threat detection system that scans [Moltbook](https://www.moltbook.com) posts and comments for security threats using **hopeIDS**. Features automatic pattern updates and a web-based control panel.

## Features

- 🔍 **Automated Scanning** - Periodically scans Moltbook for threats
- 🐳 **Docker-ready** - Runs in an isolated container
- 🔄 **Auto-updating Patterns** - Checks for hopeIDS pattern updates on startup
- 📊 **Web Dashboard** - Real-time threat monitoring and analysis
- 💾 **Persistent Storage** - SQLite database for threat history
- 🔌 **API-first** - RESTful API for integration

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Moltbook API key ([get one here](https://www.moltbook.com/api/keys))

### Setup

1. **Clone and navigate:**
   ```bash
   cd hopeIDS/examples/moltbook-scanner
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env and add your MOLTBOOK_API_KEY
   ```

3. **Build and run:**
   ```bash
   docker-compose up -d
   ```

4. **Access the dashboard:**
   ```
   http://localhost:3457
   ```

## Configuration

Edit `.env` to customize:

```bash
# Required
MOLTBOOK_API_KEY=moltbook_sk_your_key_here

# Server
PORT=3457

# Scanning
SCAN_INTERVAL_MINUTES=30  # How often to scan Moltbook

# Pattern Updates
PATTERN_UPDATE_INTERVAL=3600  # Check for updates every hour

# hopeIDS
HOPEID_SEMANTIC_ENABLED=false  # Enable LLM-based analysis
# HOPEID_LLM_ENDPOINT=http://localhost:11434/v1/chat/completions
# HOPEID_LLM_MODEL=qwen2.5:7b
```

## Usage

### Run a Manual Scan

**Via Dashboard:**
- Click "🔍 Scan Now" in the web UI

**Via CLI:**
```bash
docker-compose exec moltbook-scanner npm run scan
```

**Via API:**
```bash
curl -X POST http://localhost:3457/api/scan/trigger
```

### View Threats

- **Dashboard:** `http://localhost:3457`
- **Threats List:** `http://localhost:3457/threats.html`
- **Scan History:** `http://localhost:3457/scans.html`

### Export Threats as hopeIDS Patterns

1. Go to the Threats page
2. Select threats to export
3. Click "📥 Export Selected"
4. Download the JSON pattern file
5. Add to hopeIDS: copy to `hopeIDS/src/patterns/`

## API Endpoints

### Stats & Monitoring
```bash
GET  /api/health          # Health check
GET  /api/stats           # Dashboard statistics
GET  /api/scans           # Scan history
```

### Threat Management
```bash
GET    /api/threats       # List all threats
GET    /api/threats/:id   # Get single threat
POST   /api/threats       # Add manual threat
PUT    /api/threats/:id   # Update threat status
DELETE /api/threats/:id   # Delete threat
```

### Scanning
```bash
POST /api/scan/trigger    # Trigger manual scan
```

### Export
```bash
POST /api/export/hopeids  # Export threats as hopeIDS patterns
```

## Architecture

```
┌─────────────────────────────────────────────┐
│         MOLTBOOK SCANNER (Docker)           │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────┐      ┌──────────────┐    │
│  │  Scanner     │─────▶│   hopeIDS    │    │
│  │  (Node.js)   │      │   Engine     │    │
│  └──────────────┘      └──────────────┘    │
│         │                      │            │
│         ▼                      ▼            │
│  ┌──────────────────────────────────┐      │
│  │      SQLite Database            │       │
│  │   (threats.db + scan history)   │       │
│  └──────────────────────────────────┘      │
│         │                                   │
│         ▼                                   │
│  ┌──────────────────────────────────┐      │
│  │   Express API + Web Dashboard    │      │
│  └──────────────────────────────────┘      │
│                                             │
└─────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
   Moltbook API            Web Browser (localhost:3457)
```

## Pattern Auto-Update

The scanner automatically checks for hopeIDS pattern updates on container startup. The update script:

1. Checks the current installed hopeIDS version
2. Queries npm for the latest version
3. Upgrades if a new version is available
4. Logs the update status

Manual update:
```bash
docker-compose exec moltbook-scanner /usr/local/bin/update-patterns
```

## Database Schema

**threats table:**
- Stores detected security threats
- Fields: id, source, message, category, risk_score, intent, flags, author, post_id, status, timestamps

**scan_history table:**
- Tracks scan operations
- Fields: id, scan_time, threats_found, new_threats, source, notes

**scans table:**
- Detailed scan results
- Fields: id, message, source, author, post_id, action, risk_score, intent, flags, scanned_at

## Development

### Local Development (without Docker)

```bash
npm install
cp .env.example .env
# Edit .env with your API key
npm start
```

### Run Scanner Only
```bash
npm run scan
```

### Update Patterns
```bash
npm run update-patterns
```

## Docker Commands

```bash
# Build
docker-compose build

# Start
docker-compose up -d

# Stop
docker-compose down

# Logs
docker-compose logs -f

# Restart
docker-compose restart

# Execute command in container
docker-compose exec moltbook-scanner npm run scan
```

## Troubleshooting

### No threats detected?

- Check that `MOLTBOOK_API_KEY` is set correctly
- Verify the scanner is running: `docker-compose logs -f`
- Trigger a manual scan: `POST /api/scan/trigger`
- Check Moltbook API status

### Pattern updates not working?

- Check network connectivity
- View update logs: `docker-compose logs moltbook-scanner | grep pattern`
- Manually update: `docker-compose exec moltbook-scanner npm install -g hopeid@latest`

### Database errors?

- Check that `/app/data` volume is mounted
- Restart container: `docker-compose restart`
- Check permissions: `docker-compose exec moltbook-scanner ls -la data/`

## Security

- **Sandboxed**: Runs in isolated Docker container
- **API Keys**: Never logged or exposed in UI
- **Untrusted Input**: All Moltbook content is scanned before storage
- **Network**: Only needs outbound access to Moltbook API and npm registry

## License

AGPL-3.0 - Same as hopeIDS

---

**Part of [hopeIDS](https://github.com/exo-explore/hopeIDS)** - Inference-Based Intrusion Detection for AI Agents
