resource "azurerm_static_web_app" "frontend" {
  name                = "${var.project_name}-${var.environment}-web"
  resource_group_name = var.resource_group_name
  location            = var.location
  sku_tier            = "Standard"
  sku_size            = "Standard"

  app_settings = {
    "AZURE_AUTH_CLIENT_ID"     = var.azure_auth_client_id
    "AZURE_AUTH_CLIENT_SECRET" = var.azure_auth_client_secret
  }

  tags = var.tags
}
