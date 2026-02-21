output "ai_foundry_id" {
  description = "Azure AI Foundry resource ID"
  value       = azurerm_cognitive_account.ai_foundry.id
}

output "endpoint" {
  description = "Azure AI Foundry endpoint"
  value       = azurerm_cognitive_account.ai_foundry.endpoint
}

output "primary_key" {
  description = "Azure AI Foundry primary key"
  value       = azurerm_cognitive_account.ai_foundry.primary_access_key
  sensitive   = true
}

output "gpt4o_deployment_name" {
  description = "GPT-4o deployment name"
  value       = azurerm_cognitive_deployment.gpt4o.name
}

output "embedding_deployment_name" {
  description = "Text embedding deployment name"
  value       = azurerm_cognitive_deployment.embedding.name
}

output "instance_name" {
  description = "Azure OpenAI instance name (custom subdomain)"
  value       = azurerm_cognitive_account.ai_foundry.custom_subdomain_name
}
