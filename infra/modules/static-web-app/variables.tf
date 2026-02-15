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

variable "backend_url" {
  description = "Backend API URL"
  type        = string
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
}
