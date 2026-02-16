# Pathfinder Rule Explorer

RAG-powered chatbot for Pathfinder 2e rules with campaign home rule support. Two chatbot modes: RAW (Rules As Written) and Campaign (applies home rule overrides). Invite-only, RBAC (Admin, Gamemaster, Player), under 10 concurrent users.

## Project Structure

Monorepo using npm workspaces:

- `apps/frontend/` — Angular 19 SPA
- `apps/backend/` — NestJS REST API
- `scripts/` — Data ingestion and utility scripts
- `infra/` — Terraform (Azure)
- `docs/prompts/` — Version-controlled AI prompts
- `data/` — Local PF2e data (gitignored)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Angular 19, Angular Material, NgRx Signals, SCSS |
| Backend | NestJS 11, Prisma 7, Passport.js + JWT |
| Database | PostgreSQL 16 + pgvector |
| AI/RAG | LangChain.js, Azure OpenAI (GPT-4o, text-embedding-3-small) |
| Infra | Terraform, Azure (App Service, Static Web Apps, PostgreSQL Flexible Server) |
| CI/CD | GitHub Actions |

## Architecture

### Backend Modules

Each feature is a NestJS module in `apps/backend/src/[module]/`:
- auth, users, campaigns, home-rules, chat, ingestion
- Shared code goes in `common/` (decorators, filters, pipes, guards)

### Frontend Features

Each feature lives in `apps/frontend/src/app/features/[feature]/`:
- chat, campaigns, rules, admin
- Shared code in `apps/frontend/src/app/shared/`
- Core services (auth, guards, interceptors) in `apps/frontend/src/app/core/`

### Database

- Prisma schema at `apps/backend/prisma/schema.prisma`
- Relational tables: users, campaigns, campaign_members, home_rules, invites
- Vector tables: rule_chunks, home_rule_chunks (pgvector for embeddings)
- Always run `npm run backend:prisma:migrate` after schema changes
- Never modify the database directly — use Prisma migrations

### AI Prompts

- Stored in `docs/prompts/` and version-controlled
- Changes to prompts should be committed with clear descriptions

## Git Workflow

- Main branches: `main` (production), `develop` (integration)
- Feature branches: `feature/description`, fix branches: `fix/description`
- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Always run tests before committing
- CI runs on push to main/develop and on PRs (frontend build, backend build, terraform validate)
- Deploy to Azure triggers on push to main (path-filtered per app)

## Testing

- Backend: Jest — test files use `*.spec.ts` (unit) and `*.e2e-spec.ts` (E2E)
- Frontend: Karma/Jasmine — test files use `*.spec.ts`; Cypress for E2E
- CI blocks merge if tests fail
- Run `npm run backend:test` and `npm run frontend:test` before pushing

## Important Rules

- Never commit `.env` files, `*.tfvars`, or any secrets
- Use TypeScript for all code — no plain `.js` files
- Use `async/await`, not `.then()` chains
- Use `const` by default, `let` when reassignment is needed, never `var`
- Backend API is prefixed with `/api`
- Backend uses a global ValidationPipe (whitelist, forbidNonWhitelisted, transform)
- Terraform files must pass `terraform fmt -check -recursive` before merge
- See @TECH_STACK_AND_ROADMAP.md for current development phase and detailed roadmap
- See @CONTRIBUTING.md for PR and contribution process
