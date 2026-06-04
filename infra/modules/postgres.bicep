// ─────────────────────────────────────────────────────────────────────────────
// Azure Database for PostgreSQL — Flexible Server with pgvector enabled.
//
// Burstable B1ms (~₹1,700/mo compute in Central India when running 24/7).
// Do NOT upgrade to General Purpose (D-series) unless you accept ~₹10k+/mo.
// Stop the server with `npm run azure:stop` when idle — storage-only ~₹250/mo.
//
// pgvector is allow-listed via the `azure.extensions` server parameter so the
// runtime `CREATE EXTENSION vector` (run by db-init.sh) succeeds.
// ─────────────────────────────────────────────────────────────────────────────

@description('Server name (lowercase, 3-63 chars). Must be globally unique.')
param serverName string

@description('Azure region.')
param location string

@description('Tags applied to the server.')
param tags object = {}

@description('Postgres admin login (used by Prisma DATABASE_URL).')
param administratorLogin string = 'aurafit_admin'

@description('Postgres admin password.')
@secure()
param administratorLoginPassword string

@description('Application database name.')
param databaseName string = 'aurafit'

@description('Postgres major version.')
@allowed([
  '14'
  '15'
  '16'
])
param postgresVersion string = '16'

@description('SKU name (e.g. Standard_B1ms, Standard_B2ms).')
param skuName string = 'Standard_B1ms'

@description('SKU tier.')
@allowed([
  'Burstable'
  'GeneralPurpose'
  'MemoryOptimized'
])
param skuTier string = 'Burstable'

@description('Storage size in GB.')
param storageSizeGB int = 32

resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: serverName
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    version: postgresVersion
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    storage: {
      storageSizeGB: storageSizeGB
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
    authConfig: {
      passwordAuth: 'Enabled'
      activeDirectoryAuth: 'Disabled'
    }
  }
}

resource extensionsParam 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: server
  name: 'azure.extensions'
  properties: {
    value: 'VECTOR,UUID-OSSP,PGCRYPTO'
    source: 'user-override'
  }
}

resource db 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: server
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
  dependsOn: [
    extensionsParam
  ]
}

// Allow all Azure services (Container Apps outbound IPs are dynamic so this
// is the simplest path to keep things working through scale events).
resource fwAzureServices 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: server
  name: 'AllowAllAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output fqdn string = server.properties.fullyQualifiedDomainName
output serverName string = server.name
output databaseName string = databaseName
output administratorLogin string = administratorLogin
output databaseUrl string = 'postgresql://${administratorLogin}:${uriComponent(administratorLoginPassword)}@${server.properties.fullyQualifiedDomainName}:5432/${databaseName}?sslmode=require'
