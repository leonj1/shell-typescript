# Shell Architecture TypeScript Implementation

This project implements a hexagonal architecture (ports and adapters) shell for TypeScript applications.

## Project Structure

```
shell-typescript/
├── packages/
│   ├── interfaces/     # TypeScript interfaces for all contracts
│   ├── shell/          # Core shell implementation with Next.js
│   └── cli/            # CLI tool for creating modules
```

## Packages

### @shell/interfaces
Contains all the TypeScript interfaces that define the contracts between the shell and business modules.

### @shell/core
The core shell implementation that provides infrastructure services and module loading capabilities.

### @shell/cli
A CLI tool for generating new business modules and other development tasks.

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Build all packages:
   ```bash
   pnpm build
   ```

3. Run the shell application:
   ```bash
   pnpm dev
   ```

4. Use the CLI tool:
   ```bash
   cd packages/cli
   node dist/index.js create my-module
   ```

## Architecture Overview

The shell follows a hexagonal architecture pattern with:
- **Ports**: TypeScript interfaces defining contracts
- **Adapters**: Implementations of those interfaces
- **Core**: The business logic repository

Services are managed through a dependency injection container using InversifyJS.