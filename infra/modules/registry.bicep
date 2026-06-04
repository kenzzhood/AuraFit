// ─────────────────────────────────────────────────────────────────────────────
// Azure Container Registry (Basic) — holds Aurafit web + crawler images.
// Basic tier is the cheapest fixed cost (~$5/mo) and supports admin user auth
// which simplifies pulling from Container Apps without separate identity wiring.
// ─────────────────────────────────────────────────────────────────────────────

@description('Globally-unique registry name (lowercase, 5-50 chars).')
param registryName string

@description('Azure region.')
param location string

@description('Tags applied to the registry.')
param tags object = {}

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: registryName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
    publicNetworkAccess: 'Enabled'
    anonymousPullEnabled: false
  }
}

output loginServer string = acr.properties.loginServer
output name string = acr.name
output resourceId string = acr.id
