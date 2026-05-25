# Aurafit — Azure & third‑party setup

Follow this in order. All secrets live in `.env.local` (copy from [`.env.example`](./.env.example)).

## 1. Azure resource group

1. [Azure Portal](https://portal.azure.com) → **Resource groups** → **Create**
2. Name: `aurafit-rg`  
3. Region: closest to your users (e.g. **Southeast Asia**)

## 2. Azure Database for PostgreSQL Flexible Server

1. **Create a resource** → **Azure Database for PostgreSQL**
2. **Flexible server**, PostgreSQL **16** if available
3. Workload: **Development** or **Production** (Burstable **B1ms** is fine for dev and uses credits)
4. Admin user + strong password
5. Networking: allow **Azure services** and your **dev IP** (or Vercel static egress if you lock it down later)
6. After creation:
   - **Server parameters** → set `azure.extensions` to include **`VECTOR`** (enables **pgvector**), or run in Query Editor:

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

7. Create database `aurafit` (or use default `postgres` for dev)
8. Copy **connection string** → `DATABASE_URL` in `.env.local` (add `?sslmode=require`)

Then from the repo root:

```bash
npx prisma migrate dev --name init
# or during early prototyping:
npx prisma db push
```

## 3. Azure Storage (Blob)

1. **Storage account** → Performance **Standard**, redundancy **LRS**
2. **Containers**: `wardrobes`, `outfits`, `profiles`
3. **Access keys** → connection string → `AZURE_STORAGE_*` in `.env.local`

Optional: **Azure Front Door + CDN** in front of a public container or signed URLs only (recommended: **private containers + SAS** — the app uploads server-side and can issue short SAS for reads).

## 4. Azure Service Bus (queues)

1. **Create Service Bus** namespace (Standard or Premium)
2. Queues: `aurafit-analysis`, `aurafit-generation`, `aurafit-products` (names must match `.env.example` or update env)
3. **Shared access policies** → copy **RootManageSharedAccessKey** connection string → `AZURE_SERVICE_BUS_CONNECTION_STRING`

Worker logic: see `azure/functions` (deploy as Azure Functions triggered by Service Bus).

## 5. Azure Cache for Redis

1. Create **Azure Cache for Redis** (TLS required → URL uses `rediss://`)
2. Copy host + access key → `REDIS_URL=rediss://:KEY@HOST:6380`

Used for rate limiting (`src/lib/redis.ts`). If `REDIS_URL` is unset, rate limiting no-ops in dev.

## 6. Azure OpenAI

1. Create **Azure OpenAI** resource (region with quota, e.g. **East US**)
2. **Model deployments**:
   - Chat: **gpt-4o** (name e.g. `gpt-4o`)
   - Embeddings: **text-embedding-3-large** (match names to `.env.local`)
3. Keys + Endpoint → `AZURE_OPENAI_*`

## 7. Azure AI Vision

1. Create **AI Vision** (or multi-service Cognitive Services) resource
2. Endpoint + Key → `AZURE_VISION_*`

Used in `src/lib/azure/vision.ts` for tagging/caption on wardrobe images.

## Using the Azure MCP (Cursor)

Your **Azure MCP** exposes tools such as `storage`, `servicebus`, `redis`, `postgres`. Typical flow:

1. **Discover commands**: call the tool with `learn: true` and an `intent` describing what you want (e.g. “list storage accounts”, “create queue”).
2. **Create resources** you prefer to automate (Blob containers, queues, Redis) once your subscription is authenticated in Cursor.
3. For **PostgreSQL Flexible Server creation**, the portal is often clearer for first-time networking + extensions; use MCP for **SQL** or **listing** once the server exists.

Exact subcommands depend on your MCP version; always read the tool schema in `mcps/user-Azure/tools/*.json` before calling.

### PostgreSQL MCP commands (after a server exists)

| Command | Purpose |
|--------|---------|
| `postgres_list` | List servers (optional: `resource-group`), databases (`server`, `user`), or tables (`server`, `database`, `user`) |
| `postgres_database_query` | Run **SELECT** / read queries (needs `resource-group`, `user`, `server`, `database`, `query`) |
| `postgres_table_schema_get` | Inspect columns for a table |
| `postgres_server_config_get` / `postgres_server_param_get` | Server configuration |
| `postgres_server_param_set` | Change server parameters (e.g. enable extensions via portal or parameter where supported) |

**Note:** The MCP can list and query existing Flexible Servers; **creating** the server is usually done in the portal or Azure CLI the first time. This environment currently reports **no PostgreSQL servers** in your default subscription — create one in portal, then use `postgres_list` again to confirm.

## 8. Clerk (auth)

1. [Clerk dashboard](https://dashboard.clerk.com) → new application
2. Enable **Google / Apple / Email** as needed
3. Copy **Publishable key** and **Secret key** → `NEXT_PUBLIC_CLERK_*` and `CLERK_SECRET_KEY`
4. Set sign-in/up URLs to match this app (`/sign-in`, `/sign-up`) or adjust middleware/public routes in `src/middleware.ts`

## 9. Vercel (frontend)

1. Import Git repo
2. **Environment variables**: paste production values from `.env.local` (never commit secrets)
3. Build: `npm run build`, output dir default for Next.js

## 10. Local dev

```bash
cp .env.example .env.local
# fill DATABASE_URL at minimum; Clerk keys; optionally stub Azure
npm install
npx prisma generate
npm run dev
```

Without Azure OpenAI/Vision, `/api/chat` and vision-heavy wardrobe flows return **503** until keys are set.

## 11. CI/CD

See [`.github/workflows/ci.yml`](./.github/workflows/ci.yml). Add `DATABASE_URL` (staging) as a GitHub **secret** for `prisma migrate deploy` in deploy workflows when you add them.
