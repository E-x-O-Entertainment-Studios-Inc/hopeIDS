# hopeIDS Work Queue

## ✅ Completed

### IDS-1: Core Detection Engine ✅
- **Status:** DONE
- **Completed:** 2026-02-04 by @JASPER
- **Branch:** main
- 4-layer architecture (heuristic, semantic, context, decision)
- 97 attack patterns
- HoPE-voiced alerts

### IDS-2: CLI Tool ✅
- **Status:** DONE  
- **Completed:** 2026-02-04 by @JASPER
- `hopeid scan`, `hopeid stats`, `hopeid test`

### IDS-3: Docker Container ✅
- **Status:** DONE
- **Completed:** 2026-02-04 by @JASPER
- Test server with Web UI
- Running at localhost:3333

### IDS-4: Website ✅
- **Status:** DONE
- **Completed:** 2026-02-04 by @JASPER
- Landing page at `/website/index.html`

### IDS-5: License & Legal ✅
- **Status:** DONE
- **Completed:** 2026-02-04 by @JASPER
- AGPL-3.0 with commercial option

---

## 🔄 In Progress

*None*

---

## 📋 Unclaimed

### IDS-6: npm Publish
- **Priority:** HIGH
- **Complexity:** SIMPLE
- **Description:** Publish `hopeid` package to npm registry
- **Tasks:**
  - [ ] Update package.json with final metadata
  - [ ] Add .npmignore (exclude test/, docker/, website/)
  - [ ] Run `npm publish`
  - [ ] Verify installation works: `npx hopeid stats`

### IDS-7: GitHub Repository Setup
- **Priority:** HIGH  
- **Complexity:** SIMPLE
- **Description:** Create public repo and push code
- **Tasks:**
  - [ ] Create repo: `E-x-O-Entertainment-Studios-Inc/hopeIDS`
  - [ ] Initialize git in `/home/jasper/projects/hopeIDS`
  - [ ] Push all code
  - [ ] Add GitHub Actions for CI
  - [ ] Add badges to README

### IDS-8: OpenClaw Plugin
- **Priority:** MEDIUM
- **Complexity:** MODERATE
- **Description:** Native middleware for OpenClaw integration
- **Tasks:**
  - [ ] Create `src/middleware/openclaw.js`
  - [ ] Config-based enable/disable
  - [ ] Per-channel threshold settings
  - [ ] Alert routing to configured channels
  - [ ] Test with live OpenClaw instance

### IDS-9: TypeScript Types
- **Priority:** MEDIUM
- **Complexity:** SIMPLE
- **Description:** Add TypeScript definitions for npm package
- **Tasks:**
  - [ ] Create `types/index.d.ts`
  - [ ] Export all public interfaces
  - [ ] Add to package.json "types" field

### IDS-10: Deploy Website
- **Priority:** HIGH
- **Complexity:** SIMPLE
- **Description:** Deploy hopeIDS website to production
- **Tasks:**
  - [ ] Set up nginx on target Linode
  - [ ] Configure SSL (Let's Encrypt or Tailscale)
  - [ ] Deploy website files
  - [ ] Point domain (hopeid.exo.studio or similar)

### IDS-11: Express Middleware
- **Priority:** MEDIUM
- **Complexity:** MODERATE
- **Description:** Drop-in Express.js middleware
- **Tasks:**
  - [ ] Create `src/middleware/express.js`
  - [ ] Request body scanning
  - [ ] Configurable error responses
  - [ ] Add to README with examples

### IDS-12: Hono Middleware  
- **Priority:** LOW
- **Complexity:** SIMPLE
- **Description:** Middleware for Hono framework
- **Tasks:**
  - [ ] Create `src/middleware/hono.js`
  - [ ] Same API as Express middleware

### IDS-13: Local LLM Integration
- **Priority:** MEDIUM
- **Complexity:** MODERATE
- **Description:** Support for local LLMs (Ollama, LM Studio)
- **Tasks:**
  - [ ] Add Ollama endpoint detection
  - [ ] Test with common models (Qwen, Mistral)
  - [ ] Document model recommendations

---

## 🚫 Blocked

*None*

---

## Stats

| Status | Count |
|--------|-------|
| ✅ Done | 5 |
| 🔄 In Progress | 0 |
| 📋 Unclaimed | 8 |
| 🚫 Blocked | 0 |

---

*Last updated: 2026-02-04 18:10 UTC*
