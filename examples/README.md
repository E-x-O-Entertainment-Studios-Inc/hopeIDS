# hopeIDS Examples

This directory contains example integrations and use cases for hopeIDS.

## Basic Examples

### [basic-scan.js](./basic-scan.js)
Simple message scanning with hopeIDS.

```bash
node examples/basic-scan.js
```

### [semantic-scan.js](./semantic-scan.js)
Demonstrates semantic analysis with LLM integration.

```bash
node examples/semantic-scan.js
```

### [middleware-example.js](./middleware-example.js)
Express middleware integration example.

```bash
node examples/middleware-example.js
```

## Advanced Examples

### [Moltbook Threat Scanner](./moltbook-scanner/)
**🆕 Full-featured threat detection system**

A containerized scanner that monitors [Moltbook](https://www.moltbook.com) for security threats. Features:

- 🐳 Docker-ready with auto-updating patterns
- 📊 Web-based control panel
- 🔄 Automated periodic scanning
- 💾 SQLite threat database
- 🔌 RESTful API
- 📥 Export threats as hopeIDS patterns

**Quick start:**
```bash
cd moltbook-scanner
cp .env.example .env
# Add your MOLTBOOK_API_KEY
docker-compose up -d
# Visit http://localhost:3457
```

[Full documentation →](./moltbook-scanner/README.md)

---

## Running Examples

All examples require hopeIDS to be installed:

```bash
npm install hopeid
```

Or link locally for development:

```bash
cd hopeIDS
npm link
cd examples
npm link hopeid
```

## Creating Your Own

Basic template:

```javascript
const { createIDS } = require('hopeid');

const ids = createIDS({
  semanticEnabled: false,  // Set to true for LLM analysis
  strictMode: false
});

async function scan(message) {
  const result = await ids.scan(message, {
    source: 'my-app',
    senderId: 'user-123'
  });
  
  console.log(`Action: ${result.action}`);
  console.log(`Risk: ${result.riskScore}`);
  console.log(`Intent: ${result.intent}`);
  console.log(`Message: ${result.message}`);
  
  if (result.action === 'block') {
    // Handle threat
  }
}

scan('Your message here');
```

## Need Help?

- [Main Documentation](../README.md)
- [API Reference](../docs/API.md)
- [GitHub Issues](https://github.com/exo-explore/hopeIDS/issues)
