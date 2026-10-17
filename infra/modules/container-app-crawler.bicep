// ─────────────────────────────────────────────────────────────────────────────
// Aurafit crawler — Playwright + FastAPI Container App.
// Internal-only ingress so the crawler is reachable from the web container
// (free internal traffic) but not from the public internet.
// ─────────────────────────────────────────────────────────────────────────────

@description('Container App name.')
param name string

@description('Azure region.')
param location string

@description('Container Apps environment resource id.')
param environmentId string

@description('Container Registry login server.')
param registryLoginServer string

@description('Container Registry resource id.')
param registryResourceId string

@description('Full image URL (e.g. aurafitprodacr.azurecr.io/aurafit/crawler:latest, or a public placeholder).')
param imageName string

@description('Tags applied to the resource.')
param tags object = {}

@description('Min replicas. 1 keeps Playwright warm so Amazon/Myntra/Ajio searches do not miss the generation window.')
param minReplicas int = 1

@description('Max replicas.')
param maxReplicas int = 2

@description('CPU cores per replica. Playwright needs at least 2 vCPU under load.')
param cpu string = '2.0'

@description('Memory per replica.')
param memory string = '4Gi'

@secure()
param crawlerApiKey string

@description('Optional Bright Data Web Unlocker API token. Empty skips this rung.')
@secure()
param brightDataApiToken string = ''

@description('Bright Data Web Unlocker zone name. Empty uses web_unlocker.')
@secure()
param brightDataWebUnlockerZone string = ''

@description('Optional Oxylabs Realtime username. Empty skips this rung.')
@secure()
param oxylabsUsername string = ''

@description('Optional Oxylabs Realtime password. Empty skips this rung.')
@secure()
param oxylabsPassword string = ''

var registryName = last(split(registryResourceId, '/'))
var acrCreds = listCredentials(registryResourceId, '2023-11-01-preview')

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  tags: union(tags, {
    'azd-service-name': 'crawler'
  })
  properties: {
    environmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false
        targetPort: 8100
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
      secrets: [
        { name: 'registry-password', value: acrCreds.passwords[0].value }
        { name: 'crawler-api-key', value: crawlerApiKey }
        { name: 'brightdata-api-token', value: brightDataApiToken }
        { name: 'brightdata-web-unlocker-zone', value: brightDataWebUnlockerZone }
        { name: 'oxylabs-username', value: oxylabsUsername }
        { name: 'oxylabs-password', value: oxylabsPassword }
      ]
    }
    template: {
      containers: [
        {
          name: 'crawler'
          image: imageName
          resources: {
            cpu: json(cpu)
            memory: memory
          }
          env: [
            { name: 'PORT', value: '8100' }
            { name: 'CRAWLER_API_KEY', secretRef: 'crawler-api-key' }
            { name: 'BRIGHTDATA_API_TOKEN', secretRef: 'brightdata-api-token' }
            { name: 'BRIGHTDATA_WEB_UNLOCKER_ZONE', secretRef: 'brightdata-web-unlocker-zone' }
            { name: 'OXYLABS_USERNAME', secretRef: 'oxylabs-username' }
            { name: 'OXYLABS_PASSWORD', secretRef: 'oxylabs-password' }
            { name: 'MAX_PARALLEL_STORE_SEARCHES', value: '6' }
            { name: 'MAX_CONCURRENT_SEARCHES', value: '3' }
            { name: 'MAX_VERIFIED_PER_STORE', value: '2' }
            { name: 'MIN_DISTINCT_RETAILERS', value: '4' }
            { name: 'STORE_SEARCH_TIMEOUT_SEC', value: '12' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 8100
              }
              initialDelaySeconds: 60
              periodSeconds: 120
              timeoutSeconds: 10
              failureThreshold: 5
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 8100
              }
              initialDelaySeconds: 45
              periodSeconds: 30
              timeoutSeconds: 10
              failureThreshold: 5
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
                concurrentRequests: '4'
              }
            }
          }
        ]
      }
    }
  }
}

output appName string = app.name
output internalFqdn string = app.properties.configuration.ingress.fqdn
output internalUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
