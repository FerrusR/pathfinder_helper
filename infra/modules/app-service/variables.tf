variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "database_url" {
  description = "PostgreSQL connection string"
  type        = string
  sensitive   = true
}

variable "openai_endpoint" {
  description = "Azure OpenAI endpoint"
  type        = string
}

variable "openai_key" {
  description = "Azure OpenAI key"
  type        = string
  sensitive   = true
}

variable "openai_instance_name" {
  description = "Azure OpenAI instance name (subdomain of the endpoint, e.g. 'my-instance' from https://my-instance.openai.azure.com)"
  type        = string
}

variable "frontend_hostname" {
  description = "Static Web App default hostname (without https://)"
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
}
