// ─────────────────────────────────────────────────────────────────────────────
// Container Apps Environment + Log Analytics workspace.
// Pay-per-GB log analytics; idle cost is near-zero.
// ─────────────────────────────────────────────────────────────────────────────

@description('Environment name.')
param environmentName string

@description('Log Analytics workspace name.')
param logsWorkspaceName string

@description('Azure region.')
param location string

@description('Tags applied to all resources.')
param tags object = {}

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logsWorkspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
    zoneRedundant: false
  }
}

output environmentId string = env.id
output environmentName string = env.name
output defaultDomain string = env.properties.defaultDomain
output staticIp string = env.properties.staticIp
output logsWorkspaceId string = logs.id
