# hopeIDS Work Queue

**Goal:** AI agent security - detect prompt injection before it reaches your LLM  
**Updated:** 2026-02-05

---

## Phase 1: Core (v0.1) ✅

### HIGH
- [x] **IDS-1:** Core detection engine (4-layer architecture, 97 patterns) - **DONE @JASPER done:2026-02-04**
- [x] **IDS-2:** CLI tool (hopeid scan/stats/test) - **DONE @JASPER done:2026-02-04**
- [x] **IDS-3:** Docker container with test server - **DONE @JASPER done:2026-02-04**
- [x] **IDS-4:** Landing page website - **DONE @JASPER done:2026-02-04**
- [x] **IDS-5:** License & legal (AGPL-3.0) - **DONE @JASPER done:2026-02-04**

### MEDIUM
- [x] **IDS-7:** GitHub repository setup - **DONE @JASPER done:2026-02-04**
- [x] **IDS-8:** OpenClaw plugin with security_scan tool - **DONE @JASPER done:2026-02-04**
- [x] **IDS-9:** TypeScript type definitions - **DONE @QWEN done:2026-02-04**
- [x] **IDS-10:** Deploy website to localhost-1 - **DONE @JASPER done:2026-02-04**

### LOW
- [x] **IDS-11:** Express middleware - **DONE @SONNET done:2026-02-04**
- [x] **IDS-12:** Hono middleware - **DONE @SONNET done:2026-02-04**

---

## Phase 2: Detection Quality

### HIGH
- [x] **IDS-15:** Test suite expansion (30 attacks, 18 benign, 81% detection) - **DONE @SONNET done:2026-02-04**
- [x] **IDS-16:** Multi-language & Unicode detection (92% detection rate) - **DONE @SONNET done:2026-02-04**
- [ ] **IDS-17:** ExoHaven live demo scanner (real API, not hardcoded) - **TODO**
- [ ] **IDS-14:** Moltbook threat scanner (Docker, auto-update patterns) - **TODO**

### MEDIUM
- [ ] **IDS-13:** Local LLM integration (Ollama, LM Studio) - **TODO**
- [ ] **IDS-18:** Semantic layer enhancement (grandma/hypothetical/roleplay attacks) - **TODO**
- [ ] **IDS-19:** Context injection detection (PDF, email headers) - **TODO**

### LOW
- [ ] **IDS-20:** GitHub Actions CI - **TODO**
- [ ] **IDS-21:** README badges - **TODO**
- [ ] **IDS-22:** Detection confidence calibration - **TODO**

---

## Phase 3: Distribution

### HIGH
- [ ] **IDS-6:** npm publish - **BLOCKED** `needs npm login credentials`

### MEDIUM
- [ ] **IDS-23:** PyPI package (Python wrapper) - **TODO**
- [ ] **IDS-24:** Community pattern contributions - **TODO**

### LOW
- [ ] **IDS-25:** Domain setup (hopeid.exo.studio) - **TODO**
- [ ] **IDS-26:** Documentation site - **TODO**

---

*Last updated: 2026-02-05 10:17 UTC*
