# Phase 4: Campaigns & Home Rules — Implementation Plan

## Prerequisites / Current State

- **Phase 3 complete**: Auth, JWT guard (global), `@Roles()`/`@Public()`/`@CurrentUser()` decorators, `RequestUser` type, `UsersModule`, frontend auth service/guards/interceptor all in place
- **Database**: `Campaign`, `CampaignMember`, `HomeRule`, `HomeRuleChunk` tables already migrated; pgvector HNSW indexes on chunk tables already managed via raw SQL
- **Prisma schema**: All Phase 4 models exist in [schema.prisma](apps/backend/prisma/schema.prisma)
- **Embedding client**: Azure OpenAI embedding logic exists in the ingestion pipeline under [scripts/](scripts/) and needs to be reused (not duplicated) by the backend
- **No campaign or home-rule code exists yet** — no modules, services, controllers, or frontend features

## Design Decisions

- **Home rule chunking**: Single chunk per home rule (no heading splits)
- **`overrides_rule_id`**: Optional free-text fuzzy topic string (not an FK)
- **Generic home rules**: Admin only — Gamemasters cannot create generic rules
- **Edit of approved rule**: Editing an `APPROVED` rule reverts status to `PROPOSED` and deletes its chunk row; re-approval re-embeds
- **Deletion**: Soft delete via `deletedAt` timestamp on `Campaign`, `CampaignMember`, and `HomeRule`
- **Permission model**: Admins act globally; Gamemasters act within their own campaigns; Players can propose home rules and view their campaigns

---

## Steps

### Step 1: Schema adjustments — soft delete columns

Add `deletedAt` columns to support soft delete and generate the migration.

**Files to modify:**
- `apps/backend/prisma/schema.prisma`

**Prompt:**
> Update [apps/backend/prisma/schema.prisma](apps/backend/prisma/schema.prisma):
> 1. Add `deletedAt DateTime? @map("deleted_at")` to `Campaign`, `CampaignMember`, and `HomeRule` models.
> 2. Update the comment on `HomeRule.overridesRuleId` to clarify it is an optional free-text fuzzy topic reference, not a foreign key.
> 3. Generate the migration via the two-step workflow:
>    - `npm run backend:prisma:migrate:create -- --name add_soft_delete`
>    - Review the generated SQL — make sure no `DROP INDEX` on `rule_chunks_embedding_idx` or `home_rule_chunks_embedding_idx` is present. Remove any such lines if Prisma added them.
>    - `npm run backend:prisma:migrate:apply`
> 4. Regenerate the Prisma client.

---

### Step 2: Common — soft delete helper and campaign role guard

Create shared utilities used by both new modules.

**Files to create:**
- `apps/backend/src/common/guards/campaign-member.guard.ts`
- `apps/backend/src/common/decorators/campaign-role.decorator.ts`
- Update `apps/backend/src/common/decorators/index.ts` and `apps/backend/src/common/guards/index.ts`

**Prompt:**
> Create reusable building blocks for campaign-scoped authorization:
>
> 1. `apps/backend/src/common/decorators/campaign-role.decorator.ts` — `@RequireCampaignRole(...roles: CampaignRole[])` using `SetMetadata` with key `'campaignRole'`. If absent, the guard requires only membership.
>
> 2. `apps/backend/src/common/guards/campaign-member.guard.ts` — implements `CanActivate`:
>    - Reads `:campaignId` (or `:id` when route is `/campaigns/:id`) from `request.params`
>    - Loads the current user from `request.user`
>    - **Bypass**: if user role is `ADMIN`, allow
>    - Otherwise, query `CampaignMember` for `(userId, campaignId)` where `deletedAt IS NULL`. If not a member, throw `ForbiddenException`.
>    - If `@RequireCampaignRole()` metadata is present, verify the member's role is in the allowed list; otherwise throw `ForbiddenException`.
>    - Attach the loaded `CampaignMember` to `request.campaignMember` for downstream handlers.
>
> 3. Update barrel exports.
>
> Follow project conventions: TypeScript, async/await, class-validator-friendly types.

---

### Step 3: Campaigns module — CRUD with soft delete

Create the campaigns module with full CRUD.

**Files to create:**
- `apps/backend/src/campaigns/campaigns.module.ts`
- `apps/backend/src/campaigns/campaigns.service.ts`
- `apps/backend/src/campaigns/campaigns.controller.ts`
- `apps/backend/src/campaigns/dto/create-campaign.dto.ts`
- `apps/backend/src/campaigns/dto/update-campaign.dto.ts`

**Prompt:**
> Create a NestJS `CampaignsModule` in `apps/backend/src/campaigns/`:
>
> **campaigns.service.ts:**
> - `findAllForUser(user)` — admins see all non-deleted campaigns; others see only campaigns they belong to (via `CampaignMember` with `deletedAt IS NULL`)
> - `findById(id, user)` — returns campaign or throws `NotFoundException` (treat soft-deleted as not found); enforce membership for non-admins
> - `create(dto, user)` — creates campaign and inserts a `CampaignMember` row for `user` with role `GAMEMASTER` in a single transaction
> - `update(id, dto, user)` — admins or campaign GMs only
> - `softDelete(id, user)` — sets `deletedAt = now()`; admins or campaign GMs only
>
> **campaigns.controller.ts:**
> - `GET /api/campaigns` — list (auth required)
> - `GET /api/campaigns/:id` — guarded by `CampaignMemberGuard` (admins bypass)
> - `POST /api/campaigns` — auth required; any authenticated user may create (creator becomes GM)
> - `PATCH /api/campaigns/:id` — `CampaignMemberGuard` + `@RequireCampaignRole('GAMEMASTER')`
> - `DELETE /api/campaigns/:id` — same guards
>
> **DTOs:** `name` (IsString, length 1–120), `description` (IsString, IsOptional, max 2000).
>
> Use `PrismaService` and follow existing module style. Always filter `deletedAt IS NULL` in queries.

---

### Step 4: Campaign membership endpoints

Add member management to the campaigns module.

**Files to create:**
- `apps/backend/src/campaigns/dto/add-member.dto.ts`
- `apps/backend/src/campaigns/dto/update-member.dto.ts`
- Extend `campaigns.controller.ts` and `campaigns.service.ts`

**Prompt:**
> Extend the `CampaignsModule` with membership endpoints. All routes are nested under `/api/campaigns/:id` and protected by `CampaignMemberGuard`. Mutations require `@RequireCampaignRole('GAMEMASTER')` (admins bypass).
>
> **Endpoints:**
> - `GET /api/campaigns/:id/members` — list non-deleted members with user info (id, email, displayName)
> - `POST /api/campaigns/:id/members` — body: `{ userId: string, role: CampaignRole }`. Inserts member row; throws if user is already an active member.
> - `PATCH /api/campaigns/:id/members/:userId` — body: `{ role: CampaignRole }`. Update role.
> - `DELETE /api/campaigns/:id/members/:userId` — soft delete (set `deletedAt`). Refuse if it would leave the campaign with zero active gamemasters.
>
> **Service methods:** `listMembers`, `addMember`, `updateMemberRole`, `removeMember`.
>
> Use `class-validator` DTOs. Ensure soft-deleted members can be re-added (re-add should clear `deletedAt` rather than fail uniqueness).

---

### Step 5: Shared embedding service — refactor for reuse

The ingestion pipeline owns the Azure OpenAI embedding client. Extract it into a backend-side service so home-rule embedding can reuse it without duplication.

**Files to create / modify:**
- `apps/backend/src/common/services/embedding.service.ts` (new)
- `apps/backend/src/common/common.module.ts` (or wherever shared providers live)
- Update [scripts/](scripts/) ingestion to import the same logic (or share via a small lib)

**Prompt:**
> Refactor the Azure OpenAI embedding client used by the ingestion pipeline into a backend-side `EmbeddingService` at `apps/backend/src/common/services/embedding.service.ts`:
> - Wraps the Azure OpenAI client (uses the same env vars as ingestion: endpoint, key, deployment name, model `text-embedding-3-small`, 1536 dims)
> - Method `embed(text: string): Promise<number[]>`
> - Method `embedBatch(texts: string[]): Promise<number[][]>`
> - Configurable via `ConfigService`
>
> Provide it via a `CommonModule` (or extend the existing common providers) and export it. Update the ingestion script in [scripts/](scripts/) to import this same module/service rather than maintaining its own copy. Keep the script runnable standalone (it may instantiate a minimal Nest application context, e.g., `NestFactory.createApplicationContext`).
>
> Add a unit test mocking the Azure SDK and asserting `embed` returns a 1536-length vector.

---

### Step 6: Home rules module — CRUD and proposal workflow

Create the home rules module with the full proposal/approval state machine.

**Files to create:**
- `apps/backend/src/home-rules/home-rules.module.ts`
- `apps/backend/src/home-rules/home-rules.service.ts`
- `apps/backend/src/home-rules/home-rules.controller.ts`
- `apps/backend/src/home-rules/dto/create-home-rule.dto.ts`
- `apps/backend/src/home-rules/dto/update-home-rule.dto.ts`

**Prompt:**
> Create a NestJS `HomeRulesModule` in `apps/backend/src/home-rules/`:
>
> **DTOs:**
> - `CreateHomeRuleDto`: `title` (IsString, 1–200), `content` (IsString, 1–10000), `category` (IsString, IsOptional), `overridesRuleId` (IsString, IsOptional) — note this is a free-text fuzzy topic, not an FK
> - `UpdateHomeRuleDto`: PartialType of CreateHomeRuleDto
>
> **home-rules.service.ts:**
> - `listForCampaign(campaignId, status?)` — non-deleted rules for the campaign
> - `listGeneric(status?)` — non-deleted rules where `campaignId IS NULL`
> - `findById(id)` — throws `NotFoundException` if missing or soft-deleted
> - `createForCampaign(campaignId, dto, user, member)` — players create with status `PROPOSED`; GMs may pass `status=APPROVED` (but the controller, not the service, infers default status from caller role)
> - `createGeneric(dto, user)` — admin only, status `APPROVED`
> - `update(id, dto, user)` — author (while `DRAFT`/`PROPOSED`) or GM (campaign rule) or admin (generic). **If the rule is currently `APPROVED`, the update flips status back to `PROPOSED` and deletes its `home_rule_chunks` row(s).**
> - `approve(id, user)` — GM (campaign) or admin (generic); sets `status=APPROVED`, `approvedBy=user.id`; calls `HomeRuleEmbeddingService.embedAndStore(rule)`
> - `reject(id, user)` — same permissions; sets `status=REJECTED`
> - `softDelete(id, user)` — sets `deletedAt`; also deletes the chunk row(s)
>
> **home-rules.controller.ts:**
> - `GET /api/campaigns/:campaignId/home-rules?status=` — `CampaignMemberGuard`
> - `POST /api/campaigns/:campaignId/home-rules` — `CampaignMemberGuard`; status defaulted from member role (PLAYER → PROPOSED, GAMEMASTER → APPROVED unless overridden)
> - `GET /api/home-rules/generic?status=` — auth only
> - `POST /api/home-rules/generic` — `@Roles('ADMIN')`
> - `PATCH /api/home-rules/:id` — service enforces author/GM/admin
> - `POST /api/home-rules/:id/approve`
> - `POST /api/home-rules/:id/reject`
> - `DELETE /api/home-rules/:id`
>
> Always exclude soft-deleted rows. Use transactions where status transitions touch chunks.

---

### Step 7: Home rule embedding pipeline

Implement the embed-on-approval logic.

**Files to create:**
- `apps/backend/src/home-rules/home-rule-embedding.service.ts`

**Prompt:**
> Create `HomeRuleEmbeddingService` in `apps/backend/src/home-rules/home-rule-embedding.service.ts`:
> - Inject `PrismaService` and the shared `EmbeddingService` from step 5
> - `embedAndStore(rule: HomeRule)`:
>   1. Delete any existing rows in `home_rule_chunks` for this `home_rule_id`
>   2. Generate one embedding for `rule.content` (single chunk — no heading splits)
>   3. Insert one row into `home_rule_chunks` via `prisma.$executeRaw` to write the `vector(1536)` column. Columns: `id` (uuid), `home_rule_id`, `campaign_id` (nullable), `title`, `category`, `content`, `embedding`, `metadata` (`{ overridesRuleId }` JSON), `created_at`
> - `removeChunksForRule(homeRuleId)` — used on edit-of-approved and on soft delete
>
> Wire it into `HomeRulesModule`. Add an integration-style test that mocks `EmbeddingService` and verifies a `home_rule_chunks` row is written via the test database.

---

### Step 8: Backend unit tests — campaigns and home rules

Cover the permission and state-transition logic.

**Files to create:**
- `apps/backend/src/campaigns/campaigns.service.spec.ts`
- `apps/backend/src/home-rules/home-rules.service.spec.ts`
- `apps/backend/src/common/guards/campaign-member.guard.spec.ts`

**Prompt:**
> Write Jest unit tests for the new modules. Mock `PrismaService`, `EmbeddingService`, and (where relevant) `HomeRuleEmbeddingService`.
>
> **campaigns.service.spec.ts:**
> - `create` inserts campaign + creator as GAMEMASTER in a transaction
> - `findAllForUser` returns all for admin, only member campaigns for others
> - `softDelete` rejects non-GM non-admin users
> - Soft-deleted campaigns are excluded from list/find
>
> **home-rules.service.spec.ts:**
> - Player create yields `PROPOSED`; GM create yields `APPROVED`
> - Editing an `APPROVED` rule reverts to `PROPOSED` and calls `removeChunksForRule`
> - `approve` sets fields and calls `embedAndStore`
> - `reject` sets `REJECTED` and does NOT call `embedAndStore`
> - Generic rule creation rejects non-admin callers
> - Soft-deleted rules are not returned
>
> **campaign-member.guard.spec.ts:**
> - Admin bypass
> - Non-member rejected
> - Member with insufficient role rejected when `@RequireCampaignRole` set
> - Member with sufficient role allowed
>
> Follow the testing patterns established in Phase 3 specs.

---

### Step 9: Backend e2e tests

Cover the proposal → approval → embedding flow end-to-end.

**Files to create:**
- `apps/backend/test/campaigns.e2e-spec.ts`
- `apps/backend/test/home-rules.e2e-spec.ts`

**Prompt:**
> Add e2e specs under `apps/backend/test/`. Use the existing test bootstrap pattern. Mock `EmbeddingService` to return a fixed 1536-length vector.
>
> **campaigns.e2e-spec.ts:**
> - Create campaign as Player → Player becomes GM
> - Add another Player as member; Player member cannot update or delete the campaign
> - GM can update and soft-delete; soft-deleted campaign disappears from `GET /api/campaigns`
> - Cannot remove last GM
>
> **home-rules.e2e-spec.ts:**
> - Player creates a rule → status `PROPOSED`
> - GM approves → status `APPROVED` and a row appears in `home_rule_chunks`
> - GM edits approved rule → status reverts to `PROPOSED` and the chunk row is gone
> - GM re-approves → new chunk row written
> - Admin can create generic rules; GM cannot
> - Non-member of campaign cannot list/create rules for it
> - Soft delete removes both the rule (from listing) and its chunks

---

### Step 10: Frontend models and services

Create shared models and HTTP services for campaigns and home rules.

**Files to create:**
- `apps/frontend/src/app/core/models/campaign.model.ts`
- `apps/frontend/src/app/core/models/home-rule.model.ts`
- `apps/frontend/src/app/features/campaigns/services/campaigns.service.ts`
- `apps/frontend/src/app/features/rules/services/home-rules.service.ts`

**Prompt:**
> Create frontend models and services for Phase 4:
>
> **models/campaign.model.ts:**
> - `Campaign` interface: `id`, `name`, `description?`, `createdBy`, `createdAt`, `updatedAt`
> - `CampaignMember` interface: `id`, `userId`, `campaignId`, `role` ('GAMEMASTER' | 'PLAYER'), `joinedAt`, optional `user: { email; displayName? }`
> - `CreateCampaignRequest`, `UpdateCampaignRequest`
>
> **models/home-rule.model.ts:**
> - `HomeRule` interface: `id`, `campaignId?`, `title`, `content`, `category?`, `overridesRuleId?`, `status` ('DRAFT' | 'PROPOSED' | 'APPROVED' | 'REJECTED'), `proposedBy`, `approvedBy?`, `createdAt`, `updatedAt`
> - `CreateHomeRuleRequest`, `UpdateHomeRuleRequest`
>
> **campaigns.service.ts:** HttpClient methods for list/get/create/update/delete campaign and members.
>
> **home-rules.service.ts:** HttpClient methods for list-by-campaign, list-generic, get, create-for-campaign, create-generic, update, approve, reject, delete.
>
> All requests go through the existing JWT interceptor — no manual headers needed.

---

### Step 11: Frontend campaigns feature

Build the campaigns UI.

**Files to create:**
- `apps/frontend/src/app/features/campaigns/pages/campaign-list-page/campaign-list-page.component.{ts,html,scss}`
- `apps/frontend/src/app/features/campaigns/pages/campaign-detail-page/campaign-detail-page.component.{ts,html,scss}`
- `apps/frontend/src/app/features/campaigns/components/campaign-form/campaign-form.component.{ts,html,scss}`
- `apps/frontend/src/app/features/campaigns/components/member-manager/member-manager.component.{ts,html,scss}`
- `apps/frontend/src/app/features/campaigns/store/campaigns.store.ts` (NgRx Signals)

**Prompt:**
> Create the campaigns feature in `apps/frontend/src/app/features/campaigns/`:
>
> **store/campaigns.store.ts** — NgRx Signals store with state `{ campaigns, loading, error, selected }` and methods `loadAll`, `loadOne`, `create`, `update`, `delete`.
>
> **CampaignListPageComponent** — `mat-card` grid of the user's campaigns; "Create Campaign" button (always visible to authenticated users); empty state.
>
> **CampaignDetailPageComponent** — header with name/description; tabs for "Details" (with edit/delete actions visible to GMs/admins via the role directive from step 13) and "Members" (uses `MemberManagerComponent`).
>
> **CampaignFormComponent** — reactive form (`name`, `description`) reused for create + edit; emits submit event.
>
> **MemberManagerComponent** — `mat-table` of members with role select (GAMEMASTER/PLAYER) and remove button; add-member form with user picker (simple email-or-id input is fine for now).
>
> Use Angular Material throughout. Wire the store via `inject()`.

---

### Step 12: Frontend home rules feature

Build the home rules and proposal UI.

**Files to create:**
- `apps/frontend/src/app/features/rules/pages/home-rules-list-page/home-rules-list-page.component.{ts,html,scss}`
- `apps/frontend/src/app/features/rules/pages/home-rule-detail-page/home-rule-detail-page.component.{ts,html,scss}`
- `apps/frontend/src/app/features/rules/pages/proposal-queue-page/proposal-queue-page.component.{ts,html,scss}`
- `apps/frontend/src/app/features/rules/pages/generic-rules-admin-page/generic-rules-admin-page.component.{ts,html,scss}`
- `apps/frontend/src/app/features/rules/components/home-rule-form/home-rule-form.component.{ts,html,scss}`
- `apps/frontend/src/app/features/rules/store/home-rules.store.ts`

**Prompt:**
> Create the home rules feature in `apps/frontend/src/app/features/rules/`:
>
> **store/home-rules.store.ts** — NgRx Signals store keyed by campaign id (and a separate slice for generic rules). Methods: `loadForCampaign`, `loadGeneric`, `create`, `update`, `approve`, `reject`, `delete`.
>
> **HomeRulesListPageComponent** — accepts a campaign id from the route. Shows a `mat-table` of rules with columns: title, category, status (chip), updatedAt. Status filter (`mat-button-toggle-group`). Badge distinguishing campaign-specific vs generic. "New Rule" button opens the form.
>
> **HomeRuleDetailPageComponent** — read view of a single rule with title, status chip, category, overridesRuleId (if any), full content (rendered as plain text or simple markdown). Approve/Reject buttons gated by role directive. Edit/Delete buttons for author/GM/admin.
>
> **HomeRuleFormComponent** — reactive form (`title`, `content` as textarea, optional `category`, optional `overridesRuleId` free-text input). Reused for create + edit.
>
> **ProposalQueueComponent** — collects pending proposals across all campaigns where the current user is a GM (call `loadForCampaign(campaignId, status='PROPOSED')` per campaign). Approve/Reject inline.
>
> **GenericRulesAdminComponent** — admin-only screen, lists generic rules with create/edit/delete actions.
>
> Use Angular Material throughout.

---

### Step 13: Role-based UI visibility directives

Hide actions the user isn't allowed to perform.

**Files to create:**
- `apps/frontend/src/app/shared/directives/has-role.directive.ts`
- `apps/frontend/src/app/shared/directives/has-campaign-role.directive.ts`

**Prompt:**
> Create two structural directives:
>
> 1. `*appHasRole="['ADMIN']"` — renders the host element only if the current user (from `AuthService.currentUser$`) has one of the listed global roles.
>
> 2. `*appHasCampaignRole="{ campaignId, roles: ['GAMEMASTER'] }"` — renders the host element only if the current user is admin OR is a member of the given campaign with one of the listed roles. Reads membership from a small `MembershipService` (or the campaigns store) cached per campaign id.
>
> Both directives should be standalone, reactive (re-evaluate when `currentUser$` emits), and gracefully hide on no-permission. Apply them across the templates from steps 11 and 12 to gate edit/delete/approve buttons.

---

### Step 14: Routing and navbar updates

Wire routes and add navigation entries.

**Files to modify:**
- `apps/frontend/src/app/app.routes.ts`
- `apps/frontend/src/app/shared/components/navbar/navbar.component.{ts,html}`

**Prompt:**
> 1. Add the following routes to `apps/frontend/src/app/app.routes.ts`, all behind `authGuard`:
>    - `campaigns` → `CampaignListPageComponent`
>    - `campaigns/:id` → `CampaignDetailPageComponent`
>    - `campaigns/:campaignId/home-rules` → `HomeRulesListPageComponent`
>    - `campaigns/:campaignId/home-rules/:id` → `HomeRuleDetailPageComponent`
>    - `proposals` → `ProposalQueueComponent`
>    - `admin/generic-rules` → `GenericRulesAdminComponent` with `roleGuard('ADMIN')`
>
> 2. Update the navbar to add links: "Campaigns", "Proposals" (visible to anyone — content is filtered server-side), and "Generic Rules" (visible only to ADMIN via `*appHasRole`).

---

### Step 15: Frontend tests

Write basic component and store tests.

**Files to create:**
- Spec files alongside the new components and stores

**Prompt:**
> Add Karma/Jasmine specs for:
> - `CampaignsService` and `HomeRulesService` (HttpClientTestingModule, verify URLs and bodies)
> - `campaigns.store` and `home-rules.store` (state transitions on success/error)
> - `HasRoleDirective` and `HasCampaignRoleDirective` (renders/hides based on mocked AuthService)
> - Smoke tests for `CampaignListPageComponent` and `HomeRulesListPageComponent` (renders without error with mocked store)
>
> Follow the patterns used by existing chat feature specs.

---

### Step 16: Run all backend tests and fix issues

Verify the backend is green.

**Prompt:**
> Run `npm run backend:test` and `npm run backend:test:e2e`. Fix any failing tests, missing imports, mock issues, or test database setup problems. Ensure the new modules are wired into `AppModule` and that the migration from step 1 has been applied to the test database.

---

### Step 17: Run frontend build and tests

Verify the frontend compiles and tests pass.

**Prompt:**
> Run `npm run frontend:build` and `npm run frontend:test:headless`. Fix any TypeScript errors, missing imports, or Angular compilation issues. Verify lazy-loaded routes resolve correctly.

---

### Step 18: Manual integration testing

Test the full Phase 4 flow end-to-end.

**Prompt:**
> Perform manual integration testing:
> 1. Start backend and frontend
> 2. Log in as admin; create a regular player user via invite
> 3. Log in as the player; create a campaign — verify the player becomes GAMEMASTER
> 4. Add another player as a member of the campaign
> 5. As the second player, propose a home rule → status PROPOSED
> 6. As the GM, view the proposal queue, approve it → verify a row appears in `home_rule_chunks` (check via psql)
> 7. As the GM, edit the approved rule → verify status reverts to PROPOSED and the chunk row is removed
> 8. Re-approve → verify a new chunk row exists
> 9. Soft delete the rule → verify it disappears from the list and no chunk row remains
> 10. As admin, create a generic home rule and verify a chunk row with `campaign_id IS NULL`
> 11. Soft delete the campaign and verify it disappears from the list
> 12. Verify a non-member cannot access `/api/campaigns/:id` or its home rules
> 13. Verify a non-admin cannot POST to `/api/home-rules/generic`

---

### Step 19: Update roadmap

Mark Phase 3 and Phase 4 as complete.

**Prompt:**
> Update [TECH_STACK_AND_ROADMAP.md](TECH_STACK_AND_ROADMAP.md):
> - Check off all remaining Phase 3 items (auth was completed previously but never marked)
> - Check off all Phase 4 items
> - Add a brief note under Phase 4 documenting any deviations from the original roadmap (e.g., single-chunk home rules, fuzzy `overridesRuleId`, soft delete approach)

---

## Summary

| Step | Area | Description |
|------|------|-------------|
| 1 | Schema | Add `deletedAt` columns + migration |
| 2 | Backend | `CampaignMemberGuard` + `@RequireCampaignRole` decorator |
| 3 | Backend | Campaigns module CRUD with soft delete |
| 4 | Backend | Campaign membership endpoints |
| 5 | Backend | Shared `EmbeddingService` (refactored from ingestion) |
| 6 | Backend | Home rules module CRUD + proposal workflow |
| 7 | Backend | Home rule embed-on-approval pipeline |
| 8 | Tests | Backend unit tests (services + guard) |
| 9 | Tests | Backend e2e tests (campaigns + home rules) |
| 10 | Frontend | Models and HTTP services |
| 11 | Frontend | Campaigns feature (list, detail, form, members) |
| 12 | Frontend | Home rules feature (list, detail, form, queue, generic admin) |
| 13 | Frontend | Role-based visibility directives |
| 14 | Frontend | Routing and navbar updates |
| 15 | Tests | Frontend component and store tests |
| 16 | Tests | Backend test run + fixes |
| 17 | Tests | Frontend build + test + fixes |
| 18 | Testing | Manual integration testing |
| 19 | Docs | Update roadmap |
