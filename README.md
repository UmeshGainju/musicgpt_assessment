# MusicGPT — Scalable Backend Architecture

A production-ready NestJS backend for AI music generation with JWT authentication, tiered subscriptions, background job processing, real-time notifications, and comprehensive search.

## Architecture Overview

```
┌────────────┐     ┌──────────┐     ┌───────────────┐
│   Client   │────▶│  API     │────▶│  PostgreSQL   │
│            │◀────│  Server  │◀────│               │
└────────────┘     └────┬─────┘     └───────────────┘
      ▲  WebSocket      │
      │  (Socket.IO)    │ BullMQ
      │                 ▼
      │           ┌──────────┐     ┌───────────────┐
      └───────────│  Worker  │────▶│    Redis       │
                  │  Process │◀────│  (Cache/Queue/ │
                  └──────────┘     │   Pub-Sub)     │
                                   └───────────────┘
```

### Key Design Decisions

- **NestJS Modular Pattern**: Each feature lives under `src/modules/<feature>/` with flat file layout (`dto/`, `entities/`, `interfaces/` subdirectories) following the standard NestJS convention
- **Separate Worker Process**: Job processing runs in its own container (`docker-compose.yml` → `worker` service), sharing the same codebase but only loading `WorkerModule`
- **Cursor-Based Pagination**: All list endpoints use cursor pagination for consistent performance at scale
- **Redis Sliding Window Rate Limiting**: Token-bucket alternative using sorted sets; FREE: 20 req/min, PAID: 100 req/min
- **Search with Weighted Scoring**: Exact match (100), starts-with (50), contains (10) with base64-encoded score cursors
- **Token Rotation with Reuse Detection**: Refresh tokens are SHA-256 hashed, rotated on use, and reuse triggers full revocation

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | NestJS 10 |
| Language | TypeScript 5.1 (strict mode) |
| Database | PostgreSQL 16 + Prisma 5 |
| Cache/Queue | Redis 7 + ioredis |
| Job Queue | BullMQ |
| WebSocket | Socket.IO + Redis adapter |
| Auth | JWT (access + refresh) + Passport |
| Cron | @nestjs/schedule |
| Docs | Swagger (OpenAPI 3.0) |
| Container | Docker + docker-compose |
| CI | GitHub Actions |

## Project Structure

```
src/
├── modules/
│   ├── auth/                       # JWT authentication
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts         # Register, login, refresh, logout
│   │   ├── auth.service.spec.ts
│   │   ├── jwt.strategy.ts         # Passport JWT strategy
│   │   ├── refresh-token.repository.ts
│   │   ├── dto/                    # LoginDto, RegisterDto, RefreshDto
│   │   └── interfaces/             # JwtPayload, TokenPair, AuthenticatedUser
│   ├── user/                       # User CRUD (Redis cached)
│   │   ├── user.module.ts
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   ├── user.repository.ts      # Prisma implementation
│   │   ├── dto/                    # UpdateUserDto
│   │   ├── entities/               # UserEntity
│   │   └── interfaces/             # IUserRepository
│   ├── subscription/               # Subscription management
│   │   ├── subscription.module.ts
│   │   ├── subscription.controller.ts
│   │   ├── subscription.service.ts
│   │   └── subscription.service.spec.ts
│   ├── prompt/                     # Prompt CRUD + pending scanner
│   │   ├── prompt.module.ts
│   │   ├── prompt.controller.ts
│   │   ├── prompt.service.ts       # Redis cached
│   │   ├── prompt.repository.ts    # Includes findPending
│   │   ├── dto/                    # CreatePromptDto
│   │   ├── entities/               # PromptEntity
│   │   └── interfaces/             # IPromptRepository
│   ├── audio/                      # Audio CRUD (created by worker)
│   │   ├── audio.module.ts
│   │   ├── audio.controller.ts
│   │   ├── audio.service.ts        # Redis cached
│   │   ├── audio.repository.ts
│   │   ├── dto/                    # UpdateAudioDto
│   │   ├── entities/               # AudioEntity
│   │   └── interfaces/             # IAudioRepository
│   ├── search/                     # Global search (users + audio)
│   │   ├── search.module.ts
│   │   ├── search.controller.ts
│   │   ├── search.service.ts       # Weighted scoring
│   │   ├── search.service.spec.ts
│   │   └── dto/                    # SearchQueryDto
│   ├── queue/                      # BullMQ producer + processor
│   │   ├── queue.module.ts
│   │   ├── prompt.producer.ts      # Enqueues jobs with priority
│   │   ├── prompt.processor.ts     # Processes jobs (simulated AI)
│   │   └── prompt.processor.spec.ts
│   ├── scheduler/                  # Cron job to poll pending prompts
│   │   ├── scheduler.module.ts
│   │   └── prompt.scheduler.ts     # @Cron every 10s, batch 50
│   └── websocket/                  # Real-time notifications
│       ├── websocket.module.ts
│       └── notification.gateway.ts # Socket.IO + Redis pub/sub
├── worker/                         # Separate worker entrypoint
│   ├── worker.ts                   # Standalone NestJS context
│   └── worker.module.ts
├── infrastructure/                 # Cross-cutting infrastructure (global)
│   ├── prisma/                     # PrismaService, PrismaModule
│   └── redis/                      # RedisService, RedisModule
├── common/                         # Shared utilities
│   ├── decorators/                 # @CurrentUser, @Public
│   ├── guards/                     # JwtAuthGuard, RateLimitGuard
│   ├── filters/                    # AllExceptionsFilter
│   ├── dto/                        # CursorPaginationDto
│   └── interfaces/                 # Pagination interfaces
├── env.validation.ts               # Environment variable validation
├── app.module.ts                   # Root module (API server)
├── app.controller.ts               # Health check endpoint
└── main.ts                         # Bootstrap (Swagger, CORS, pipes)
```

## Getting Started

### Prerequisites

- Node.js ≥ 20.x
- pnpm ≥ 9.x
- PostgreSQL 16
- Redis 7

### Local Development

```bash
# 1. Clone and install
git clone <repo-url>
cd musicgpt_assignment
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your database and Redis URLs

# 3. Generate Prisma client & run migrations
pnpm exec prisma generate
pnpm exec prisma migrate dev

# 4. Start API server
pnpm start:dev

# 5. Start worker (separate terminal)
pnpm start:worker
```

### Docker (Recommended)

```bash
# Start everything: API + Worker + PostgreSQL + Redis
docker-compose up --build

# API available at http://localhost:3000
# Swagger docs at http://localhost:3000/api/docs
```

## API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | Public | Register new user |
| POST | `/auth/login` | Public | Login, returns token pair |
| POST | `/auth/refresh` | Public | Refresh access token |
| POST | `/auth/logout` | Bearer | Revoke all refresh tokens |

### Users
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/me` | Bearer | Get current user profile |
| PUT | `/users/me` | Bearer | Update display name |
| GET | `/users` | Bearer | List users (cursor paginated) |

### Subscriptions
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/subscription/subscribe` | Bearer | Upgrade to PAID |
| POST | `/subscription/cancel` | Bearer | Downgrade to FREE |

### Prompts
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/prompts` | Bearer | Submit prompt (→ PENDING) |
| GET | `/prompts` | Bearer | List my prompts (paginated) |

### Audio
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/audio` | Bearer | List my audio (paginated) |
| GET | `/audio/:id` | Bearer | Get single audio |
| PUT | `/audio/:id` | Bearer | Update audio title |
| DELETE | `/audio/:id` | Bearer | Delete audio |

### Search
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/search?q=<query>` | Bearer | Search users & audio |

### Health
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | Public | Health check |

## Generation Pipeline Flow

```
1. User POST /prompts → creates Prompt (status: PENDING)
2. Cron job (every 10s) scans PENDING prompts, batch of 50
3. Sets to PROCESSING and enqueues via BullMQ (PAID priority=1, FREE priority=10)
4. Worker picks up job:
   a. Simulates AI processing (PAID: 2s, FREE: 5s)
   b. Creates Audio entry in DB
   c. Sets Prompt status → COMPLETED
   d. Publishes Redis notification
5. WebSocket gateway relays "prompt:completed" event to user's room
```

## WebSocket

Connect to `/notifications` namespace with JWT token:

```javascript
const socket = io('http://localhost:3000/notifications', {
  auth: { token: 'your-jwt-access-token' },
});

socket.on('prompt:completed', (data) => {
  console.log('Audio ready:', data);
  // { promptId, audioId, title, url }
});
```

## Rate Limiting

| Tier | Limit | Window |
|------|-------|--------|
| FREE | 20 requests | 60 seconds |
| PAID | 100 requests | 60 seconds |

Implemented with Redis sorted set sliding window. Returns `429 Too Many Requests` with `Retry-After` header when exceeded.

## Running Tests

```bash
# Unit tests
pnpm test

# Unit tests with coverage
pnpm test:cov

# E2E tests (requires running PostgreSQL + Redis)
pnpm test:e2e
```

## Swagger Documentation

Available at `http://localhost:3000/api/docs` when the server is running.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `JWT_SECRET` | — | Secret for signing JWTs |
| `JWT_ACCESS_EXPIRY` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRY` | `30d` | Refresh token TTL |
| `PORT` | `3000` | API server port |
| `NODE_ENV` | `development` | Environment |

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on push/PR to `main`:
1. Spins up PostgreSQL + Redis services
2. Installs dependencies, generates Prisma client
3. Runs migrations, lint, unit tests, and E2E tests
4. Builds Docker image to verify Dockerfile

## Authentication Flow & Token Invalidation Strategy

### Overview

The system implements a **JWT Access + Refresh Token** flow with **token rotation** and **reuse detection**.

### Token Lifecycle

```
Login/Register:
  1. Validate credentials
  2. Issue JWT access token with { sub, email, subscription_status }
  3. Issue refresh token (stored as SHA-256 hash in DB)
  4. Return { access_token, refresh_token }

Authenticated Request:
  1. Passport extracts & verifies JWT signature + expiry
  2. Request proceeds to route handler

Token Refresh:
  1. Client sends { refresh_token }
  2. Validate refresh token in DB (not revoked, not expired)
  3. Revoke old refresh token (rotation)
  4. Issue new JWT + refresh token
  5. Return { access_token, refresh_token }

Logout:
  1. Revoke all refresh tokens for user in DB
  2. Client discards stored tokens
```

### Token Reuse Detection

If a previously-revoked refresh token is used (indicating potential theft):
1. All refresh tokens for the user are revoked (DB)
2. The attacker and legitimate user are both forced to re-authenticate

### Security Properties

| Property | Mechanism |
|----------|----------|
| Token rotation | Each refresh issues a new refresh token, old one revoked |
| Reuse detection | Revoked refresh token usage → full user token wipe |
| Short-lived access | Access token TTL = 15 minutes |
| Hashed storage | Refresh tokens stored as SHA-256 hashes in DB |

### Suggested Improvement: Redis Session-Based Invalidation

A known shortcoming of stateless JWT access tokens is that they **cannot be revoked before expiry**. If a user logs out, their access token remains valid for its remaining TTL (up to 15 minutes).

This can be addressed by adding a **`session_id`** claim to the JWT and validating it against Redis on every request:

1. **On login/register**: Create a session in Redis (`SET session:{uuid} userId EX <ttl>`) and embed the `session_id` in the JWT payload
2. **On every authenticated request**: The auth guard checks Redis (`GET session:{session_id}`) to verify the session still exists and matches the user
3. **On logout**: Delete the session from Redis → **all access tokens for that session are immediately invalid**
4. **On token refresh**: Validate the session before issuing new tokens; reuse the same `session_id` to maintain continuity

This turns stateless JWTs into **revocable tokens** with minimal overhead (one Redis `GET` per request). The session TTL should match the refresh token lifetime. A `session.service.ts` can manage session CRUD, and the `JwtAuthGuard` can be extended to include the Redis lookup after passport validation.

### Suggested Improvement: Offset Pagination for Search

The search endpoint currently uses cursor-based pagination with base64-encoded score cursors. While cursor pagination excels for sequential list traversal (feeds, timelines), it offers **no benefit for search results** because:

- Search results are scored and ranked dynamically — there is no stable row order to cursor through
- Users typically want to jump to a specific page (e.g., page 3 of results), which cursor pagination doesn't support
- The base64 score cursor adds complexity without the performance gains cursors provide on indexed columns

A simpler **offset-based pagination** (`?page=1&limit=20`) would be more appropriate for the search endpoint, while keeping cursor pagination for the other list endpoints (`/users`, `/prompts`, `/audio`) where it provides real benefits on large, append-heavy datasets.
