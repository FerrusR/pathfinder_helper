output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}

output "database_host" {
  description = "PostgreSQL server hostname"
  value       = module.database.server_fqdn
}

output "database_connection_string" {
  description = "PostgreSQL connection string"
  value       = module.database.connection_string
  sensitive   = true
}

output "openai_endpoint" {
  description = "Azure OpenAI endpoint"
  value       = module.openai.endpoint
}

output "openai_key" {
  description = "Azure OpenAI primary key"
  value       = module.openai.primary_key
  sensitive   = true
}

output "backend_url" {
  description = "Backend app service URL"
  value       = "https://${module.app_service.default_hostname}"
}

output "frontend_url" {
  description = "Frontend static web app URL"
  value       = module.static_web_app.default_hostname
}

output "storage_account_name" {
  description = "Storage account name"
  value       = module.storage.storage_account_name
}
