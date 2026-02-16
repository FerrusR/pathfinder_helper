resource "azurerm_service_plan" "main" {
  name                = "${var.project_name}-${var.environment}-plan"
  resource_group_name = var.resource_group_name
  location            = var.location
  os_type             = "Linux"
  sku_name            = "B1"

  tags = var.tags
}

resource "azurerm_linux_web_app" "backend" {
  name                = "${var.project_name}-${var.environment}-api"
  resource_group_name = var.resource_group_name
  location            = var.location
  service_plan_id     = azurerm_service_plan.main.id

  site_config {
    always_on = true

    application_stack {
      node_version = "22-lts"
    }

    cors {
      allowed_origins     = ["https://${var.frontend_hostname}"]
      support_credentials = false
    }
  }

  app_settings = {
    "NODE_ENV"                                 = "production"
    "DATABASE_URL"                             = var.database_url
    "AZURE_OPENAI_API_KEY"                     = var.openai_key
    "AZURE_OPENAI_ENDPOINT"                    = var.openai_endpoint
    "AZURE_OPENAI_DEPLOYMENT_NAME"             = "gpt-4o"
    "AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME"   = "text-embedding-3-small"
    "JWT_SECRET"                               = random_password.jwt_secret.result
    "JWT_EXPIRATION"                           = "7d"
    "SCM_DO_BUILD_DURING_DEPLOYMENT"           = "true"
    "FRONTEND_URL"                             = "https://${var.frontend_hostname}"
    "MICROSOFT_PROVIDER_AUTHENTICATION_SECRET" = var.azure_auth_client_secret
  }

  auth_settings_v2 {
    auth_enabled           = true
    require_authentication = true
    unauthenticated_action = "Return401"
    default_provider       = "azureactivedirectory"

    active_directory_v2 {
      client_id                  = var.azure_auth_client_id
      tenant_auth_endpoint       = "https://login.microsoftonline.com/${var.azure_tenant_id}/v2.0"
      client_secret_setting_name = "MICROSOFT_PROVIDER_AUTHENTICATION_SECRET"
    }

    login {
      token_store_enabled = true
    }
  }

  https_only = true

  tags = var.tags
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = true
}
