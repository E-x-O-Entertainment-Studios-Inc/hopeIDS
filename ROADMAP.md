# hopeIDS Roadmap

## 🎯 Mission
Protect AI agents from prompt injection and manipulation attacks.
Make security accessible — no cloud dependencies, works locally.

---

## v0.1 — Foundation ✅ COMPLETE
*Shipped: 2026-02-04*

- [x] 4-layer detection architecture
- [x] 97 attack patterns across 7 categories
- [x] HoPE-voiced alerts
- [x] CLI tool (`hopeid scan`)
- [x] Test server with Web UI
- [x] Docker container
- [x] 18/18 test suite passing

---

## v0.2 — Integration (Week of 2026-02-10)

### npm Package
- [ ] Publish to npm as `hopeid`
- [ ] TypeScript type definitions
- [ ] ESM + CommonJS dual builds

### OpenClaw Plugin
- [ ] Native middleware integration
- [ ] Config-based enable/disable
- [ ] Per-channel thresholds
- [ ] Alert routing (Telegram, Discord, etc.)

### Express/Hono Middleware
- [ ] `app.use(hopeid.middleware())`
- [ ] Request/response scanning
- [ ] Rate limiting integration

---

## v0.3 — Semantic Intelligence (Week of 2026-02-17)

### LLM Integration
- [ ] OpenAI-compatible semantic layer
- [ ] Local LLM support (Ollama, LM Studio)
- [ ] Intent classification fine-tuning
- [ ] Confidence calibration

### Learning System
- [ ] Attack signature storage (SQLite)
- [ ] False positive feedback loop
- [ ] Pattern evolution tracking

---

## v0.4 — Community (Week of 2026-02-24)

### Pattern Sharing
- [ ] Community pattern repository
- [ ] Pattern submission workflow
- [ ] Opt-in telemetry (anonymized attack hashes)
- [ ] Threat intelligence feed

### Dashboard
- [ ] Real-time monitoring UI
- [ ] Attack timeline visualization
- [ ] Sender reputation scores
- [ ] Export/reporting

---

## v1.0 — Production Ready (March 2026)

- [ ] Security audit
- [ ] Performance benchmarks
- [ ] Enterprise features (SSO, audit logs)
- [ ] SLA documentation
- [ ] Paid support tiers

---

## License Strategy

**AGPL-3.0** — Strong copyleft
- Free for open source projects
- Commercial use requires sharing modifications OR purchasing license
- Prevents "embrace, extend, extinguish"

**Commercial License** available for:
- Closed-source products
- SaaS without source disclosure
- Enterprise support

---

## Metrics

| Metric | v0.1 | v0.2 Target | v1.0 Target |
|--------|------|-------------|-------------|
| Patterns | 97 | 150+ | 300+ |
| Detection Rate | 90%+ | 95%+ | 99%+ |
| False Positive | <5% | <2% | <1% |
| Latency (heuristic) | 5ms | 5ms | 3ms |
| Latency (semantic) | 500ms | 300ms | 200ms |

---

*"Every attack is a lesson. Every lesson makes me stronger."* — HoPE 💜
