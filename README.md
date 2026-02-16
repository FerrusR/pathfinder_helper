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

- **Frontend**: Angular 19+ with Angular Material
- **Backend**: NestJS with Node.js 22 LTS
- **Database**: Azure PostgreSQL with pgvector for vector search
- **AI**: Azure OpenAI (GPT-4o + text-embedding-3-small)
- **Infrastructure**: Terraform for Azure resources
- **CI/CD**: GitHub Actions

## Project Structure

```
pathfinder_helper/
├── apps/
│   ├── frontend/          # Angular application
│   └── backend/           # NestJS API
├── infra/                 # Terraform infrastructure
│   └── modules/           # Terraform modules
├── scripts/               # Utility scripts (ingestion, testing)
├── data/                  # Local PF2e data (git-ignored)
└── docs/                  # Documentation
    └── prompts/           # Version-controlled AI prompts
```

## Getting Started

### Prerequisites

- Node.js 22 LTS
- npm 10+
- PostgreSQL 16 (or Azure PostgreSQL)
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

Or install individually:
```bash
npm run frontend:install
npm run backend:install
npm run scripts:install
```

3. Set up environment variables:

**Backend** (`apps/backend/.env`):
```bash
cp apps/backend/.env.example apps/backend/.env
# Edit .env with your database and Azure OpenAI credentials
```

**Infrastructure** (`infra/terraform.tfvars`):
```bash
cp infra/terraform.tfvars.example infra/terraform.tfvars
# Edit terraform.tfvars with your Azure subscription details
```

### Development

Run both frontend and backend concurrently:
```bash
npm run dev
```

Or run individually:

**Frontend** (http://localhost:4200):
```bash
npm run frontend:start
```

**Backend** (http://localhost:3000):
```bash
npm run backend:start
```

### Database Setup

1. Generate Prisma client:
```bash
npm run backend:prisma:generate
```

2. Run migrations:
```bash
npm run backend:prisma:migrate
```

### Infrastructure Deployment

1. Initialize Terraform:
```bash
npm run terraform:init
```

2. Plan deployment:
```bash
npm run terraform:plan
```

3. Apply infrastructure:
```bash
npm run terraform:apply
```

## Development Roadmap

See [TECH_STACK_AND_ROADMAP.md](./TECH_STACK_AND_ROADMAP.md) for the complete technical stack and development roadmap.

### Current Phase: Phase 0 - Project Setup ✅

- [x] Monorepo structure setup
- [ ] Deploy empty apps to Azure to verify infrastructure
- [ ] Set up GitHub Actions CI/CD

### Upcoming Phases

- **Phase 1**: Data Ingestion Pipeline
- **Phase 2**: Core Chatbot (RAW Mode)
- **Phase 3**: Authentication & Authorization
- **Phase 4**: Campaigns & Home Rules
- **Phase 5**: Campaign-Aware Chatbot
- **Phase 6**: Polish, Testing & Deployment

## Scripts

### Frontend
- `npm run frontend:start` - Start dev server
- `npm run frontend:build` - Build for production
- `npm run frontend:test` - Run tests

### Backend
- `npm run backend:start` - Start dev server
- `npm run backend:build` - Build for production
- `npm run backend:test` - Run tests
- `npm run backend:prisma:generate` - Generate Prisma client
- `npm run backend:prisma:migrate` - Run database migrations

### Infrastructure
- `npm run terraform:init` - Initialize Terraform
- `npm run terraform:plan` - Preview infrastructure changes
- `npm run terraform:apply` - Apply infrastructure changes
- `npm run terraform:destroy` - Destroy infrastructure

## License

UNLICENSED - Private project for personal use.

## Data Sources & Attribution

This project uses Pathfinder 2e rules data from:
- **Obsidian PF2e SRD Markdown** (Community)
- **Foundry VTT PF2e** (Apache 2.0)

Game mechanics are used under the **ORC License** (irrevocable, royalty-free).
Paizo-specific IP is used under the **Community Use Policy** for non-commercial use.

## Contributing

This is a personal project. For issues or suggestions, please open an issue on GitHub.
