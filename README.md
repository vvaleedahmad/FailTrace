# FailTrace

FailTrace is a TypeScript API and static control-center frontend for logging API failures, tracking request traces, and replaying failed requests through synchronous or queue-backed workflows.

## Requirements

- Node.js 22+
- npm
- Docker, if you want to run the API container
- A Supabase Postgres project

## Environment

Copy `apps/api-server/.env.example` to `apps/api-server/.env` and fill in:

- `DATABASE_URL`: Supabase pooled/runtime connection, usually port `6543` with `?pgbouncer=true`.
- `DIRECT_URL`: Supabase direct/session connection for Prisma migrations, usually port `5432`.
- `ADMIN_EMAIL`: Admin login email. When set with `ADMIN_PASSWORD`, the API bootstraps or updates that admin user on startup.
- `ADMIN_PASSWORD`: Admin login password used to create/update the configured admin user.
- `JWT_SECRET`: Secret used to sign admin auth tokens. Defaults to a development-only value if omitted.
- `JWT_EXPIRES_IN`: Admin token lifetime, default `1h`.
- `REPLAY_BASE_URL`: Base URL used for replay requests when a replay call does not provide `targetBaseUrl`.
- `REDIS_URL`: Redis connection string used by BullMQ replay jobs, default `redis://127.0.0.1:6379`.
- `REPLAY_QUEUE_ENABLED`: Set to `true` to enable queue-backed replay endpoints and workers.
- `REPLAY_WORKER_CONCURRENCY`: Number of replay jobs each worker process handles at the same time, default `5`.
- `REPLAY_SYNC_CONCURRENCY`: Number of replay requests handled concurrently by the existing synchronous batch endpoint, default `5`.
- `REPLAY_JOB_ATTEMPTS`: Number of BullMQ retry attempts per queued replay job, default `3`.
- `REPLAY_JOB_BACKOFF_MS`: Initial exponential backoff delay for queued replay retries, default `5000`.
- `REPLAY_JOB_MAX_STALLED_COUNT`: Number of stalled recoveries allowed before BullMQ marks a job failed, default `3`.
- `REPLAY_JOB_STALLED_INTERVAL_MS`: Worker stalled-job check interval, default `30000`.

Do not include placeholder wrapper characters around the password. For example, use `my-password`, not `[my-password]`.

## Traceability

Every request receives a shared trace identifier in the `x-failtrace-trace-id` response header. Clients can pass `x-failtrace-trace-id` or `x-request-id` to reuse an existing identifier; otherwise the API generates one.

The same `traceId` is stored on API logs, failure logs, replay jobs, replay results, and analytics records. Logs and analytics can be filtered with `traceId`.

## Commands

```bash
npm install
npm run dev
npm run dev:worker --workspace apps/api-server
npm run build
npm run start
npm run start:worker --workspace apps/api-server
npm run prisma:generate
npm run prisma:migrate
```

The API listens on `PORT` from `apps/api-server/.env`, defaulting to `4000`.

## Frontend

The frontend lives in `apps/frontend` and is a static browser app generated from the FailTrace Control Center Stitch screens.

```text
apps/frontend/
  index.html
  styles/app.css
  scripts/data.js
  scripts/app.js
  assets/images/
```

Open `apps/frontend/index.html` directly in a browser to view the control center. The UI is intentionally dependency-free so it can be inspected without a build step.

## Docker

```bash
docker compose up --build
```

The compose stack starts Redis, the API, and two replay worker replicas. It loads `apps/api-server/.env` and exposes the API on `http://localhost:4000`.

Replay workers use BullMQ locks/stalled-job recovery and Docker restart policies. If one worker process or container fails, another worker can continue processing queued jobs, and stalled jobs are returned to the queue for retry.

Override replay worker scale with:

```bash
docker compose up --build --scale replay-worker=3
```

The existing replay endpoints remain synchronous:

- `POST /api/replays`
- `POST /api/replays/:failureId`

Queue-backed endpoints are available when `REPLAY_QUEUE_ENABLED=true`:

- `POST /api/replays/queue`
- `POST /api/replays/queue/:failureId`
- `GET /api/replays/queue`
- `GET /api/replays/queue/jobs?state=failed&limit=25`
- `GET /api/replays/queue/:jobId`
- `POST /api/replays/queue/:jobId/retry`
- `POST /api/replays/queue/retry-failed`

Failed queue jobs are retained in Redis until they are explicitly retried or removed, so exhausted jobs remain inspectable and recoverable.
Queued replay dispatch uses ID-only database selection and BullMQ bulk inserts so API requests avoid loading full failure payloads before enqueueing.
