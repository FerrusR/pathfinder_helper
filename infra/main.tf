terraform {
  required_version = ">= 1.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }

  # Uncomment this block to use Azure Storage for Terraform state
  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "tfstatepf2e"
    container_name       = "tfstate"
    key                  = "pathfinder-helper.tfstate"
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.azure_subscription_id
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "${var.project_name}-${var.environment}-rg"
  location = var.location

  tags = var.tags
}

# PostgreSQL Database Module
module "database" {
  source = "./modules/database"

  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  project_name        = var.project_name
  environment         = var.environment
  db_admin_username   = var.db_admin_username
  db_admin_password   = var.db_admin_password
  tags                = var.tags
}

# Azure OpenAI Module
module "openai" {
  source = "./modules/openai"

  resource_group_name = azurerm_resource_group.main.name
  location            = var.openai_location
  project_name        = var.project_name
  environment         = var.environment
  tags                = var.tags
}

# Storage Module (for blob storage)
module "storage" {
  source = "./modules/storage"

  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  project_name        = var.project_name
  environment         = var.environment
  tags                = var.tags
}

# Static Web App Module (Frontend)
module "static_web_app" {
  source = "./modules/static-web-app"

  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  project_name             = var.project_name
  environment              = var.environment
  azure_auth_client_id     = var.azure_auth_client_id
  azure_auth_client_secret = var.azure_auth_client_secret
  tags                     = var.tags
}

# App Service Module (Backend)
module "app_service" {
  source = "./modules/app-service"

  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  project_name             = var.project_name
  environment              = var.environment
  database_url             = module.database.connection_string
  openai_endpoint          = module.openai.endpoint
  openai_key               = module.openai.primary_key
  frontend_hostname        = module.static_web_app.default_hostname
  azure_tenant_id          = var.azure_tenant_id
  azure_auth_client_id     = var.azure_auth_client_id
  azure_auth_client_secret = var.azure_auth_client_secret
  tags                     = var.tags
}
