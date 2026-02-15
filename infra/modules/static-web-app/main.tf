resource "azurerm_static_web_app" "frontend" {
  name                = "${var.project_name}-${var.environment}-web"
  resource_group_name = var.resource_group_name
  location            = var.location
  sku_tier            = "Free"
  sku_size            = "Free"

  tags = var.tags
}

# Configuration for the static web app will be handled by GitHub Actions
# The app settings can be configured via the Azure portal or CLI after deployment
