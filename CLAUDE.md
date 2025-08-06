# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### API (Node.js Cloud Function)
Navigate to `/api` directory:
- `npm install` - Install dependencies
- `npm run dev` - Start local development server with Functions Framework
- `npm run compile` - Compile TypeScript
- `npm run clean` - Clean build artifacts
- `npm run fix` - Run gts fix for code formatting
- `npm test` - Run unit and integration tests with Jest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report

### Dashboard (React + Vite)
Navigate to `/dashboard` directory:
- `npm install` - Install dependencies  
- `npm run dev` - Start development server (typically http://localhost:5173)
- `npm run build` - Build for production (runs TypeScript check + Vite build)
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build
- `npm run test` - Run tests in watch mode with Vitest
- `npm run test:run` - Run tests once
- `npm run test:ui` - Run tests with UI interface
- `npm run coverage` - Generate test coverage report

### Database
- Migrations are in `supabase/migrations/`
- Database deployment handled via GitHub Actions workflow

### Testing Infrastructure
- **Frontend**: Vitest + React Testing Library with comprehensive component and integration tests
- **Backend**: Jest + Supertest for API endpoints, services, and middleware testing
- **Coverage**: Both frontend and backend have extensive test coverage including mocks for external dependencies

## Architecture Overview

Continuum is a full-stack application for writers to manage story context with three main components:

**Frontend (React + Vite)**: Web dashboard deployed to Firebase Hosting. Handles user authentication and direct CRUD operations with Supabase using Row Level Security.

**Backend (Node.js + TypeScript)**: Serverless API deployed to Google Cloud Run. Reserved for complex server-side logic like the "Preset Engine" that dynamically assembles context from related documents.

**Database (Supabase/PostgreSQL)**: Handles data persistence, user authentication, and authorization via Row Level Security policies.

## Data Access Patterns

**Frontend → Supabase Direct**: Standard CRUD operations use supabase-js client directly. Security enforced by RLS policies in migrations.

**Frontend → Backend API → Supabase**: Complex operations (like preset context generation) go through the backend API at `/api/presets/:id/context` endpoints.

## Key Data Model Concepts

**Project-Based Isolation**: All data is scoped to projects via `project_id` foreign keys. Users access projects through the `project_members` table with role-based permissions.

**Document Relationships**: The `documents` table supports three relationship patterns:
1. **Derivative**: Documents grouped by `group_id` with different `document_type` values
2. **Composite**: Dynamic documents with `is_composite=true` that resolve content from other documents via `components` JSONB field
3. **Event Links**: Many-to-many relationships between events and documents via `event_documents` join table

## Security & Authentication

- User identity managed by Supabase Auth
- Frontend uses supabase-js client with automatic JWT attachment
- Backend validates JWTs via Supabase `/auth/v1/user` endpoint
- Row Level Security policies enforce project-based data isolation
- Never commit secrets - use environment variables for API keys

## Current Implementation Status

**Completed**: 
- User authentication and project CRUD with RLS policies
- Complete document management system with composite document support
- Professional UI with responsive design and modal interfaces
- Comprehensive testing infrastructure (30+ frontend tests, 13+ backend tests)
- CI/CD pipelines for automated deployment

**Next**: Events and tagging system, project member management, preset engine for dynamic context generation

## Environment Setup

API requires `.env` with:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Dashboard requires `.env.local` with:
- `VITE_SUPABASE_URL` 
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL=http://localhost:8080` (for local development)

## Important Technical Details

- The `projectcontext.md` file contains comprehensive technical specifications and should be consulted for detailed implementation requirements
- Composite documents require server-side validation to prevent cyclic dependencies
- All database schema changes must be implemented as Supabase migrations
- Frontend components follow project conventions established in existing pages like `ProjectDetailPage.tsx`