# Agentic Data Migration Planner & Reconciliation Workbench

An AI-powered application for planning, validating, and executing data migrations between source and target schemas. Built with the MERN stack (MongoDB-less in-memory variant) and Google Gemini AI.

![Migration Planner](https://img.shields.io/badge/Stack-MERN-green) ![AI](https://img.shields.io/badge/AI-Gemini%201.5-blue) ![Tests](https://img.shields.io/badge/Tests-36%20passing-brightgreen)

---

## 🚀 Live Demo

**Deployed at:** *(Add Vercel URL after deployment)*

**Test credentials / sample inputs:**
- Click **"Load Sample Data"** on the Setup tab for a pre-built Employee → Staff migration with 10 records (includes edge cases)
- Enter your Gemini API key in the Setup tab to enable AI features

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   React Frontend (Vite)                  │
│  Setup → AI Agent → Plan → Execute → History             │
├─────────────────────────────────────────────────────────┤
│                   Express.js API                         │
│  /api/schema  /api/agent  /api/migration  /api/recon     │
├──────────┬──────────┬──────────┬────────────────────────┤
│ Gemini   │Migration │Validation│ Reconciliation          │
│ AI Agent │ Engine   │ Engine   │ Engine + Rollback       │
├──────────┴──────────┴──────────┴────────────────────────┤
│              In-Memory Store (Singleton)                  │
│  Schemas│Records│Plans│Executions│Quarantine│AuditLog     │
└─────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Purpose |
|---|---|
| **In-Memory Store** | Singleton data store for schemas, records, plans, executions, quarantine, and audit log |
| **Transformation Engine** | 11 supported transformations: rename, typecast, dateformat, concat, split, default, trim, uppercase, lowercase, map_values, computed |
| **Validation Engine** | Field-level validation: type, required, maxLength, minLength, min, max, enum, pattern, email |
| **Migration Engine** | Deterministic dry run + real execution with quarantine and duplicate detection |
| **Reconciliation Engine** | Source vs target count comparison with field error summaries |
| **Rollback Engine** | Undo executed migrations by removing inserted target records |
| **Gemini AI Agent** | Schema analysis, field mapping proposals, risk assessment, clarification questions |

---

## 🛠 Setup & Run Locally

### Prerequisites
- Node.js >= 18
- A Google Gemini API key ([get one here](https://aistudio.google.com/app/apikey))

### Install

```bash
git clone https://github.com/mayurvij22/Agentic-Data-Migration-Planner-and-Reconciliation-Workbench.git
cd Agentic-Data-Migration-Planner-and-Reconciliation-Workbench

# Install server dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..
```

### Configure

```bash
# Copy env template
cp .env.example .env

# Edit .env and add your Gemini API key (optional — can also be entered via UI)
# GEMINI_API_KEY=your_key_here
```

### Run Development

```bash
# Terminal 1: Start backend
npm run dev:server

# Terminal 2: Start frontend
cd client && npm run dev
```

Or use concurrently:
```bash
npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001
- **Health check:** http://localhost:3001/api/health

### Run Tests

```bash
node server/tests/engine.test.js
```

Expected output: `41 passed, 0 failed`

---

## 📋 Workflow

1. **Setup** — Define source and target schemas (JSON), upload source records, configure Gemini API key
2. **AI Agent** — Run AI analysis to get proposed field mappings, risk assessment, and clarification questions
3. **Plan** — Review/edit the migration plan, configure transformations, approve the plan
4. **Execute** — Run deterministic dry runs, execute approved migrations, compare source vs target, rollback if needed
5. **History** — View full audit trail and quarantined records

### Human Approval Gate

> **The user must approve the mapping and transformation plan before execution.** The AI proposes mappings, but the human reviews, edits, and explicitly approves before any data is written to the target store.

A plan can only be approved once **exactly one** mapping is marked as the **Primary Key**. That field is the identity used to skip duplicates when a migration is retried, so it must be chosen deliberately rather than inferred.

---

## ✅ Completed Scope

- [x] AI agent proposes field mappings using Gemini
- [x] AI identifies incompatible/missing fields
- [x] AI suggests supported transformations
- [x] AI explains mapping risks
- [x] AI generates clarification questions
- [x] AI prepares a proposed migration plan
- [x] Human approval required before execution
- [x] Version migration plans (auto-incrementing versions)
- [x] Deterministic dry run (no side effects)
- [x] Quarantine invalid records (transformation + validation errors)
- [x] Show source, transformed, accepted, rejected counts
- [x] Preserve field-level error evidence
- [x] Execute approved migration into mock target
- [x] Prevent duplicate insertion on retry (primary-key dedup)
- [x] Compare source and target totals (reconciliation)
- [x] Support rollback of mock migration
- [x] Preserve execution, approval, retry, rollback history (audit log)
- [x] Limit to one source, one target, max 500 sample records
- [x] 11 supported transformation types
- [x] Clear loading, empty, validation, success, and failure states
- [x] 36 automated tests for all engines
- [x] Structured audit log with action-specific metadata
- [x] Premium dark-themed UI with glassmorphism
- [x] Vercel deployment configuration

## ❌ Intentionally Excluded

- **Production database access** — Uses in-memory store (data resets on server restart)
- **Arbitrary transformation code** — Only the 11 documented transformation types are supported
- **Distributed migration** — Single source, single target only
- **Live cloud connectors** — No external database connections
- **Persistent storage** — In-memory only (Vercel serverless cold starts reset state)
- **User authentication** — No login/session management
- **File upload** — Schemas and records are pasted as JSON

---

## 🧪 Tests

Tests cover all backend engines:

| Suite | Tests | Coverage |
|---|---|---|
| Transformations | 16 | All 11 types + edge cases |
| Validation | 7 | Required, type, length, range, enum |
| Migration Engine | 4 | Dry run, approval gate, execution, dedup |
| Plan Versioning | 2 | Version increment, approval status |
| Rollback | 3 | Record removal, status update, dry-run guard |
| Reconciliation | 1 | Balanced count verification |
| Audit Log | 2 | Schema changes, plan operations |
| **Total** | **36** | **All passing** |

Run: `node server/tests/engine.test.js`

---

## ⚠️ Limitations

1. **In-memory storage** — All data is lost on server restart or Vercel cold start. This is by design for the demo scope.
2. **Max 500 records** — Enforced limit for sample data size.
3. **Gemini API dependency** — AI features require a valid API key and internet connection.
4. **Simple expression evaluator** — The `computed` transformation only supports basic math (`+`, `-`, `*`, `/`).
5. **No real-time updates** — Uses polling/manual refresh, not WebSockets.

---

## 🚀 Deployment (Vercel)

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (from project root)
vercel

# For production
vercel --prod
```

### Environment Variables on Vercel

Set in Vercel dashboard → Settings → Environment Variables:

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Optional | Auto-initializes AI agent (can also be entered via UI) |
| `NODE_ENV` | Auto-set | Set to `production` by Vercel |

### Vercel Configuration

The `vercel.json` routes `/api/*` to the Express serverless function and serves the Vite-built frontend for all other routes.

---

## 📁 Project Structure

```
├── api/index.js                    # Vercel serverless entry
├── server/
│   ├── index.js                    # Express app
│   ├── ai/geminiAgent.js           # Gemini AI integration
│   ├── engine/
│   │   ├── transformations.js      # 11 transformation types
│   │   ├── validationEngine.js     # Field-level validation
│   │   ├── migrationEngine.js      # Dry run + execute
│   │   ├── reconciliationEngine.js # Source vs target comparison
│   │   └── rollbackEngine.js       # Undo migrations
│   ├── routes/
│   │   ├── schema.js               # Schema + record APIs
│   │   ├── migration.js            # Plan + execution APIs
│   │   ├── agent.js                # AI agent APIs
│   │   └── reconciliation.js       # Reconciliation APIs
│   ├── store/inMemoryStore.js      # Singleton data store
│   └── tests/engine.test.js        # 36 automated tests
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SetupPanel.jsx      # Schema editor + AI key
│   │   │   ├── AgentPanel.jsx      # AI analysis + mappings
│   │   │   ├── PlanPanel.jsx       # Plan review + approval
│   │   │   ├── ExecutionPanel.jsx  # Execute + reconcile
│   │   │   └── HistoryPanel.jsx    # Audit log + quarantine
│   │   ├── services/api.js         # API client
│   │   ├── App.jsx                 # Main app + sidebar
│   │   ├── App.css                 # Layout styles
│   │   ├── index.css               # Design system
│   │   └── main.jsx                # React entry
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── package.json
├── vercel.json
├── .env.example
├── .gitignore
├── README.md
└── AGENT_USAGE.md
```

---

## 📜 License

MIT
