# Pathfinder Rule Explorer - Tech Stack & Roadmap

## 1. Finalized Requirements Summary

- **Chatbot** with semantic search over Pathfinder 2e rules (RAG pattern)
- **Two chatbot modes**: "RAW" (Rules As Written) and "Campaign" (applies home rule overrides)
- **Home rules**: generic (apply to all campaigns) and campaign-specific
- **Rule proposals**: Players can propose home rules; Gamemasters approve/reject
- **Campaigns**: create, manage, assign users
- **RBAC**: Admin, Gamemaster (per campaign), Player — invite-only registration
- **Scale**: Under 10 concurrent users, non-commercial

---

## 2. Data Source for Pathfinder 2e Rules

Archives of Nethys (aonprd.com) has **no API or structured export**. However, excellent community sources exist:

| Source | Format | Coverage | License |
|--------|--------|----------|---------|
| **Foundry VTT PF2e** (`foundryvtt/pf2e` on GitHub) | JSON files in `packs/` | Comprehensive — all rules, creatures, spells, items, feats | Apache 2.0 |
| **PF2e Remaster SRD Markdown** (`Obsidian-TTRPG-Community`) | Markdown + YAML frontmatter | Comprehensive — ideal for text chunking | Community |
| **Pf2ools-data** (`Pf2ools/pf2ools-data` on GitHub) | JSON with formal schema + bundles | Good coverage, bundled exports | Community |

### Recommendation

Use the **Foundry VTT PF2e JSON** as the primary source for the RAG pipeline. While the Obsidian SRD Markdown was originally considered, it is outdated and itself derived from the Foundry VTT data. The Foundry JSON files provide the most comprehensive and up-to-date coverage, with structured metadata (traits, levels, publication info) and HTML descriptions that are converted to clean text during ingestion.

### Legal

- Game mechanics are freely usable under the **ORC License** (irrevocable, royalty-free)
- Paizo-specific IP (setting names, deities, etc.) covered under **Community Use Policy** for non-commercial use
- Foundry data covered under **Apache 2.0**
- Include proper attribution notices for all three

---

## 3. Finalized Tech Stack

### Frontend
| Component | Choice | Rationale |
|-----------|--------|-----------|
| Framework | **Angular 19+** | As requested; strong typing, good for structured apps |
| UI Library | **Angular Material** | Official, well-maintained, sufficient for this scale |
| State Management | **NgRx Signals** or Angular Signals | Lightweight, modern Angular pattern |
| Chat UI | Custom component | Simple message list + input; no need for heavy chat library |

### Backend
| Component | Choice | Rationale |
|-----------|--------|-----------|
| Runtime | **Node.js 22 LTS** | As requested |
| Framework | **NestJS** | TypeScript-native, modular, great for Angular developers (similar DI patterns), built-in guards for RBAC |
| ORM | **Prisma** | Type-safe, good Azure PostgreSQL support |
| Auth | **Passport.js + JWT** | Simple, sufficient for invite-only system at this scale |

### AI / Search
| Component | Choice | Rationale |
|-----------|--------|-----------|
| LLM | **Azure OpenAI Service (GPT-4o)** | Best quality for rules interpretation, Azure-native |
| Embeddings | **Azure OpenAI (text-embedding-3-small)** | Cost-effective, good quality, same service |
| Vector Store | **PostgreSQL + pgvector** | Single database for everything; avoids $70+/mo Azure AI Search cost |
| RAG Orchestration | **LangChain.js** or custom | LangChain simplifies the retrieval pipeline; custom is also fine at this scale |

> **Why pgvector instead of Azure AI Search?** For under 10 users, Azure AI Search's Basic tier (~$70/month) is overkill. PostgreSQL with pgvector handles both your relational data (users, campaigns, home rules) and vector search in one service, significantly reducing cost and complexity. If you later need more advanced search features (semantic ranking, faceted search), you can migrate to Azure AI Search.

### Database & Storage
| Component | Choice | Rationale |
|-----------|--------|-----------|
| Database | **Azure Database for PostgreSQL Flexible Server** | pgvector support, relational + vector in one, cost-effective |
| Blob Storage | **Azure Blob Storage** | For any uploaded documents, rule attachments |

### Infrastructure & DevOps
| Component | Choice | Rationale |
|-----------|--------|-----------|
| IaC | **Terraform** | As requested |
| Frontend Hosting | **Azure Static Web Apps** | Free tier available, built-in CI/CD from GitHub |
| Backend Hosting | **Azure App Service (B1 tier)** or **Azure Container Apps** | Cheapest options for small Node.js app |
| CI/CD | **GitHub Actions** | Free for public repos, integrates with Terraform and Azure |
| Monitoring | **Azure Application Insights** | Free tier sufficient for this scale |

### Estimated Monthly Azure Cost (Under 10 Users)
| Service | Estimated Cost |
|---------|---------------|
| Azure OpenAI (GPT-4o + embeddings) | $5-20 (usage-based) |
| Azure PostgreSQL Flexible (Burstable B1ms) | ~$13 |
| Azure App Service (B1) | ~$13 |
| Azure Static Web Apps | Free |
| Azure Blob Storage | < $1 |
| **Total** | **~$30-50/month** |

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Angular Frontend                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Chat UI  │  │ Campaign │  │ Home Rules Mgmt   │  │
│  │ (RAW /   │  │ Manager  │  │ (CRUD + Proposals)│  │
│  │ Campaign)│  │          │  │                   │  │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│       │              │                 │             │
└───────┼──────────────┼─────────────────┼─────────────┘
        │              │                 │
        ▼              ▼                 ▼
┌─────────────────────────────────────────────────────┐
│                  NestJS Backend                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Chat     │  │ Campaign │  │ Home Rules        │  │
│  │ Module   │  │ Module   │  │ Module            │  │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│       │              │                 │             │
│  ┌────▼──────────────┴─────────────────┴──────────┐  │
│  │              RAG Pipeline                       │  │
│  │  Query → Embed → Search pgvector → Compose     │  │
│  │  → (if Campaign mode: merge home rules)        │  │
│  │  → Send to Azure OpenAI → Stream response      │  │
│  └────────────────────────────────────────────────┘  │
│  ┌─────────────┐  ┌──────────────────────────────┐  │
│  │ Auth Module │  │ User/Invite Module           │  │
│  │ (JWT+RBAC)  │  │                              │  │
│  └─────────────┘  └──────────────────────────────┘  │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│          Azure PostgreSQL + pgvector                 │
│  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │ Relational   │  │ Vector Store                 │  │
│  │ (users,      │  │ (rule_chunks table with      │  │
│  │  campaigns,  │  │  content + embedding column) │  │
│  │  home_rules, │  │                              │  │
│  │  invites)    │  │                              │  │
│  └──────────────┘  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### RAG Pipeline Detail (Campaign Mode)

1. User sends question (e.g., "How does flanking work?")
2. Backend embeds the query using Azure OpenAI embeddings
3. Vector search against `rule_chunks` table (official rules)
4. **If Campaign mode**: also search `home_rule_chunks` filtered by campaign_id + generic
5. Merge results: home rules that match the same topic **replace** official rules in context
6. Compose prompt: system instructions + retrieved rules (with sources labeled) + user question
7. Send to Azure OpenAI GPT-4o, stream response back
8. Response includes citations indicating whether each rule is RAW or a home rule

---

## 5. Development Roadmap

### Phase 0: Project Setup & Foundation
**Goal**: Working dev environment, Azure resources provisioned, empty apps deployed

- [X] Set up monorepo structure (e.g., `apps/frontend`, `apps/backend`, `infra/`)
- [X] Scaffold Angular app with Angular CLI
- [X] Scaffold NestJS backend
- [X] Write Terraform configs for: Resource Group, PostgreSQL, App Service, Static Web App, Azure OpenAI
- [x] Set up GitHub Actions for CI/CD (build + deploy)
- [X] Deploy empty apps to Azure to verify infrastructure

**AI usage tips for Phase 0:**
- Use Claude Code to generate Terraform configurations — describe the resources you need and it can produce the HCL
- Use Claude Code to scaffold the NestJS modules and Angular components
- Use Claude Code to write GitHub Actions workflows

---

### Phase 1: Data Ingestion Pipeline
**Goal**: Pathfinder 2e rules loaded into PostgreSQL with vector embeddings

- [x] Copy Foundry VTT PF2e data into `data/pf2e/`
- [x] Set up local PostgreSQL with pgvector via Docker Compose
- [x] Add pgvector extension and embedding columns via Prisma migration
- [x] Write ingestion pipeline (`scripts/`) that:
  - Discovers and categorizes JSON files across 16 content categories
  - Parses Foundry VTT JSON, extracting `system.description.value` HTML content
  - Converts Foundry-specific notation (@UUID, @Damage, @Check, @Template, @Embed, @Localize) to clean text
  - Chunks content intelligently (single chunk for most items, heading-based splits for journal pages)
  - Generates embeddings via Azure OpenAI (text-embedding-3-small, 1536 dimensions)
  - Stores chunks + embeddings + metadata in PostgreSQL (pgvector) via raw SQL
- [x] Design the `rule_chunks` table schema:
  ```sql
  CREATE TABLE rule_chunks (
    id TEXT PRIMARY KEY,
    title TEXT,
    category TEXT,              -- spell, feat, condition, action, etc.
    source TEXT,                 -- source book
    content TEXT,                -- the actual rule text chunk
    embedding vector(1536),      -- pgvector column (HNSW indexed)
    source_id TEXT,              -- Foundry _id for deduplication
    source_file TEXT,            -- source file path for traceability
    metadata JSONB,              -- flexible metadata (level, traits, etc.)
    created_at TIMESTAMP
  );
  ```
- [x] Write data analysis script (`scripts/analyze-data.ts`) for dry-run validation
- [x] Run full ingestion, verify search quality with test queries
- [x] Ingestion supports re-ingestion via `--clear` flag

**AI usage tips for Phase 1:**
- Have Claude Code write the JSON parser and chunking logic — this is a great task for AI since it's largely string processing with clear rules
- Use Claude Code to help design the chunking strategy (rules have natural boundaries: one feat = one chunk, one spell = one chunk, longer rules may need splitting)
- Test embedding quality interactively: ask Claude Code to help you write test queries and evaluate retrieval results

---

### Phase 2: Core Chatbot (RAW Mode)
**Goal**: Working chat UI that answers Pathfinder rules questions using RAG

- [x] Backend: Create chat endpoint (POST /api/chat) that:
  - Accepts user message + conversation history
  - Embeds the query
  - Searches pgvector for top-K relevant rule chunks
  - Constructs prompt with system instructions + retrieved rules + conversation
  - Calls Azure OpenAI GPT-4o
  - Streams response back via SSE (Server-Sent Events)
- [x] Design system prompt for the chatbot:
  - "You are a Pathfinder 2e rules expert..."
  - Instructions to cite specific rules
  - Instructions to say "I'm not sure" rather than hallucinate
  - Instructions to reference the specific source (book, page/section)
- [ ] Frontend: Build chat component:
  - Message list (user + assistant messages)
  - Input field with send button
  - Streaming response display
  - Citation/source display for referenced rules
- [ ] Test with real PF2e rules questions, iterate on:
  - Retrieval quality (adjust chunk size, top-K, similarity threshold)
  - Prompt engineering (system prompt refinement)
  - Response quality

**AI usage tips for Phase 2:**
- This is the core AI/LLM work — use Claude Code to help write the RAG pipeline code
- **Prompt engineering is critical here**: iterate on the system prompt extensively. Start simple, test with edge cases, refine. Claude Code can help brainstorm prompt improvements
- Use Claude Code to write the SSE streaming logic in NestJS (it has specific patterns for this)
- Have Claude Code generate the Angular chat component — chat UIs are well-known patterns

---

### Phase 3: Authentication & Authorization
**Goal**: Invite-only auth system with RBAC

- [ ] Database: Users, Invites, Roles tables
  ```
  users: id, email, password_hash, display_name, role (admin), created_at
  invites: id, email, token, created_by, expires_at, used_at
  campaign_members: user_id, campaign_id, role (gamemaster|player)
  ```
- [ ] Backend:
  - Auth module: login, token refresh, password change
  - Invite module: Admin creates invite → sends email/link → user registers via invite token
  - RBAC guards: `@Roles('admin')`, `@Roles('gamemaster')` decorators on endpoints
  - Global vs campaign-level role checks
- [ ] Frontend:
  - Login page
  - Register via invite link page
  - Admin: user management + invite sending UI
  - Auth interceptor for JWT tokens
  - Route guards based on roles

**AI usage tips for Phase 3:**
- NestJS has well-documented patterns for guards and decorators — use Claude Code to generate these with proper typing
- Have Claude Code write the Prisma schema for auth tables
- Auth is security-sensitive: ask Claude Code to review the implementation for common vulnerabilities (token handling, password hashing, etc.)

---

### Phase 4: Campaigns & Home Rules
**Goal**: Full campaign management with home rule CRUD and proposal workflow

- [ ] Database:
  ```
  campaigns: id, name, description, created_by, created_at
  home_rules: id, campaign_id (nullable = generic), title, content,
              category, overrides_rule_id (nullable), status (draft|proposed|approved|rejected),
              proposed_by, approved_by, created_at
  home_rule_chunks: (same as rule_chunks but for home rules, with campaign_id)
  ```
- [ ] Backend:
  - Campaign CRUD (Gamemaster/Admin only for create/update/delete)
  - Campaign membership management
  - Home rule CRUD:
    - Players can create with status=proposed
    - Gamemasters can approve/reject proposals
    - Gamemasters can create directly with status=approved
    - Admin can create generic home rules (campaign_id=null)
  - When a home rule is approved: auto-embed and store in home_rule_chunks
- [ ] Frontend:
  - Campaign list/detail pages
  - Home rules management UI (list, create, edit, view)
  - Proposal workflow UI (pending proposals for GM to review)
  - Generic vs campaign-specific rule distinction in UI

**AI usage tips for Phase 4:**
- Use Claude Code to generate the NestJS CRUD modules + Prisma migrations
- Have Claude Code generate the Angular forms for home rule creation (reactive forms with validation)
- The embedding-on-approval logic is a good task for AI to implement

---

### Phase 5: Campaign-Aware Chatbot
**Goal**: Toggle between RAW and Campaign mode in the chatbot

- [ ] Frontend: Add mode toggle (RAW / Campaign) to chat UI
  - When Campaign mode selected, show campaign selector dropdown
- [ ] Backend: Modify RAG pipeline:
  - RAW mode: search only `rule_chunks` (unchanged from Phase 2)
  - Campaign mode:
    1. Search `rule_chunks` for relevant official rules
    2. Search `home_rule_chunks` filtered by (campaign_id = selected OR campaign_id IS NULL) AND status = approved
    3. Deduplication/override logic: if home rule targets same topic as official rule, replace in context
    4. Label each retrieved chunk as [Official] or [Home Rule: campaign_name] or [Home Rule: Generic]
  - Update system prompt to instruct the LLM about rule precedence:
    - Campaign home rules > Generic home rules > Official rules
- [ ] Response formatting: clearly indicate which rules are official vs home rules
- [ ] Test edge cases:
  - Question where home rule contradicts official rule
  - Question where no home rule exists (falls through to official)
  - Question spanning both modified and unmodified rules

**AI usage tips for Phase 5:**
- This phase involves nuanced prompt engineering for the override behavior — iterate with Claude Code on the system prompt
- Have Claude Code help design the deduplication/override logic
- Use Claude Code to write test scenarios

---

### Phase 6: Polish, Testing & Deployment
**Goal**: Production-ready application

- [ ] Error handling and loading states across the app
- [ ] End-to-end tests for critical flows (login, chat, home rule creation)
- [ ] Unit tests for RAG pipeline (retrieval quality, override logic)
- [ ] Responsive design for mobile (Angular Material handles most of this)
- [ ] Rate limiting on chat endpoint (even for small scale, protect against runaway costs)
- [ ] Azure Application Insights integration for monitoring
- [ ] Final Terraform review and hardening
- [ ] Documentation: setup guide, environment variables, deployment steps

**AI usage tips for Phase 6:**
- Have Claude Code write tests — provide the function signatures and expected behavior, let it generate test cases
- Use Claude Code for Terraform review and security hardening suggestions

---

## 6. How to Use AI Effectively Throughout Development

Since you're experienced in development but new to AI-assisted development, here are concrete strategies:

### General Principles

1. **AI as a pair programmer, not autopilot**: AI excels at generating boilerplate, implementing well-known patterns, and handling tedious transformations. You should drive the architecture and review everything it produces.

2. **Be specific in prompts**: Instead of "write me auth," say "write a NestJS guard that checks JWT tokens and verifies the user has the 'gamemaster' role for the campaign specified in the route parameter."

3. **Iterate, don't one-shot**: For complex features, build incrementally. Get the basic version working, then refine. This applies to both code and prompts.

4. **Use AI for exploration**: When evaluating libraries or approaches, ask AI to compare options with pros/cons specific to your use case.

### Where AI Adds the Most Value in This Project

| Task | AI Value | Why |
|------|----------|-----|
| Terraform configs | Very High | Declarative, well-documented patterns — AI generates accurately |
| NestJS CRUD modules | Very High | Highly repetitive, well-known patterns |
| Angular components | High | Template generation, reactive forms, Material integration |
| Data ingestion scripts | High | String processing, parsing, transformation — AI handles well |
| Prompt engineering | Medium-High | AI can suggest prompts but you need to evaluate quality empirically |
| RAG pipeline code | Medium-High | Well-documented pattern, but tuning needs human judgment |
| Auth implementation | Medium | AI generates the code well but security requires careful review |
| Database schema design | Medium | AI proposes good starting points but you should validate against your domain knowledge |
| Architecture decisions | Low-Medium | AI can present options but you need to make the calls |

### RAG-Specific AI Development Tips

1. **Start with a naive RAG and iterate**: Don't try to build the perfect retrieval pipeline from day one. Start with basic vector search, test with real questions, and improve based on what fails.

2. **Keep a test set of questions**: Maintain a spreadsheet of 20-30 PF2e rules questions with expected answers. Use this to evaluate retrieval and response quality as you iterate.

3. **Chunking matters more than you think**: How you split the rules into chunks has the biggest impact on retrieval quality. Experiment with different strategies (by heading, by rule, by paragraph).

4. **System prompt is your main lever**: Once retrieval is decent, most quality improvements come from refining the system prompt. Version control your prompts.

---

## 7. Monorepo Structure (Suggested)

```
pathfinder_helper/
├── apps/
│   ├── frontend/          # Angular app
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── core/          # Auth, guards, interceptors
│   │   │   │   ├── features/
│   │   │   │   │   ├── chat/      # Chat UI component
│   │   │   │   │   ├── campaigns/ # Campaign management
│   │   │   │   │   ├── rules/     # Home rules management
│   │   │   │   │   └── admin/     # User management, invites
│   │   │   │   └── shared/        # Shared components, pipes
│   │   │   └── environments/
│   │   ├── e2e/                   # End-to-end tests (Cypress/Playwright)
│   │   │   ├── src/
│   │   │   │   ├── chat.e2e.spec.ts
│   │   │   │   ├── campaigns.e2e.spec.ts
│   │   │   │   └── home-rules.e2e.spec.ts
│   │   │   └── cypress.config.ts  # or playwright.config.ts
│   │   ├── angular.json
│   │   ├── karma.conf.js          # Unit test configuration
│   │   └── tsconfig.spec.json     # TypeScript config for tests
│   │
│   └── backend/           # NestJS app
│       ├── src/
│       │   ├── auth/              # Auth module (JWT, guards, RBAC)
│       │   ├── users/             # User + invite management
│       │   ├── campaigns/         # Campaign CRUD
│       │   ├── home-rules/        # Home rules CRUD + proposals
│       │   ├── chat/              # Chat endpoint + RAG pipeline
│       │   ├── ingestion/         # Data ingestion service
│       │   └── common/            # Shared decorators, filters, pipes
│       ├── test/                  # Integration & E2E tests
│       │   ├── auth.e2e-spec.ts
│       │   ├── chat.e2e-spec.ts
│       │   ├── campaigns.e2e-spec.ts
│       │   ├── home-rules.e2e-spec.ts
│       │   ├── jest-e2e.json      # Jest config for E2E tests
│       │   └── test-helpers.ts    # Shared test utilities
│       ├── prisma/
│       │   └── schema.prisma
│       ├── jest.config.js         # Jest configuration
│       │
│       └── docs/                  # Minimal docs
│           └── prompts/           # Version-controlled system prompts
│               └── chat-system-prompt.md
│
├── infra/                 # Terraform
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── modules/
│       ├── database/
│       ├── app-service/
│       ├── static-web-app/
│       ├── openai/
│       └── storage/
│
├── scripts/               # Data ingestion, utilities
│   ├── ingest-rules.ts
│   └── test-retrieval.ts
│
└── data/                  # Git-ignored; local copy of PF2e data
```
