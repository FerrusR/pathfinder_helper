resource "azurerm_cognitive_account" "ai_foundry" {
  name                = "${var.project_name}-${var.environment}-ai"
  location            = var.location
  resource_group_name = var.resource_group_name
  kind                = "AIServices"
  sku_name            = "S0"

  custom_subdomain_name      = "${var.project_name}-${var.environment}-ai"
  project_management_enabled = true

  identity {
    type = "SystemAssigned"
  }

  tags = var.tags
}

# GPT-4o deployment
resource "azurerm_cognitive_deployment" "gpt4o" {
  name                 = "gpt-4o"
  cognitive_account_id = azurerm_cognitive_account.ai_foundry.id

  model {
    format  = "OpenAI"
    name    = "gpt-4o"
    version = "2024-11-20"
  }

  sku {
    name     = "GlobalStandard"
    capacity = 1
  }
}

# Text embedding deployment
resource "azurerm_cognitive_deployment" "embedding" {
  name                 = "text-embedding-3-small"
  cognitive_account_id = azurerm_cognitive_account.ai_foundry.id

  depends_on = [azurerm_cognitive_deployment.gpt4o]

  model {
    format  = "OpenAI"
    name    = "text-embedding-3-small"
    version = "1"
  }

  sku {
    name     = "Standard"
    capacity = 10
  }
}
