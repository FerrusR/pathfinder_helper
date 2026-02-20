# Pathfinder Rule Explorer

A RAG-powered chatbot for Pathfinder 2e rules with campaign-specific home rules support. This application is my personal experiment on how far can I get using mostly AI agents for development while working with unfamiliar to me frameworks.

## Overview

This application provides:
- **Semantic search** over Pathfinder 2e rules using RAG (Retrieval-Augmented Generation)
- **Two chatbot modes**:
  - **RAW (Rules As Written)**: Official Pathfinder 2e rules only
  - **Campaign Mode**: Applies campaign-specific and generic home rule overrides
- **Home rules management**: Players can propose, Gamemasters can approve/reject
- **Campaign management**: Create and manage multiple campaigns with different rulesets
- **RBAC**: Admin, Gamemaster (per campaign), and Player roles with invite-only registration

## Tech Stack

- **Frontend**: Angular 19, Angular Material, NgRx Signals
- **Backend**: NestJS 11, Prisma 7, Passport.js + JWT
- **Database**: PostgreSQL 16 + pgvector
- **AI**: Azure OpenAI (GPT-4o + text-embedding-3-small), LangChain.js
- **Infrastructure**: Terraform (Azure), GitHub Actions CI/CD

## Project Structure

```
pathfinder_helper/
├── apps/
│   ├── frontend/                  # Angular 19 SPA
│   │   └── src/app/
│   │       ├── core/              # Auth service, guards, interceptors
│   │       ├── features/
│   │       │   ├── chat/          # Chat UI (RAG chatbot)
│   │       │   ├── auth/          # Login & register pages
│   │       │   └── admin/         # User & invite management
│   │       └── shared/            # Shared components
│   └── backend/                   # NestJS REST API
│       ├── src/
│       │   ├── auth/              # JWT auth, Passport strategies, RBAC
│       │   ├── users/             # User & invite management
│       │   ├── chat/              # Chat endpoint + RAG pipeline
│       │   │   └── services/      # Embedding, vector search, chat logic
│       │   ├── common/            # Decorators, guards, types
│       │   ├── campaigns/         # (Phase 4)
│       │   └── home-rules/        # (Phase 4)
│       └── prisma/
│           └── schema.prisma
├── scripts/                       # Data ingestion & utilities
├── infra/                         # Terraform (Azure)
├── data/                          # Local PF2e data (git-ignored)
└── docs/prompts/                  # Version-controlled AI prompts
```

## Getting Started

### Prerequisites

- Node.js 22 LTS
- npm 10+
- Docker (for local PostgreSQL)
- Azure account (for OpenAI and deployment)
- Terraform 1.9+ (for infrastructure)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd pathfinder_helper
```

2. Install all dependencies:
```bash
npm run install:all
```

3. Set up environment variables:
```bash
cp apps/backend/.env.example apps/backend/.env
# Edit .env with your database and Azure OpenAI credentials
```

### Local Database Setup

1. Start PostgreSQL with pgvector via Docker:
```bash
docker compose up -d
```

2. Generate Prisma client and run migrations:
```bash
npm run backend:prisma:generate
npm run backend:prisma:migrate:apply
```

3. Seed the admin user:
```bash
npm run seed:admin
```

### Development

Run both frontend and backend concurrently:
```bash
npm run dev
```

Or run individually:

- **Frontend** (http://localhost:4200): `npm run frontend:start`
- **Backend** (http://localhost:3000): `npm run backend:start`

### Database Migrations

Migrations use a two-step process to protect manually-managed pgvector HNSW indexes:

1. `npm run backend:prisma:migrate:create` — generates SQL without applying
2. Review the SQL — remove any `DROP INDEX` on embedding indexes
3. `npm run backend:prisma:migrate:apply` — applies the migration

### Data Ingestion

To load Pathfinder 2e rules into the database:

1. Place Foundry VTT PF2e JSON data in `data/pf2e/`
2. Run the ingestion pipeline (see `scripts/` for details)

### Infrastructure Deployment

```bash
cp infra/terraform.tfvars.example infra/terraform.tfvars
# Edit terraform.tfvars with your Azure subscription details

npm run terraform:init
npm run terraform:plan
npm run terraform:apply
```

## Scripts

### Development
| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend and backend concurrently |
| `npm run frontend:start` | Start Angular dev server |
| `npm run backend:start` | Start NestJS dev server |

### Build & Test
| Command | Description |
|---------|-------------|
| `npm run frontend:build` | Build frontend for production |
| `npm run frontend:test` | Run frontend unit tests |
| `npm run frontend:test:headless` | Run frontend tests headless (CI) |
| `npm run backend:build` | Build backend for production |
| `npm run backend:test` | Run backend unit tests |

### Database
| Command | Description |
|---------|-------------|
| `npm run backend:prisma:generate` | Generate Prisma client |
| `npm run backend:prisma:migrate:create` | Create migration SQL (review before applying) |
| `npm run backend:prisma:migrate:apply` | Apply pending migrations |
| `npm run seed:admin` | Seed the initial admin user |

### Infrastructure
| Command | Description |
|---------|-------------|
| `npm run terraform:init` | Initialize Terraform |
| `npm run terraform:plan` | Preview infrastructure changes |
| `npm run terraform:apply` | Apply infrastructure changes |
| `npm run terraform:destroy` | Destroy infrastructure |

## Development Roadmap

See [TECH_STACK_AND_ROADMAP.md](./TECH_STACK_AND_ROADMAP.md) for the detailed technical stack and roadmap.

- [x] **Phase 0**: Project Setup & Foundation
- [x] **Phase 1**: Data Ingestion Pipeline
- [x] **Phase 2**: Core Chatbot (RAW Mode)
- [x] **Phase 3**: Authentication & Authorization
- [ ] **Phase 4**: Campaigns & Home Rules
- [ ] **Phase 5**: Campaign-Aware Chatbot
- [ ] **Phase 6**: Polish, Testing & Deployment

## License

UNLICENSED - Private project for personal use.

## Data Sources & Attribution

This project uses Pathfinder 2e rules data from:
- **Foundry VTT PF2e** (Apache 2.0) — primary data source

Game mechanics are used under the **ORC License** (irrevocable, royalty-free).
Paizo-specific IP is used under the **Community Use Policy** for non-commercial use.

## Contributing

This is a personal project. For issues or suggestions, please open an issue on GitHub.
