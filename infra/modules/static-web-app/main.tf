resource "azurerm_static_web_app" "frontend" {
  name                = "${var.project_name}-${var.environment}-web"
  resource_group_name = var.resource_group_name
  location            = var.location
  sku_tier            = "Standard"
  sku_size            = "Standard"

  tags = var.tags
}
