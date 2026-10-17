// ─────────────────────────────────────────────────────────────────────────────
// Aurafit web — Next.js Container App.
// Public ingress on 443 -> container :3000.
// Scales to zero when idle so compute cost goes to $0 during pauses.
// ─────────────────────────────────────────────────────────────────────────────

@description('Container App name.')
param name string

@description('Azure region.')
param location string

@description('Container Apps environment resource id.')
param environmentId string

@description('Container Registry login server (e.g. aurafitprodacr.azurecr.io).')
param registryLoginServer string

@description('Container Registry resource id (used to derive admin credentials).')
param registryResourceId string

@description('Full image URL (e.g. aurafitprodacr.azurecr.io/aurafit/web:latest, or a public placeholder).')
param imageName string

@description('Tags applied to the resource.')
param tags object = {}

@description('Min replicas. 0 = scale to zero when idle (no compute cost).')
param minReplicas int = 0

@description('Max replicas.')
param maxReplicas int = 3

@description('CPU cores per replica.')
param cpu string = '2.0'

@description('Memory per replica.')
param memory string = '4Gi'

// ── secrets passed in from main.bicep ─────────────────────────────────────
@secure()
param databaseUrl string
@secure()
param clerkSecretKey string
param clerkPublishableKey string
@secure()
param azureOpenAiApiKey string
param azureOpenAiEndpoint string
@secure()
param azureOpenAiImageApiKey string
param azureOpenAiImageEndpoint string
@secure()
param azureStorageConnectionString string
param azureStorageAccountName string
@secure()
param azureStorageAccountKey string
@secure()
param crawlerApiKey string
@description('Optional SerpAPI key — enables internet-wide Google Shopping search. Empty disables the provider.')
@secure()
param serpApiKey string = ''
@secure()
param inngestEventKey string
@secure()
param inngestSigningKey string
param inngestBaseUrl string
param productCrawlerUrl string
param appUrl string
param corsAllowedOrigins string

// ACR admin credentials (Basic SKU has admin user enabled)
var registry = reference(registryResourceId, '2023-11-01-preview')
var registryName = last(split(registryResourceId, '/'))
var acrCreds = listCredentials(registryResourceId, '2023-11-01-preview')

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  tags: union(tags, {
    'azd-service-name': 'web'
  })
  properties: {
    environmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      registries: [
        {
          server: registryLoginServer
          username: registryName
          passwordSecretRef: 'registry-password'
        }
      ]
      secrets: concat(
        [
          { name: 'registry-password', value: acrCreds.passwords[0].value }
          { name: 'database-url', value: databaseUrl }
          { name: 'clerk-secret-key', value: clerkSecretKey }
          { name: 'azure-openai-api-key', value: azureOpenAiApiKey }
          { name: 'azure-openai-image-api-key', value: azureOpenAiImageApiKey }
          { name: 'azure-storage-connection-string', value: azureStorageConnectionString }
          { name: 'azure-storage-account-key', value: azureStorageAccountKey }
          { name: 'crawler-api-key', value: crawlerApiKey }
          { name: 'inngest-event-key', value: inngestEventKey }
          { name: 'inngest-signing-key', value: inngestSigningKey }
        ],
        empty(serpApiKey) ? [] : [{ name: 'serpapi-key', value: serpApiKey }]
      )
    }
    template: {
      containers: [
        {
          name: 'web'
          image: imageName
          resources: {
            cpu: json(cpu)
            memory: memory
          }
          env: concat([
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3000' }
            { name: 'HOSTNAME', value: '0.0.0.0' }
            { name: 'NEXT_TELEMETRY_DISABLED', value: '1' }
            { name: 'NEXT_PUBLIC_APP_URL', value: appUrl }
            { name: 'CORS_ALLOWED_ORIGINS', value: corsAllowedOrigins }

            { name: 'DATABASE_URL', secretRef: 'database-url' }

            { name: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', value: clerkPublishableKey }
            { name: 'CLERK_SECRET_KEY', secretRef: 'clerk-secret-key' }
            { name: 'NEXT_PUBLIC_CLERK_SIGN_IN_URL', value: '/sign-in' }
            { name: 'NEXT_PUBLIC_CLERK_SIGN_UP_URL', value: '/sign-up' }
            { name: 'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL', value: '/generate' }
            { name: 'NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL', value: '/onboarding' }

            { name: 'AZURE_OPENAI_ENDPOINT', value: azureOpenAiEndpoint }
            { name: 'AZURE_OPENAI_API_KEY', secretRef: 'azure-openai-api-key' }
            { name: 'AZURE_OPENAI_DEPLOYMENT_GPT4O', value: 'gpt-4o' }
            { name: 'AZURE_OPENAI_DEPLOYMENT_EMBED', value: 'text-embedding-3-large' }
            { name: 'AZURE_OPENAI_DEPLOYMENT_IMAGE', value: 'gpt-image-2' }
            { name: 'AZURE_OPENAI_API_VERSION', value: '2024-10-01-preview' }
            { name: 'AI_PROVIDERS', value: 'azure,openai' }
            { name: 'AI_PROVIDER', value: 'azure' }

            { name: 'AZURE_OPENAI_IMAGE_ENDPOINT', value: azureOpenAiImageEndpoint }
            { name: 'AZURE_OPENAI_IMAGE_API_KEY', secretRef: 'azure-openai-image-api-key' }
            { name: 'AZURE_OPENAI_IMAGE_API_VERSION', value: '2025-04-01-preview' }
            { name: 'IMAGE_PROVIDERS', value: 'azure,noop' }

            { name: 'STORAGE_PROVIDER', value: 'azure' }
            { name: 'AZURE_STORAGE_ACCOUNT_NAME', value: azureStorageAccountName }
            { name: 'AZURE_STORAGE_ACCOUNT_KEY', secretRef: 'azure-storage-account-key' }
            { name: 'AZURE_STORAGE_CONNECTION_STRING', secretRef: 'azure-storage-connection-string' }
            { name: 'AZURE_STORAGE_CONTAINER_WARDROBES', value: 'wardrobes' }
            { name: 'AZURE_STORAGE_CONTAINER_OUTFITS', value: 'outfits' }
            { name: 'AZURE_STORAGE_CONTAINER_PROFILES', value: 'profiles' }

            { name: 'PRODUCT_DISCOVERY_LAYERS', value: 'cache,index,shopping,crawl' }
            { name: 'PRODUCT_SEARCH_CACHE_TTL_SECONDS', value: '21600' }
            { name: 'PRODUCT_RANKING_ENABLED', value: 'true' }
            { name: 'PRODUCT_CRAWL_MIN_RESULTS', value: '1' }
            { name: 'PRODUCT_CANDIDATE_POOL_TARGET', value: '20' }
            { name: 'BOARD_MAX_PER_RETAILER', value: '3' }
            { name: 'PRODUCT_INDEX_MIN_SCORE', value: '0.50' }
            { name: 'PRODUCT_CRAWLER_URL', value: productCrawlerUrl }
            { name: 'GENERATION_CRAWLER_TIMEOUT_MS', value: '20000' }
            { name: 'PRODUCT_LOOK_CONCURRENCY', value: '3' }
            { name: 'CRAWLER_CIRCUIT_THRESHOLD', value: '5' }
            { name: 'CRAWLER_CIRCUIT_COOLDOWN_MS', value: '20000' }
            { name: 'CRAWLER_API_KEY', secretRef: 'crawler-api-key' }
            { name: 'CRAWL_PAGE_CACHE_TTL_SECONDS', value: '604800' }

            { name: 'QUEUE_PROVIDERS', value: 'inngest,inline' }
            { name: 'INNGEST_EVENT_KEY', secretRef: 'inngest-event-key' }
            { name: 'INNGEST_SIGNING_KEY', secretRef: 'inngest-signing-key' }
            { name: 'INNGEST_DEV', value: '0' }
            { name: 'INNGEST_BASE_URL', value: inngestBaseUrl }
            { name: 'CACHE_PROVIDER', value: 'memory' }
            { name: 'GENERATION_PREVIEW_ONLY', value: 'false' }
            { name: 'AFFILIATE_PROVIDERS', value: 'amazon,generic' }
            { name: 'TRYON_PROVIDERS', value: 'replicate,noop' }

            // Billing stays off until go/no-go. Secrets injected via Container App updates / Key Vault.
            { name: 'BILLING_ENABLED', value: 'false' }
            { name: 'BILLING_LIVE_MODE', value: 'false' }
            { name: 'BILLING_LIVE_APPROVED', value: 'false' }
            { name: 'HEALTH_DEBUG_ENABLED', value: 'false' }
            { name: 'HEALTH_WARM_ENABLED', value: 'false' }
            // Keep false until REDIS_URL is set. True with no Redis fail-closes
            // generation, HD, billing, and affiliate limits for every user.
            { name: 'RATE_LIMIT_REQUIRE_REDIS', value: 'false' }
          ], empty(serpApiKey) ? [] : [{ name: 'SERPAPI_KEY', secretRef: 'serpapi-key' }])
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: 3000
              }
              initialDelaySeconds: 15
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/health'
                port: 3000
              }
              initialDelaySeconds: 5
              periodSeconds: 15
              timeoutSeconds: 5
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-scale'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

output appName string = app.name
output appFqdn string = app.properties.configuration.ingress.fqdn
output appUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
