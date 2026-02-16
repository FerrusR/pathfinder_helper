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

variable "azure_auth_client_id" {
  description = "Azure AD App Registration client ID for authentication"
  type        = string
}

variable "azure_auth_client_secret" {
  description = "Azure AD App Registration client secret for authentication"
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
}
