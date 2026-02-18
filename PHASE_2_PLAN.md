# Phase 2: Core Chatbot (RAW Mode) — Implementation Plan

## Overview

Build a working RAG-powered chat UI that answers Pathfinder 2e rules questions. The user sends a question, the backend embeds it, searches pgvector for relevant rule chunks, composes a prompt with the system instructions + retrieved context + conversation history, calls Azure OpenAI GPT-4o via LangChain.js, and streams the response back via SSE.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| RAG orchestration | **LangChain.js** | Already installed, cleaner pipeline code, built-in streaming and prompt templates |
| Conversation history | **Frontend-only** | Stored in Angular state, sent with each request. No DB tables needed until Phase 3 (auth) |
| Markdown rendering | **ngx-markdown** | Most popular Angular markdown library, GFM support, syntax highlighting |
| Streaming | **SSE via POST** | Standard chat API pattern. NestJS returns an Observable/stream from a POST endpoint |
| Auth | **None (Phase 3)** | Chat endpoint is open/unprotected for Phase 2. Auth guards added in Phase 3 |

## Prerequisites

- PostgreSQL running locally with pgvector (Docker Compose — already set up)
- Rule chunks ingested into the database (Phase 1 — completed)
- Azure OpenAI resource with GPT-4o and text-embedding-3-small deployments
- `.env` file configured with Azure OpenAI credentials

---

## Step-by-Step Implementation

### Step 1: PrismaModule — Shared Database Access

**Goal**: Create a reusable NestJS module that provides the Prisma client to all other modules via dependency injection.

**Files to create**:
- `apps/backend/src/prisma/prisma.service.ts` — extends PrismaClient, implements OnModuleInit/OnModuleDestroy lifecycle hooks
- `apps/backend/src/prisma/prisma.module.ts` — global module that exports PrismaService

**Files to modify**:
- `apps/backend/src/app.module.ts` — import PrismaModule

**Also run**: `npm run backend:prisma:generate` to generate the Prisma client before starting.

**Prompt suggestion**:
> Create a PrismaModule for the NestJS backend. First run `npm run backend:prisma:generate` to generate the Prisma client. Then create `apps/backend/src/prisma/prisma.service.ts` that extends PrismaClient with OnModuleInit (calls `$connect()`) and OnModuleDestroy (calls `$disconnect()`). Create `apps/backend/src/prisma/prisma.module.ts` as a global module that provides and exports PrismaService. Register PrismaModule in AppModule. The generated client is imported from `../../generated/prisma`. Follow existing code conventions.

---

### Step 2: Embedding Service

**Goal**: Create a service that generates vector embeddings for user queries using Azure OpenAI via LangChain.js.

**Files to create**:
- `apps/backend/src/chat/services/embedding.service.ts` — wraps `@langchain/openai` AzureOpenAIEmbeddings

**Details**:
- Use `AzureOpenAIEmbeddings` from `@langchain/openai`
- Configure from environment variables via NestJS `ConfigService`:
  - `AZURE_OPENAI_API_KEY`
  - `AZURE_OPENAI_ENDPOINT`
  - `AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME`
- Expose method: `embedQuery(text: string): Promise<number[]>`
- Embedding dimensions: 1536 (matching ingestion config)

**Prompt suggestion**:
> Create an EmbeddingService at `apps/backend/src/chat/services/embedding.service.ts`. Use `AzureOpenAIEmbeddings` from `@langchain/openai`. Inject NestJS ConfigService to read `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, and `AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME` env vars. Initialize the embeddings client in `onModuleInit`. Expose a single method `embedQuery(text: string): Promise<number[]>`. Use 1536 dimensions and API version `2024-11-20`. Reference `scripts/src/embedder.ts` for the existing embedding pattern used during ingestion.

---

### Step 3: Vector Search Service

**Goal**: Create a service that performs cosine similarity search against the `rule_chunks` table using pgvector.

**Files to create**:
- `apps/backend/src/chat/services/vector-search.service.ts`

**Details**:
- Inject PrismaService
- Use `prisma.$queryRawUnsafe()` for pgvector queries (Prisma doesn't support pgvector natively)
- Method: `searchRuleChunks(embedding: number[], topK?: number, similarityThreshold?: number): Promise<RuleChunkResult[]>`
- Return fields: id, title, category, source, content, similarity score
- Default topK: 8, default similarity threshold: 0.3 (filter out low-relevance results)
- Use cosine distance operator `<=>` (matching the HNSW index)

**Reference**: The existing search implementation is at `scripts/src/db-writer.ts:searchChunks()` — adapt that pattern for Prisma raw queries.

**Prompt suggestion**:
> Create a VectorSearchService at `apps/backend/src/chat/services/vector-search.service.ts`. Inject PrismaService. Implement `searchRuleChunks(embedding: number[], topK = 8, similarityThreshold = 0.3)` that runs a raw SQL query against the `rule_chunks` table using pgvector cosine distance (`<=>`). Return id, title, category, source, content, and similarity score. Filter out results below the similarity threshold. Reference the existing search pattern in `scripts/src/db-writer.ts:searchChunks()` but use `prisma.$queryRawUnsafe()` instead of the pg driver. Create a TypeScript interface for the return type.

---

### Step 4: Chat DTOs and Types

**Goal**: Define the request/response types for the chat endpoint.

**Files to create**:
- `apps/backend/src/chat/dto/chat-request.dto.ts`
- `apps/backend/src/chat/types/chat.types.ts`

**ChatRequestDto**:
```typescript
{
  message: string;              // The user's current question (required, non-empty)
  conversationHistory?: {       // Previous messages for context (optional)
    role: 'user' | 'assistant';
    content: string;
  }[];
}
```

**SSE Event types**:
```typescript
// Individual SSE events sent during streaming:
{ type: 'token', content: string }        // A text token from the LLM
{ type: 'sources', sources: RuleSource[] } // Retrieved rule sources used
{ type: 'done' }                           // Stream complete
{ type: 'error', message: string }         // Error occurred
```

**Prompt suggestion**:
> Create the chat DTOs and types. Create `apps/backend/src/chat/dto/chat-request.dto.ts` with a ChatRequestDto class validated with class-validator: `message` (string, required, IsNotEmpty) and `conversationHistory` (optional array of `{ role: 'user' | 'assistant', content: string }`). Use class-validator decorators (IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsEnum). Create `apps/backend/src/chat/types/chat.types.ts` with interfaces for SSE event types (TokenEvent, SourcesEvent, DoneEvent, ErrorEvent) and a RuleSource interface (title, category, source, similarity). Follow the project's existing TypeScript conventions.

---

### Step 5: RAG Chat Service

**Goal**: Create the core chat service that orchestrates the full RAG pipeline: embed query → search → compose prompt → call LLM → stream tokens.

**Files to create**:
- `apps/backend/src/chat/services/chat.service.ts`

**Details**:
- Inject EmbeddingService, VectorSearchService, ConfigService
- Use `ChatOpenAI` from `@langchain/openai` for the Azure OpenAI GPT-4o LLM
- Main method: `chat(message, conversationHistory)` returns an RxJS `Observable` that emits SSE events
- Pipeline:
  1. Embed the user's query via EmbeddingService
  2. Search for relevant rule chunks via VectorSearchService
  3. Compose the full prompt:
     - System prompt (from `docs/prompts/chat-system-prompt.md` or hardcoded constant)
     - Retrieved context formatted as: `[Official] Title: X\nSource: Y\nContent: Z\n\n`
     - Conversation history (previous messages)
     - Current user message
  4. Call Azure OpenAI GPT-4o with streaming enabled
  5. Emit SSE events: first `sources` event with retrieved chunks metadata, then `token` events for each streamed token, finally `done` event
- Error handling: catch errors and emit an `error` event

**Prompt suggestion**:
> Create the ChatService at `apps/backend/src/chat/services/chat.service.ts`. Inject EmbeddingService, VectorSearchService, and ConfigService. Use `AzureChatOpenAI` from `@langchain/openai` for the LLM (configured from env vars: `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT_NAME`). Implement a `chat(message: string, conversationHistory: ConversationMessage[])` method that returns an RxJS Observable emitting SSE events. The pipeline: (1) embed the query, (2) search rule_chunks for top-8 matches, (3) compose the prompt using the system prompt from `docs/prompts/chat-system-prompt.md` + formatted context chunks + conversation history + user message, (4) stream the LLM response emitting token/sources/done/error events. Use LangChain's streaming with `stream()` method. Read the system prompt file at startup. Format retrieved chunks as `[Official] Title: {title}\nCategory: {category}\nSource: {source}\nContent: {content}\n\n`. Reference the types from chat.types.ts.

---

### Step 6: Chat Controller with SSE Streaming

**Goal**: Create the HTTP endpoint that accepts chat requests and returns a streaming SSE response.

**Files to create**:
- `apps/backend/src/chat/chat.controller.ts`

**Details**:
- `POST /api/chat` endpoint
- Accepts `ChatRequestDto` in the request body
- Returns an `Observable` with `Content-Type: text/event-stream`
- NestJS SSE pattern: use `@Sse()` is for GET only; for POST with SSE, return the Observable directly and set response headers manually, or use `@Header('Content-Type', 'text/event-stream')` with `@Header('Cache-Control', 'no-cache')` and `@Header('Connection', 'keep-alive')`
- Each emitted event is formatted as `data: {json}\n\n`

**Prompt suggestion**:
> Create the ChatController at `apps/backend/src/chat/chat.controller.ts`. Create a `POST /chat` endpoint (remember the /api prefix is set globally) that accepts ChatRequestDto. It should return an SSE stream. Set response headers: Content-Type `text/event-stream`, Cache-Control `no-cache`, Connection `keep-alive`. Use the NestJS approach of returning an RxJS Observable<MessageEvent> where each event contains the JSON-stringified SSE data from ChatService. Use the `@Sse()` pattern or manual Observable return. Map the ChatService observable events into proper SSE MessageEvent format. Handle the observable completion properly.

---

### Step 7: Chat Module & App Registration

**Goal**: Wire all chat services together into a NestJS module and register it in AppModule.

**Files to create**:
- `apps/backend/src/chat/chat.module.ts`

**Files to modify**:
- `apps/backend/src/app.module.ts` — import ChatModule

**Details**:
- ChatModule imports PrismaModule (if not global)
- ChatModule provides: EmbeddingService, VectorSearchService, ChatService
- ChatModule declares: ChatController

**Prompt suggestion**:
> Create the ChatModule at `apps/backend/src/chat/chat.module.ts`. It should provide EmbeddingService, VectorSearchService, and ChatService, and declare ChatController. Import any needed modules. Register ChatModule in AppModule (`apps/backend/src/app.module.ts`). Verify the backend compiles successfully by running `npm run backend:build`.

---

### Step 8: Backend Manual Testing

**Goal**: Verify the backend chat endpoint works correctly before building the frontend.

**Details**:
- Start the backend: `npm run backend:start`
- Test with curl or a REST client:
  ```bash
  curl -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d '{"message": "How does flanking work in Pathfinder 2e?"}' \
    --no-buffer
  ```
- Verify: SSE events stream in, sources are relevant, LLM response is accurate
- Test with conversation history
- Test with edge cases: empty message (should fail validation), unknown topic

**Prompt suggestion**:
> Start the backend server and test the POST /api/chat endpoint. Send a test request with the message "How does flanking work in Pathfinder 2e?" and verify we get streaming SSE events back. Check that: (1) the sources event contains relevant rule chunks, (2) token events stream in progressively, (3) the final response accurately describes flanking rules, (4) the done event fires. Also test with conversation history and verify validation rejects empty messages. Fix any issues found.

---

### Step 9: Frontend — Chat API Service

**Goal**: Create an Angular service that communicates with the backend chat endpoint and handles SSE stream parsing.

**Files to create**:
- `apps/frontend/src/app/features/chat/services/chat-api.service.ts`

**Details**:
- Use the `fetch()` API with `ReadableStream` for SSE parsing (Angular's HttpClient doesn't natively support SSE from POST)
- Method: `sendMessage(message, conversationHistory): Observable<ChatEvent>`
- Parse the SSE stream: split on `\n\n`, extract `data:` lines, parse JSON
- Emit typed events (token, sources, done, error) as an RxJS Observable
- Use environment.apiUrl for the base URL
- Handle connection errors and timeouts

**Prompt suggestion**:
> Create a ChatApiService at `apps/frontend/src/app/features/chat/services/chat-api.service.ts`. Use the native `fetch()` API with ReadableStream to handle SSE from a POST request to `${environment.apiUrl}/chat`. Create a `sendMessage(message: string, conversationHistory: ConversationMessage[]): Observable<ChatEvent>` method that parses the SSE stream, extracting `data:` lines and emitting typed ChatEvent objects (token, sources, done, error). Create the necessary TypeScript interfaces in a `chat.types.ts` file in the same features/chat directory. Use the apiUrl from the environment files. Handle network errors gracefully.

---

### Step 10: Frontend — Chat State Store (NgRx Signals)

**Goal**: Create a signal-based store to manage chat state (messages, loading, sources).

**Files to create**:
- `apps/frontend/src/app/features/chat/store/chat.store.ts`

**Details**:
- Use `signalStore` from `@ngrx/signals`
- State shape:
  ```typescript
  {
    messages: ChatMessage[]       // { role: 'user' | 'assistant', content: string }
    currentResponse: string       // Accumulates streaming tokens for the current response
    sources: RuleSource[]         // Sources from the most recent query
    isLoading: boolean            // True while waiting for/streaming response
    error: string | null          // Error message if something goes wrong
  }
  ```
- Methods:
  - `sendMessage(message: string)` — adds user message, calls API, accumulates tokens, finalizes assistant message
  - `clearMessages()` — resets conversation
- Computed signals:
  - `allMessages()` — messages + in-progress currentResponse as a virtual assistant message

**Prompt suggestion**:
> Create a chat store using NgRx Signals at `apps/frontend/src/app/features/chat/store/chat.store.ts`. Use `signalStore` with `withState`, `withComputed`, and `withMethods`. State: messages (ChatMessage[]), currentResponse (string), sources (RuleSource[]), isLoading (boolean), error (string | null). Add a computed `allMessages` signal that returns messages plus the in-progress response. Implement `sendMessage` method that: adds the user message to state, sets loading, calls ChatApiService, accumulates token events into currentResponse, captures sources, and on done finalizes the currentResponse into a full assistant message. Implement `clearMessages`. Inject ChatApiService using the inject() function inside withMethods. Use the types from the chat types file.

---

### Step 11: Frontend — Chat Components

**Goal**: Build the chat UI with a message list and input field using Angular Material.

**Files to create**:
- `apps/frontend/src/app/features/chat/chat-page.component.ts` — container component (page-level, routed)
- `apps/frontend/src/app/features/chat/components/message-list.component.ts` — scrollable message list
- `apps/frontend/src/app/features/chat/components/message-bubble.component.ts` — individual message rendering
- `apps/frontend/src/app/features/chat/components/chat-input.component.ts` — input field + send button
- SCSS files for each component

**Details**:
- **ChatPageComponent**: injects ChatStore, contains the layout (message list + input + sources panel)
- **MessageListComponent**: receives messages signal, renders MessageBubble for each, auto-scrolls to bottom on new messages
- **MessageBubbleComponent**: renders user messages as plain text, assistant messages as markdown (placeholder — markdown added in Step 13). Visually distinguishes user vs assistant messages (different alignment/colors)
- **ChatInputComponent**: Material text field + send button, emits message on submit (Enter key or button click), disabled while loading
- Use Angular Material components: `mat-card`, `mat-form-field`, `mat-input`, `mat-button`, `mat-icon`, `mat-progress-bar`
- All components are standalone

**Prompt suggestion**:
> Create the chat UI components at `apps/frontend/src/app/features/chat/`. Create ChatPageComponent as the routed page that injects ChatStore and lays out the chat interface. Create MessageListComponent that receives messages via input signal and renders MessageBubbleComponent for each message, with auto-scroll to bottom. Create MessageBubbleComponent that displays a single message with visual distinction between user (right-aligned, primary color) and assistant (left-aligned, lighter background) messages. Create ChatInputComponent with a Material text field and send icon button that emits a messageSubmitted event on Enter or button click, disabled while loading. Use Angular Material components (mat-card, mat-form-field, mat-input, mat-icon-button, mat-icon, mat-progress-bar for loading state). All components should be standalone. Add appropriate SCSS styling for a clean chat interface. Keep assistant message rendering as plain text for now — markdown support is added in Step 13.

---

### Step 12: Frontend — Routing

**Goal**: Add the chat route and make it the default landing page.

**Files to modify**:
- `apps/frontend/src/app/app.routes.ts` — add chat route with lazy loading

**Details**:
- Route `/chat` → lazy-load ChatPageComponent
- Default route `/` → redirect to `/chat`
- Wildcard `**` → redirect to `/chat`

**Prompt suggestion**:
> Update `apps/frontend/src/app/app.routes.ts` to add routing for the chat feature. Add a `/chat` route that lazy-loads ChatPageComponent. Add a default route (`''`) that redirects to `/chat`. Add a wildcard route (`**`) that also redirects to `/chat`. Use the `loadComponent` syntax for lazy loading the standalone ChatPageComponent.

---

### Step 13: Frontend — Markdown Rendering

**Goal**: Install and configure `ngx-markdown` to render assistant chat responses as formatted markdown.

**Dependencies to install**:
- `ngx-markdown`
- `marked` (peer dependency of ngx-markdown)

**Files to modify**:
- `apps/frontend/src/app/app.config.ts` — add ngx-markdown provider
- `apps/frontend/src/app/features/chat/components/message-bubble.component.ts` — use `<markdown>` component for assistant messages

**Details**:
- Install: `npm install ngx-markdown marked --workspace=apps/frontend`
- Add `provideMarkdown()` to app.config.ts providers
- In MessageBubbleComponent, render assistant messages with `<markdown [data]="message.content"></markdown>`
- User messages remain plain text
- Style markdown output (tables, code blocks, lists) to fit the chat UI

**Prompt suggestion**:
> Install ngx-markdown and marked in the frontend workspace: `npm install ngx-markdown marked --workspace=apps/frontend`. Add `provideMarkdown()` to the providers in `apps/frontend/src/app/app.config.ts`. Update MessageBubbleComponent to render assistant messages using the `<markdown>` component from ngx-markdown: `<markdown [data]="message.content"></markdown>`. Keep user messages as plain text. Add SCSS styles for the rendered markdown content (tables, code blocks, lists, headings) so they look good within chat bubbles.

---

### Step 14: Frontend — Sources Display

**Goal**: Show the retrieved rule sources used to answer each question.

**Files to create**:
- `apps/frontend/src/app/features/chat/components/sources-panel.component.ts`

**Files to modify**:
- `apps/frontend/src/app/features/chat/chat-page.component.ts` — integrate sources panel

**Details**:
- Collapsible panel below the chat or as a sidebar
- Shows for the most recent assistant response: title, category, source book, similarity score
- Use Material expansion panel or a simple toggle
- Only visible when sources exist

**Prompt suggestion**:
> Create a SourcesPanelComponent at `apps/frontend/src/app/features/chat/components/sources-panel.component.ts`. It receives a sources signal (RuleSource array) and displays the retrieved rule chunks used for the latest response. Show each source's title, category, source book, and similarity score as a percentage. Use a Material expansion panel (`mat-expansion-panel`) that's collapsed by default with a label like "Sources (N rules referenced)". Integrate it into ChatPageComponent below the chat input. Only show the panel when sources are non-empty.

---

### Step 15: End-to-End Testing & Iteration

**Goal**: Verify the full flow works end-to-end. Test with real PF2e questions and iterate on quality.

**Details**:
- Start both backend and frontend: `npm run dev`
- Test the following scenarios:
  1. Basic rules question: "How does flanking work?"
  2. Spell lookup: "What does the fireball spell do?"
  3. Condition query: "Explain the frightened condition"
  4. Multi-turn conversation: ask a follow-up question that references the previous answer
  5. Edge cases: very long question, question about something not in the rules, empty-looking question
- Evaluate:
  - **Retrieval quality**: Are the right rule chunks being found? Is top-K = 8 enough? Is the similarity threshold appropriate?
  - **Response quality**: Is the LLM answering accurately? Is it citing sources? Does it say "I don't know" when appropriate?
  - **Streaming UX**: Do tokens appear progressively? Is the loading state clear?
  - **Markdown rendering**: Do tables, lists, and code blocks render correctly?
- Adjust parameters if needed:
  - Top-K (number of chunks retrieved)
  - Similarity threshold
  - System prompt wording
  - Chunk context formatting

**Prompt suggestion**:
> Start the full application with `npm run dev` and test the chat feature end-to-end. Test with these queries: (1) "How does flanking work?", (2) "What does the fireball spell do?", (3) "Explain the frightened condition", (4) a follow-up question after one of the above. Check that streaming works, sources are relevant, markdown renders properly, and the conversation history provides context for follow-ups. Report any issues found and suggest fixes. If retrieval quality is poor, suggest adjustments to top-K, similarity threshold, or context formatting.

---

### Step 16: Backend Unit Tests

**Goal**: Write unit tests for the chat backend services.

**Files to create**:
- `apps/backend/src/chat/services/embedding.service.spec.ts`
- `apps/backend/src/chat/services/vector-search.service.spec.ts`
- `apps/backend/src/chat/services/chat.service.spec.ts`
- `apps/backend/src/chat/chat.controller.spec.ts`

**Details**:
- Mock Azure OpenAI calls (don't hit real API in tests)
- Mock PrismaService for vector search tests
- Test the RAG pipeline composition (correct prompt assembly)
- Test SSE event formatting
- Test DTO validation (empty message rejected, valid message accepted)

**Prompt suggestion**:
> Write unit tests for the chat module. Create spec files for EmbeddingService, VectorSearchService, ChatService, and ChatController. Mock external dependencies: mock the LangChain AzureOpenAIEmbeddings and AzureChatOpenAI classes, mock PrismaService's $queryRawUnsafe. Test: (1) EmbeddingService calls embeddings API with correct config, (2) VectorSearchService builds correct SQL and returns formatted results, (3) ChatService assembles the prompt correctly with system prompt + context + history + message, (4) ChatController returns proper SSE stream format, (5) DTO validation rejects empty messages. Run tests with `npm run backend:test` and ensure they pass.

---

### Step 17: Frontend Unit Tests

**Goal**: Write unit tests for the chat frontend components and services.

**Files to create**:
- `apps/frontend/src/app/features/chat/services/chat-api.service.spec.ts`
- `apps/frontend/src/app/features/chat/chat-page.component.spec.ts`
- `apps/frontend/src/app/features/chat/components/message-list.component.spec.ts`
- `apps/frontend/src/app/features/chat/components/chat-input.component.spec.ts`

**Details**:
- Test ChatApiService SSE parsing logic with mock responses
- Test component rendering: messages display, input field behavior, loading state
- Test ChatStore state transitions
- Use Jasmine + Karma (Angular's default test framework)

**Prompt suggestion**:
> Write unit tests for the chat frontend feature. Create spec files for ChatApiService (test SSE stream parsing with mock fetch responses), ChatPageComponent (test it renders message list and input), MessageListComponent (test it renders messages correctly), and ChatInputComponent (test it emits messageSubmitted on Enter key and button click, test it disables during loading). Mock ChatApiService in component tests. Run tests with `npm run frontend:test` and ensure they pass.

---

## Architecture Summary

```
┌────────────────────────────────────────────────────────────┐
│                    Angular Frontend                         │
│                                                            │
│  ChatPageComponent                                         │
│  ├── MessageListComponent                                  │
│  │   └── MessageBubbleComponent (× N, with ngx-markdown)   │
│  ├── ChatInputComponent (Material text field + button)     │
│  └── SourcesPanelComponent (collapsible)                   │
│                                                            │
│  ChatStore (NgRx Signals) ←→ ChatApiService (fetch + SSE)  │
└───────────────────────┬────────────────────────────────────┘
                        │ POST /api/chat (SSE stream)
                        ▼
┌────────────────────────────────────────────────────────────┐
│                    NestJS Backend                           │
│                                                            │
│  ChatController (POST /chat → SSE Observable)              │
│  └── ChatService (RAG pipeline orchestrator)               │
│      ├── EmbeddingService (AzureOpenAIEmbeddings)          │
│      ├── VectorSearchService (pgvector raw SQL via Prisma) │
│      └── AzureChatOpenAI (LLM streaming)                   │
│                                                            │
│  PrismaModule (global, shared DB access)                   │
└───────────────────────┬────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────┐
│            PostgreSQL + pgvector                            │
│  rule_chunks table (content + embedding + metadata)        │
│  HNSW index on embedding column (cosine distance)          │
└────────────────────────────────────────────────────────────┘
```

## File Inventory

### New Files (Backend — ~12 files)
| File | Step |
|------|------|
| `src/prisma/prisma.service.ts` | 1 |
| `src/prisma/prisma.module.ts` | 1 |
| `src/chat/services/embedding.service.ts` | 2 |
| `src/chat/services/vector-search.service.ts` | 3 |
| `src/chat/dto/chat-request.dto.ts` | 4 |
| `src/chat/types/chat.types.ts` | 4 |
| `src/chat/services/chat.service.ts` | 5 |
| `src/chat/chat.controller.ts` | 6 |
| `src/chat/chat.module.ts` | 7 |
| `src/chat/services/*.spec.ts` (3 files) | 16 |
| `src/chat/chat.controller.spec.ts` | 16 |

### New Files (Frontend — ~10 files)
| File | Step |
|------|------|
| `features/chat/services/chat-api.service.ts` | 9 |
| `features/chat/types/chat.types.ts` | 9 |
| `features/chat/store/chat.store.ts` | 10 |
| `features/chat/chat-page.component.ts` + `.scss` | 11 |
| `features/chat/components/message-list.component.ts` + `.scss` | 11 |
| `features/chat/components/message-bubble.component.ts` + `.scss` | 11 |
| `features/chat/components/chat-input.component.ts` + `.scss` | 11 |
| `features/chat/components/sources-panel.component.ts` + `.scss` | 14 |
| `features/chat/services/chat-api.service.spec.ts` | 17 |
| `features/chat/components/*.spec.ts` (3 files) | 17 |

### Modified Files
| File | Step |
|------|------|
| `apps/backend/src/app.module.ts` | 1, 7 |
| `apps/frontend/src/app/app.routes.ts` | 12 |
| `apps/frontend/src/app/app.config.ts` | 13 |

### Dependencies to Install
| Package | Workspace | Step |
|---------|-----------|------|
| `ngx-markdown` | frontend | 13 |
| `marked` | frontend | 13 |

## Estimated Effort

| Steps | Area | Description |
|-------|------|-------------|
| 1 | Backend | PrismaModule (shared infra) |
| 2–7 | Backend | Chat module with RAG pipeline (~6 prompts) |
| 8 | Backend | Manual testing & debugging |
| 9–14 | Frontend | Chat UI with streaming + markdown (~6 prompts) |
| 15 | Full stack | E2E testing & iteration |
| 16–17 | Testing | Unit tests backend + frontend |

Total: **17 steps**, each designed to be completable in a single prompt.
