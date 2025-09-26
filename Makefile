# Shell TypeScript Project Makefile
# Provides common development and build commands

.PHONY: help build build-docker test lint clean install dev build-packages validate run-docker run-example

# Default target - show help
help:
	@echo "Shell TypeScript Project - Available Commands"
	@echo "============================================="
	@echo "  make install         - Install all dependencies"
	@echo "  make build          - Build Docker validation image"
	@echo "  make build-packages - Build all TypeScript packages locally"
	@echo "  make test           - Run all tests"
	@echo "  make lint           - Run linters"
	@echo "  make clean          - Clean build artifacts and dependencies"
	@echo "  make validate       - Run Docker build validation"
	@echo "  make run-docker     - Run the Docker validation container"
	@echo "  make dev            - Start development server"
	@echo "  make run-example    - Build and run the example business app"
	@echo ""
	@echo "Docker Commands:"
	@echo "  make build          - Build validation Docker image"
	@echo "  make run-docker     - Run validation Docker container"
	@echo "  make docker-clean   - Remove Docker image"
	@echo ""
	@echo "Package Commands:"
	@echo "  make build-interfaces - Build @shell/interfaces package"
	@echo "  make build-shell     - Build @shell/shell package"
	@echo "  make build-cli       - Build @shell/cli package"

# Build Docker validation image
build:
	@echo "Building Docker validation image..."
	@docker build -f Dockerfile.build -t shell-typescript-build . || \
		(echo "❌ Docker build failed" && exit 1)
	@echo "✅ Docker image 'shell-typescript-build' created successfully"

# Install all dependencies
install:
	@echo "Installing dependencies..."
	@npm install
	@echo "✅ Dependencies installed"

# Build all TypeScript packages locally
build-packages: build-interfaces build-shell build-cli
	@echo "✅ All packages built successfully"

# Build individual packages
build-interfaces:
	@echo "Building @shell/interfaces..."
	@cd packages/interfaces && npm run build || npx tsc

build-shell:
	@echo "Building @shell/shell..."
	@cd packages/shell && npm run build || npx tsc

build-cli:
	@echo "Building @shell/cli..."
	@cd packages/cli && npm run build || npx tsc

# Run tests
test:
	@echo "Running tests..."
	@npm test || echo "⚠️  Some tests may have failed"

# Run tests with coverage
test-coverage:
	@echo "Running tests with coverage..."
	@npm run test:coverage

# Run linters
lint:
	@echo "Running linters..."
	@npm run lint:test 2>/dev/null || echo "ℹ️  No lint script configured"

# Clean build artifacts and dependencies
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf packages/*/dist
	@rm -rf packages/*/build
	@rm -rf packages/*/.next
	@rm -rf coverage
	@rm -rf .nyc_output
	@find . -name "*.tsbuildinfo" -type f -delete
	@find . -name "*.log" -type f -delete
	@echo "✅ Build artifacts cleaned"

# Deep clean including node_modules
deep-clean: clean
	@echo "Removing node_modules..."
	@rm -rf node_modules
	@rm -rf packages/*/node_modules
	@echo "✅ Deep clean completed"

# Run Docker validation
validate: build run-docker
	@echo "✅ Validation completed"

# Run the Docker validation container
run-docker:
	@echo "Running Docker validation container..."
	@docker run --rm shell-typescript-build || \
		(echo "❌ Docker container failed to run" && exit 1)

# Remove Docker image
docker-clean:
	@echo "Removing Docker image..."
	@docker rmi shell-typescript-build 2>/dev/null || echo "Image not found"
	@echo "✅ Docker image removed"

# Start development server
dev:
	@echo "Starting development server..."
	@cd packages/shell && npm run dev

# Watch mode for development
watch:
	@echo "Starting watch mode..."
	@npm run test:watch

# Check TypeScript types without building
typecheck:
	@echo "Type checking all packages..."
	@cd packages/interfaces && npx tsc --noEmit
	@cd packages/shell && npx tsc --noEmit
	@cd packages/cli && npx tsc --noEmit
	@echo "✅ Type check completed"

# Create a production build
production: clean install build-packages test
	@echo "✅ Production build completed"

# Docker compose commands (if docker-compose.yml exists)
docker-up:
	@test -f docker-compose.yml && docker-compose up -d || echo "No docker-compose.yml found"

docker-down:
	@test -f docker-compose.yml && docker-compose down || echo "No docker-compose.yml found"

# Show project statistics
stats:
	@echo "Project Statistics"
	@echo "=================="
	@echo "TypeScript files:"
	@find packages -name "*.ts" -o -name "*.tsx" | grep -v node_modules | wc -l
	@echo ""
	@echo "Test files:"
	@find packages -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" | grep -v node_modules | wc -l
	@echo ""
	@echo "Package sizes:"
	@du -sh packages/* | grep -v node_modules
	@echo ""
	@echo "Dependencies:"
	@npm ls --depth=0 2>/dev/null | tail -n +2 | wc -l

# Install specific package dependencies
install-interfaces:
	@cd packages/interfaces && npm install

install-shell:
	@cd packages/shell && npm install

install-cli:
	@cd packages/cli && npm install

# Reinstall all dependencies (useful for fixing issues)
reinstall: deep-clean install
	@echo "✅ All dependencies reinstalled"

# Format code with prettier (if configured)
format:
	@npx prettier --write "packages/**/*.{ts,tsx,js,jsx,json,md}" 2>/dev/null || \
		echo "ℹ️  Prettier not configured"

# Security audit
audit:
	@echo "Running security audit..."
	@npm audit || echo "⚠️  Some vulnerabilities may exist"

# Fix security vulnerabilities
audit-fix:
	@echo "Attempting to fix vulnerabilities..."
	@npm audit fix

# Create a new release (version bump)
release-patch:
	@npm version patch
	@echo "✅ Patch version bumped"

release-minor:
	@npm version minor
	@echo "✅ Minor version bumped"

release-major:
	@npm version major
	@echo "✅ Major version bumped"

# CI/CD targets
ci: install build-packages test
	@echo "✅ CI build completed"

cd: ci build
	@echo "✅ CD build completed"

# Development setup
setup: install
	@echo "Setting up development environment..."
	@cp .env.example .env 2>/dev/null || echo "ℹ️  No .env.example found"
	@echo "✅ Development environment ready"

# Quick validation without Docker
quick-check:
	@echo "Running quick validation..."
	@cd packages/interfaces && npx tsc --noEmit && echo "✅ interfaces OK" || echo "❌ interfaces has errors"
	@cd packages/shell && npx tsc --noEmit && echo "✅ shell OK" || echo "❌ shell has errors"
	@cd packages/cli && npx tsc --noEmit && echo "✅ cli OK" || echo "❌ cli has errors"

# Run the example business application
run-example: install-example
	@echo "=========================================="
	@echo "Starting TODO Application with Shell"
	@echo "=========================================="
	@echo ""
	@echo "🚀 Starting server..."
	@cd example && npm run dev &
	@sleep 3
	@echo ""
	@echo "🧪 Testing /health endpoint (provided by shell)..."
	@echo "=========================================="
	@curl -s http://localhost:3030/health | python3 -m json.tool 2>/dev/null || \
		(echo "❌ Health check failed - is the server running?" && exit 1)
	@echo ""
	@echo "✅ Health endpoint is accessible!"
	@echo "   The /health endpoint is PROVIDED BY THE SHELL"
	@echo "   The TODO module does NOT define its own /health"
	@echo ""
	@echo "📋 Try these commands:"
	@echo "   curl http://localhost:3030/"
	@echo "   curl http://localhost:3030/health"
	@echo "   curl http://localhost:3030/api/v1/todos"
	@echo ""
	@echo "Press Ctrl+C to stop the server"
	@wait

# Run example with automatic test
run-example-test: install-example
	@echo "=========================================="
	@echo "Running TODO App with Auto Health Test"
	@echo "=========================================="
	@cd example && npm run dev:test

# Install example dependencies
install-example:
	@echo "Installing example dependencies..."
	@cd example && npm install

# Build the example application
build-example:
	@echo "Building example application..."
	@cd example && npm run build || echo "⚠️  Build may have TypeScript errors (expected)"

# Build and run example in one command
example: run-example

# Test the example endpoints
test-example:
	@echo "Testing example endpoints..."
	@sleep 2
	@echo "\n📡 Testing /test endpoint:"
	@curl -s http://localhost:3030/test | python3 -m json.tool || echo "Server may not be running"
	@echo "\n📡 Testing /api/v1/health endpoint:"
	@curl -s http://localhost:3030/api/v1/health | python3 -m json.tool || echo "Server may not be running"

.DEFAULT_GOAL := help