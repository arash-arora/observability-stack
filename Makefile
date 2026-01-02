.PHONY: help install build up down clean

help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies for all projects
	@echo "Installing Backend dependencies..."
	cd backend && uv sync
	@echo "Installing Frontend dependencies..."
	cd frontend && npm install
	@echo "Installing SDK dependencies..."
	cd obs-sdk && uv sync

build: ## Build docker images
	docker compose build

up: ## Start the application in development mode
	docker compose up -d

down: ## Stop the application
	docker compose down

clean: ## Clean up temporary files
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".venv" -exec rm -rf {} +
	find . -type d -name "node_modules" -exec rm -rf {} +
	find . -type d -name ".next" -exec rm -rf {} +
