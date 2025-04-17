# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Lint codebase

## Code Style Guidelines
- Use TypeScript with strict type checking
- Import order: React hooks, external libs, internal modules
- Use named exports over default exports\
- dont allow the use of any type
- Component naming: PascalCase for components, camelCase for hooks/utils
- Error handling: Use try/catch blocks with specific error types, console.error for logging
- State management: Use React hooks (useState, useEffect, useCallback, useMemo)
- React components: Function components with hooks
- CSS: Use Tailwind utilities with clsx/tailwind-merge for conditional classes
- File Structure: Group by feature, not by type
- Explicit module boundaries: Clearly define and document feature/module boundaries. Avoid leaking internal details; expose only public interfaces.
- Minimize and document dependencies between modules. Use dependency inversion where possible.
- High cohesion, low coupling: Group related functionality together and minimize inter-module dependencies.
- Prefer immutability for data structures and state updates where feasible.
- Separate concerns: Isolate business logic, UI, and data access. Use hooks/services for side effects and data fetching.
- Design APIs for extensibility and change. Use versioning and backward compatibility for public interfaces.
- Observability: Add logging, metrics, and error boundaries for diagnostics and monitoring.
- Require automated tests: Unit, integration, and end-to-end tests for all features. Use mocks/stubs for external dependencies.
- Document architectural decisions (ADR), module responsibilities, and public interfaces.
- Profile and optimize performance-critical paths. Use lazy loading and code splitting for large modules.
- Validate and sanitize all inputs. Follow secure coding practices for authentication and authorization.

## Types
- Define explicit interfaces/types for all data structures
- Use type inference where appropriate, explicit return types for functions
- Prefer type aliases for simple types, interfaces for complex objects