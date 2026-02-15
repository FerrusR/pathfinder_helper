output "app_service_id" {
  description = "App Service ID"
  value       = azurerm_linux_web_app.backend.id
}

output "default_hostname" {
  description = "Default hostname of the App Service"
  value       = azurerm_linux_web_app.backend.default_hostname
}

output "outbound_ip_addresses" {
  description = "Outbound IP addresses"
  value       = azurerm_linux_web_app.backend.outbound_ip_addresses
}
