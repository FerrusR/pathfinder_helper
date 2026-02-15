output "static_web_app_id" {
  description = "Static Web App ID"
  value       = azurerm_static_web_app.frontend.id
}

output "default_hostname" {
  description = "Default hostname of the Static Web App"
  value       = azurerm_static_web_app.frontend.default_host_name
}

output "api_key" {
  description = "API key for Static Web App deployment"
  value       = azurerm_static_web_app.frontend.api_key
  sensitive   = true
}
