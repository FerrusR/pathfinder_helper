# Phase 3: Authentication & Authorization — Implementation Plan

## Prerequisites / Current State

- **Database**: All tables already migrated (users, invites, campaigns, campaign_members)
- **Prisma schema**: User, Invite, Campaign, CampaignMember models fully defined
- **Backend packages**: `@nestjs/passport`, `@nestjs/jwt`, `passport`, `passport-jwt`, `passport-local`, `bcrypt` already installed
- **Environment**: `JWT_SECRET` and `JWT_EXPIRATION` already in `.env.example`
- **No auth code exists yet** — no modules, guards, decorators, interceptors, or frontend auth pages

## Design Decisions

- **Admin seeding**: Seed script (`npm run seed:admin`) creates admin from env vars
- **Token storage**: `localStorage` on frontend
- **Token strategy**: Single long-lived access token (7d), no refresh tokens
- **Invite delivery**: Admin copies invite link manually (no email service)
- **Roles**: Global `UserRole` (ADMIN, PLAYER) + per-campaign `CampaignRole` (GAMEMASTER, PLAYER)

---

## Steps

### Step 1: Create backend `common/` — Roles decorator and public decorator

Create the shared decorators that will be used by guards across all modules.

**Files to create:**
- `apps/backend/src/common/decorators/roles.decorator.ts` — `@Roles(...roles)` sets metadata
- `apps/backend/src/common/decorators/public.decorator.ts` — `@Public()` marks endpoints as public (skips JWT guard)
- `apps/backend/src/common/decorators/index.ts` — barrel export

**Prompt:**
> Create NestJS decorators in `apps/backend/src/common/decorators/`:
> 1. `roles.decorator.ts` — A `@Roles(...roles: string[])` decorator using `SetMetadata` with key `'roles'`. The roles can be values from either `UserRole` or `CampaignRole` enums from Prisma.
> 2. `public.decorator.ts` — A `@Public()` decorator using `SetMetadata` with key `'isPublic'` set to `true`. This will be used to bypass JWT auth on specific endpoints.
> 3. `index.ts` — barrel file re-exporting both decorators.
> Follow the project conventions: TypeScript, `const` by default, async/await.

---

### Step 2: Create the Auth module — JWT strategy and local strategy

Set up Passport strategies and the NestJS auth module with login/register logic.

**Files to create:**
- `apps/backend/src/auth/auth.module.ts`
- `apps/backend/src/auth/auth.service.ts` — login, register, validateUser, hashPassword, comparePassword
- `apps/backend/src/auth/auth.controller.ts` — POST `/auth/login`, POST `/auth/register`
- `apps/backend/src/auth/strategies/jwt.strategy.ts` — validates JWT, attaches user to request
- `apps/backend/src/auth/strategies/local.strategy.ts` — validates email+password for login
- `apps/backend/src/auth/dto/login.dto.ts` — email, password
- `apps/backend/src/auth/dto/register.dto.ts` — email, password, displayName, inviteToken

**Prompt:**
> Create a NestJS `AuthModule` in `apps/backend/src/auth/` with the following:
>
> **auth.service.ts:**
> - `validateUser(email, password)` — find user by email via PrismaService, compare password with bcrypt, return user without passwordHash or null
> - `login(user)` — takes validated user, returns `{ accessToken }` signed with JwtService
> - `register(dto: RegisterDto)` — validates invite token (find in DB, check not used, check not expired), hash password with bcrypt (10 rounds), create user with email from invite, mark invite as used (set `usedAt`), return `{ accessToken }`
>
> **auth.controller.ts:**
> - `POST /auth/login` — uses `@UseGuards(LocalAuthGuard)`, calls `authService.login(req.user)`, returns token
> - `POST /auth/register` — public endpoint, takes RegisterDto, calls `authService.register(dto)`
> Both endpoints should be decorated with `@Public()` to skip JWT guard.
>
> **strategies/local.strategy.ts:**
> - Passport local strategy, validates email+password via authService.validateUser
> - Uses `usernameField: 'email'`
>
> **strategies/jwt.strategy.ts:**
> - Extracts JWT from Authorization Bearer header
> - Validates payload, looks up user by ID via PrismaService to ensure user still exists
> - Attaches user (without passwordHash) to request
> - Uses `JWT_SECRET` from env via ConfigService or process.env
>
> **dto/login.dto.ts:** `email` (IsEmail), `password` (IsString, MinLength(8))
> **dto/register.dto.ts:** `email` (IsEmail), `password` (IsString, MinLength(8)), `displayName` (IsString, IsOptional), `inviteToken` (IsString, IsUUID)
>
> **auth.module.ts:** imports PassportModule, JwtModule.register with secret from env and expiresIn from env (default '7d'), provides strategies and service, exports JwtModule.
>
> Use PrismaService for all DB access. Use bcrypt for password hashing. Follow project conventions.

---

### Step 3: Create JWT auth guard and roles guard

Create the guards that enforce authentication and authorization globally.

**Files to create:**
- `apps/backend/src/common/guards/jwt-auth.guard.ts` — global guard, skips `@Public()` endpoints
- `apps/backend/src/common/guards/roles.guard.ts` — checks user role against `@Roles()` metadata
- `apps/backend/src/common/guards/local-auth.guard.ts` — simple `AuthGuard('local')` wrapper
- `apps/backend/src/common/guards/index.ts` — barrel export

**Prompt:**
> Create NestJS guards in `apps/backend/src/common/guards/`:
>
> 1. `jwt-auth.guard.ts` — Extends `AuthGuard('jwt')`. Override `canActivate` to check for `@Public()` metadata using Reflector. If `isPublic` is true, return true (skip auth). Otherwise, call `super.canActivate(context)`.
>
> 2. `roles.guard.ts` — Implements `CanActivate`. Uses Reflector to get `roles` metadata. If no roles are set, allow access (return true). Otherwise, get `request.user` from the execution context and check if user's `role` (from UserRole enum) is in the required roles array. Return true if match, throw ForbiddenException otherwise.
>
> 3. `local-auth.guard.ts` — Simply extends `AuthGuard('local')`, no custom logic needed.
>
> 4. `index.ts` — barrel export for all guards.
>
> The JWT guard will be registered globally in step 5. The roles guard is used per-endpoint with `@UseGuards(RolesGuard)`.

---

### Step 4: Create the Users module — user management and invite system

Create the users module for admin operations: list users, create invites, list invites.

**Files to create:**
- `apps/backend/src/users/users.module.ts`
- `apps/backend/src/users/users.service.ts` — CRUD for users and invites
- `apps/backend/src/users/users.controller.ts` — admin-only endpoints
- `apps/backend/src/users/dto/create-invite.dto.ts`
- `apps/backend/src/users/dto/update-user.dto.ts`

**Prompt:**
> Create a NestJS `UsersModule` in `apps/backend/src/users/` with:
>
> **users.service.ts:**
> - `findAll()` — returns all users (without passwordHash)
> - `findById(id)` — returns user by id (without passwordHash)
> - `findByEmail(email)` — returns user by email (with passwordHash, for auth use)
> - `updateRole(userId, role: UserRole)` — update user's global role
> - `deleteUser(userId)` — delete a user
> - `createInvite(email, createdById)` — create invite with random UUID token, 7-day expiry, return invite with generated link
> - `findAllInvites()` — list all invites with creator info
> - `findInviteByToken(token)` — find invite by token
> - `revokeInvite(inviteId)` — delete unused invite
>
> **users.controller.ts (all admin-only):**
> - `GET /users` — list all users (`@Roles('ADMIN')`)
> - `PATCH /users/:id/role` — update user role (`@Roles('ADMIN')`)
> - `DELETE /users/:id` — delete user (`@Roles('ADMIN')`)
> - `POST /users/invites` — create invite (`@Roles('ADMIN')`)
> - `GET /users/invites` — list invites (`@Roles('ADMIN')`)
> - `DELETE /users/invites/:id` — revoke invite (`@Roles('ADMIN')`)
>
> All endpoints protected by `@UseGuards(RolesGuard)` and `@Roles('ADMIN')`.
> Use PrismaService for DB access. Exclude passwordHash from all user responses using Prisma `select` or manual omit.

---

### Step 5: Register auth globally in AppModule

Wire up the auth module, users module, and global JWT guard in the app module.

**Files to modify:**
- `apps/backend/src/app.module.ts` — import AuthModule, UsersModule, provide global JWT guard

**Prompt:**
> Update `apps/backend/src/app.module.ts`:
> 1. Import `AuthModule` and `UsersModule`
> 2. Add them to the `imports` array (uncomment/replace the commented placeholders)
> 3. In the `providers` array, add global JWT auth guard:
>    ```typescript
>    { provide: APP_GUARD, useClass: JwtAuthGuard }
>    ```
> 4. Mark existing public endpoints with `@Public()`:
>    - The health endpoint in `app.controller.ts`
>    - The root GET endpoint in `app.controller.ts`
>
> This makes JWT auth the default for ALL endpoints. Only endpoints decorated with `@Public()` bypass it.

---

### Step 6: Add `@Request()` user typing

Create a type/interface for the authenticated request user and a `@CurrentUser()` parameter decorator.

**Files to create:**
- `apps/backend/src/common/decorators/current-user.decorator.ts` — extracts user from request
- Update `apps/backend/src/common/decorators/index.ts`

**Prompt:**
> 1. Create `apps/backend/src/common/decorators/current-user.decorator.ts`:
>    - A custom parameter decorator `@CurrentUser()` using `createParamDecorator` that extracts `request.user` from the execution context.
>    - Optionally accepts a `data` parameter (string key) to extract a specific property (e.g., `@CurrentUser('id')` returns just the user id).
>
> 2. Create a `RequestUser` type/interface in `apps/backend/src/common/types/request-user.type.ts` with the fields: `id`, `email`, `displayName`, `role` (UserRole enum). This represents the user object attached to the request after JWT validation (no passwordHash).
>
> 3. Update the barrel exports in `apps/backend/src/common/decorators/index.ts`.

---

### Step 7: Protect the chat endpoint with JWT

Add authentication to the existing chat endpoint.

**Files to modify:**
- `apps/backend/src/chat/chat.controller.ts` — JWT is now applied globally, just verify it works. Optionally inject `@CurrentUser()` for future logging.

**Prompt:**
> Update `apps/backend/src/chat/chat.controller.ts`:
> - The global JWT guard is already active (from step 5), so the chat endpoint is now protected automatically.
> - Add `@CurrentUser() user: RequestUser` parameter to the chat handler for future use (logging, per-user rate limiting).
> - No `@Public()` decorator should be added — the chat endpoint requires authentication.
> - Verify the endpoint still works with a valid JWT token.

---

### Step 8: Create the admin seed script

Create a script to seed the first admin user.

**Files to create:**
- `scripts/seed-admin.ts`
- Add `seed:admin` script to root `package.json`

**Prompt:**
> Create `scripts/seed-admin.ts` that:
> 1. Reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from environment variables (with fallback to `.env`)
> 2. Connects to the database using PrismaClient directly
> 3. Checks if a user with that email already exists — if so, prints message and exits
> 4. Hashes the password with bcrypt (10 rounds)
> 5. Creates the user with role `ADMIN`
> 6. Prints success message with the created user's email
> 7. Disconnects Prisma
>
> Add `"seed:admin": "npx ts-node scripts/seed-admin.ts"` to the root `package.json` scripts.
> The script should use `dotenv` to load `.env` from the project root.
> Add `ADMIN_EMAIL` and `ADMIN_PASSWORD` to `.env.example` with placeholder values.

---

### Step 9: Write backend unit tests for AuthService

Test the core authentication logic.

**Files to create:**
- `apps/backend/src/auth/auth.service.spec.ts`

**Prompt:**
> Write Jest unit tests for `AuthService` in `apps/backend/src/auth/auth.service.spec.ts`:
>
> - Mock `PrismaService` and `JwtService`
> - **validateUser tests:**
>   - Returns user (without passwordHash) when email and password are correct
>   - Returns null when email not found
>   - Returns null when password doesn't match
> - **login tests:**
>   - Returns an object with `accessToken` from JwtService.sign
> - **register tests:**
>   - Successfully creates user and marks invite as used when invite is valid
>   - Throws error when invite token is invalid/not found
>   - Throws error when invite is already used
>   - Throws error when invite is expired
>   - Throws error when email already registered
>
> Follow existing test patterns. Use `beforeEach` with `Test.createTestingModule`. Use `jest.fn()` for mocks.

---

### Step 10: Write backend unit tests for guards

Test the JWT auth guard and roles guard.

**Files to create:**
- `apps/backend/src/common/guards/jwt-auth.guard.spec.ts`
- `apps/backend/src/common/guards/roles.guard.spec.ts`

**Prompt:**
> Write Jest unit tests:
>
> **jwt-auth.guard.spec.ts:**
> - Returns true (skips auth) when endpoint has `@Public()` metadata
> - Calls super.canActivate when endpoint is not public
>
> **roles.guard.spec.ts:**
> - Returns true when no `@Roles()` metadata is set (no restriction)
> - Returns true when user has a matching role
> - Throws ForbiddenException when user role doesn't match required roles
> - Returns true when user has one of multiple allowed roles
>
> Mock Reflector and ExecutionContext appropriately.

---

### Step 11: Write backend unit tests for UsersService

Test user management and invite logic.

**Files to create:**
- `apps/backend/src/users/users.service.spec.ts`

**Prompt:**
> Write Jest unit tests for `UsersService` in `apps/backend/src/users/users.service.spec.ts`:
>
> - Mock `PrismaService`
> - **findAll** — returns users without passwordHash
> - **createInvite** — creates invite with correct expiry (7 days), returns invite with token
> - **createInvite** — throws if email already has a pending invite
> - **updateRole** — calls prisma update with correct params
> - **deleteUser** — calls prisma delete
> - **revokeInvite** — deletes the invite
>
> Follow the same testing patterns used in step 9.

---

### Step 12: Create frontend `core/` — Auth service and token management

Create the core authentication service on the frontend.

**Files to create:**
- `apps/frontend/src/app/core/services/auth.service.ts` — login, register, logout, token management
- `apps/frontend/src/app/core/models/user.model.ts` — User interface, AuthResponse interface

**Prompt:**
> Create frontend auth service in `apps/frontend/src/app/core/`:
>
> **models/user.model.ts:**
> - `User` interface: `id`, `email`, `displayName`, `role` (string)
> - `AuthResponse` interface: `accessToken`, `user`
> - `LoginRequest` interface: `email`, `password`
> - `RegisterRequest` interface: `email`, `password`, `displayName?`, `inviteToken`
>
> **services/auth.service.ts:**
> - Injectable, `providedIn: 'root'`
> - Uses `HttpClient` for API calls
> - `login(credentials: LoginRequest): Observable<AuthResponse>` — POST to `/api/auth/login`
> - `register(data: RegisterRequest): Observable<AuthResponse>` — POST to `/api/auth/register`
> - `logout()` — remove token from localStorage, navigate to login
> - `getToken(): string | null` — read from localStorage
> - `setToken(token: string)` — save to localStorage
> - `isAuthenticated(): boolean` — check if valid token exists in localStorage
> - `getCurrentUser(): User | null` — decode JWT payload to extract user info (without a library, just `atob` the payload)
> - Use a `BehaviorSubject<User | null>` for `currentUser$` observable, updated on login/logout
> - Token key in localStorage: `'auth_token'`

---

### Step 13: Create frontend HTTP interceptor for JWT

Attach the JWT token to all outgoing API requests.

**Files to create:**
- `apps/frontend/src/app/core/interceptors/auth.interceptor.ts`

**Files to modify:**
- `apps/frontend/src/app/app.config.ts` — register the interceptor

**Prompt:**
> 1. Create `apps/frontend/src/app/core/interceptors/auth.interceptor.ts`:
>    - A functional HTTP interceptor (Angular 19 style using `HttpInterceptorFn`)
>    - Gets the token from `AuthService.getToken()`
>    - If token exists, clone the request and add `Authorization: Bearer <token>` header
>    - If the response is 401, call `AuthService.logout()` to clear token and redirect to login
>    - Pass through if no token
>
> 2. Update `apps/frontend/src/app/app.config.ts`:
>    - Change `provideHttpClient()` to `provideHttpClient(withInterceptors([authInterceptor]))`
>    - Import the interceptor function

---

### Step 14: Create frontend auth guard

Protect routes that require authentication.

**Files to create:**
- `apps/frontend/src/app/core/guards/auth.guard.ts`
- `apps/frontend/src/app/core/guards/role.guard.ts` (optional, for admin routes)

**Prompt:**
> Create Angular route guards in `apps/frontend/src/app/core/guards/`:
>
> 1. `auth.guard.ts` — functional `CanActivateFn` guard:
>    - Inject `AuthService` and `Router`
>    - If `authService.isAuthenticated()` returns true, allow navigation
>    - Otherwise, redirect to `/login` and return false
>
> 2. `role.guard.ts` — functional `CanActivateFn` guard factory:
>    - Export a function `roleGuard(...roles: string[]): CanActivateFn`
>    - Inject `AuthService` and `Router`
>    - Check if current user's role is in the allowed roles
>    - If not, redirect to `/chat` (or show unauthorized page) and return false

---

### Step 15: Create frontend login page

Build the login page component.

**Files to create:**
- `apps/frontend/src/app/features/auth/pages/login-page/login-page.component.ts`
- `apps/frontend/src/app/features/auth/pages/login-page/login-page.component.html`
- `apps/frontend/src/app/features/auth/pages/login-page/login-page.component.scss`

**Prompt:**
> Create an Angular standalone login page component at `apps/frontend/src/app/features/auth/pages/login-page/`:
>
> - Reactive form with `email` and `password` fields
> - Use Angular Material form fields (`mat-form-field`, `mat-input`, `mat-label`)
> - Submit button with `mat-raised-button color="primary"`
> - Show error message from API (e.g., "Invalid credentials") using `mat-error` or a snackbar
> - Loading state: disable button and show spinner during login request
> - On success: store token via AuthService, navigate to `/chat`
> - Centered card layout (`mat-card`) with app title
> - If user is already authenticated, redirect to `/chat`
> - Link to register page (note: registration requires an invite link, so just a small text note)
> - SCSS styling for centered login card (max-width ~400px, vertically centered)

---

### Step 16: Create frontend register page

Build the registration page for invited users.

**Files to create:**
- `apps/frontend/src/app/features/auth/pages/register-page/register-page.component.ts`
- `apps/frontend/src/app/features/auth/pages/register-page/register-page.component.html`
- `apps/frontend/src/app/features/auth/pages/register-page/register-page.component.scss`

**Prompt:**
> Create an Angular standalone register page component at `apps/frontend/src/app/features/auth/pages/register-page/`:
>
> - Reads `token` from query params (`ActivatedRoute`) — this is the invite token
> - If no token in URL, show error message "Registration requires an invite link"
> - Reactive form with: `email` (pre-filled and readonly if provided by invite), `password`, `confirmPassword`, `displayName` (optional)
> - Password validation: minimum 8 characters, must match confirmPassword
> - Use Angular Material form fields and card layout (same style as login)
> - On submit: call `AuthService.register()` with form data + invite token
> - On success: store token, navigate to `/chat`
> - Show API errors (invalid invite, expired invite, email mismatch, etc.)
> - Link back to login page

---

### Step 17: Create frontend admin page — User management

Build the admin page for managing users and invites.

**Files to create:**
- `apps/frontend/src/app/features/admin/pages/admin-page/admin-page.component.ts`
- `apps/frontend/src/app/features/admin/pages/admin-page/admin-page.component.html`
- `apps/frontend/src/app/features/admin/pages/admin-page/admin-page.component.scss`
- `apps/frontend/src/app/features/admin/services/admin.service.ts`

**Prompt:**
> Create the admin feature in `apps/frontend/src/app/features/admin/`:
>
> **services/admin.service.ts:**
> - Injectable service using HttpClient
> - `getUsers(): Observable<User[]>` — GET `/api/users`
> - `updateUserRole(userId: string, role: string): Observable<User>` — PATCH `/api/users/:id/role`
> - `deleteUser(userId: string): Observable<void>` — DELETE `/api/users/:id`
> - `getInvites(): Observable<Invite[]>` — GET `/api/users/invites`
> - `createInvite(email: string): Observable<Invite>` — POST `/api/users/invites`
> - `revokeInvite(inviteId: string): Observable<void>` — DELETE `/api/users/invites/:id`
>
> **pages/admin-page/admin-page.component.ts + html + scss:**
> - Two sections in tabs (`mat-tab-group`): "Users" and "Invites"
> - **Users tab:**
>   - `mat-table` listing all users (email, displayName, role, createdAt)
>   - Role dropdown (`mat-select`) to change user role (ADMIN/PLAYER)
>   - Delete button with confirmation dialog (`mat-dialog` or `window.confirm`)
> - **Invites tab:**
>   - Form to create new invite: email input + "Create Invite" button
>   - `mat-table` listing invites (email, token/link, status used/pending, expiresAt, createdBy)
>   - "Copy Link" button for each invite that copies the registration URL to clipboard
>   - "Revoke" button for unused invites
>   - The invite link format: `{window.location.origin}/register?token={invite.token}`
> - Use Angular Material components throughout

---

### Step 18: Update frontend routing

Add auth routes and protect existing routes.

**Files to modify:**
- `apps/frontend/src/app/app.routes.ts`

**Prompt:**
> Update `apps/frontend/src/app/app.routes.ts`:
>
> ```typescript
> export const routes: Routes = [
>   {
>     path: 'login',
>     loadComponent: () => import('./features/auth/pages/login-page/login-page.component')
>       .then(m => m.LoginPageComponent),
>   },
>   {
>     path: 'register',
>     loadComponent: () => import('./features/auth/pages/register-page/register-page.component')
>       .then(m => m.RegisterPageComponent),
>   },
>   {
>     path: 'chat',
>     loadComponent: () => import('./features/chat/pages/chat-page/chat-page.component')
>       .then(m => m.ChatPageComponent),
>     canActivate: [authGuard],
>   },
>   {
>     path: 'admin',
>     loadComponent: () => import('./features/admin/pages/admin-page/admin-page.component')
>       .then(m => m.AdminPageComponent),
>     canActivate: [authGuard, roleGuard('ADMIN')],
>   },
>   { path: '', redirectTo: 'chat', pathMatch: 'full' },
>   { path: '**', redirectTo: 'chat' },
> ];
> ```

---

### Step 19: Update frontend chat to send auth token with SSE

The chat uses a custom fetch-based SSE client (not HttpClient), so the interceptor won't apply automatically.

**Files to modify:**
- `apps/frontend/src/app/features/chat/services/chat-api.service.ts`

**Prompt:**
> Update `apps/frontend/src/app/features/chat/services/chat-api.service.ts`:
> - The chat SSE uses `fetch()` directly, not Angular's HttpClient, so the auth interceptor doesn't apply
> - Inject `AuthService` and add the JWT token to the fetch request headers:
>   ```typescript
>   headers: {
>     'Content-Type': 'application/json',
>     'Authorization': `Bearer ${this.authService.getToken()}`
>   }
>   ```
> - Handle 401 responses: if fetch returns 401, call `authService.logout()`

---

### Step 20: Add navigation bar with auth state

Add a top navigation bar showing the logged-in user and logout button.

**Files to create/modify:**
- `apps/frontend/src/app/shared/components/navbar/navbar.component.ts`
- `apps/frontend/src/app/shared/components/navbar/navbar.component.html`
- `apps/frontend/src/app/shared/components/navbar/navbar.component.scss`
- `apps/frontend/src/app/app.component.ts` — include navbar

**Prompt:**
> 1. Create a standalone navbar component at `apps/frontend/src/app/shared/components/navbar/`:
>    - Use `mat-toolbar` with app title "Pathfinder Rule Explorer"
>    - Show current user's displayName or email on the right
>    - "Admin" link (only visible if user role is ADMIN) navigating to `/admin`
>    - "Logout" button calling `AuthService.logout()`
>    - Only show navbar when user is authenticated (use `authService.currentUser$`)
>
> 2. Update `apps/frontend/src/app/app.component.ts`:
>    - Add `<app-navbar>` above `<router-outlet>`
>    - Import the navbar component

---

### Step 21: Run all backend tests and fix issues

Verify all backend tests pass.

**Prompt:**
> Run `npm run backend:test` and fix any failing tests. This includes:
> - Existing chat module tests
> - New auth service tests (step 9)
> - New guard tests (step 10)
> - New users service tests (step 11)
> - Make sure the app module test still passes with the new imports
>
> Fix any import errors, mock issues, or test configuration problems.

---

### Step 22: Run frontend build and fix issues

Verify the frontend builds without errors.

**Prompt:**
> Run `npm run frontend:build` (or `ng build` in the frontend directory) and fix any TypeScript errors, missing imports, or Angular compilation issues. Also run `npm run frontend:test` to verify existing tests still pass and write basic tests for the new components if time permits.

---

### Step 23: Manual integration testing

Test the full auth flow end-to-end.

**Prompt:**
> Perform manual integration testing:
> 1. Start the backend (`npm run backend:start:dev`) and frontend (`npm run frontend:start`)
> 2. Run the seed script to create admin user: `npm run seed:admin`
> 3. Test login with admin credentials
> 4. Test creating an invite via admin panel
> 5. Test registration with the invite link
> 6. Test that chat still works with authenticated users
> 7. Test that unauthenticated requests to `/api/chat` return 401
> 8. Test role-based access: non-admin can't access `/api/users`
> 9. Test logout and redirect to login

---

## Summary

| Step | Area | Description |
|------|------|-------------|
| 1 | Backend | Common decorators (@Roles, @Public) |
| 2 | Backend | Auth module (service, controller, strategies) |
| 3 | Backend | Guards (JWT, Roles, Local) |
| 4 | Backend | Users module (user + invite management) |
| 5 | Backend | Register auth globally in AppModule |
| 6 | Backend | @CurrentUser decorator and RequestUser type |
| 7 | Backend | Protect chat endpoint |
| 8 | Scripts | Admin seed script |
| 9 | Tests | Auth service unit tests |
| 10 | Tests | Guard unit tests |
| 11 | Tests | Users service unit tests |
| 12 | Frontend | Core auth service + models |
| 13 | Frontend | HTTP interceptor for JWT |
| 14 | Frontend | Route guards (auth + role) |
| 15 | Frontend | Login page |
| 16 | Frontend | Register page |
| 17 | Frontend | Admin page (users + invites) |
| 18 | Frontend | Update routing with guards |
| 19 | Frontend | Auth token in chat SSE |
| 20 | Frontend | Navigation bar with auth state |
| 21 | Tests | Backend test run + fixes |
| 22 | Tests | Frontend build + test + fixes |
| 23 | Testing | Manual integration testing |
