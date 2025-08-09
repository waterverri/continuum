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
- **Frontend**: Vitest + React Testing Library with focused unit tests for core functionality
- **Backend**: Jest + Supertest for API endpoints, services, and middleware testing
- **Test Strategy**: Prioritizes unit tests for business logic validation, production testing for integration scenarios
- **Coverage**: Core functionality verified through targeted unit tests with clean mock architecture
- **Current Status**: 103 unit tests passing across components, hooks, and utilities  
- **Testing Philosophy**: Test behavior, not implementation details; focus on user interactions and business logic

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
- **Refactored Document Filtering System** with reusable components:
  - `useDocumentFilter` custom hook for shared filtering logic
  - Modular filter components (search, type, format filtering)
  - Enhanced sidebar with comprehensive search and filtering capabilities
  - Performance optimizations with memoization
- **Document Group Management System**:
  - Derivative document creation with free-form document types
  - Group-based component selection in composite documents
  - Group type switching UI with advanced modal interfaces
  - Backend group APIs with intelligent document resolution
  - Extended group reference format: `group:groupId:preferredType`
- **Comprehensive Tagging System**:
  - Full-stack tagging implementation with many-to-many relationships
  - TagManager modal for creating, editing, and deleting project tags with color picker
  - TagSelector modal for document-tag associations with intuitive UI
  - Enhanced document filtering with tag-based search capabilities
  - Complete REST API with CRUD operations and validation
  - Row Level Security policies for multi-tenant tag access
  - Comprehensive test coverage (48 tests across frontend and backend)
- **Fully Refactored ProjectDetailPage Architecture**:
  - Modular component architecture with 83% code reduction (1,776 → 303 lines)
  - Custom hooks for state management (`useProjectDetailState`) and operations (`useDocumentOperations`)
  - 10 extracted reusable components (DocumentForm, DocumentViewer, modals, etc.)
  - Comprehensive CSS design system with variables, utilities, and component-specific styles
  - Maintained full test compatibility (32 tests passing) with improved maintainability
- Focused unit test suite for core functionality validation
- CI/CD pipelines for automated deployment

**Next**: Project member management, preset engine for dynamic context generation

**Latest Achievement**: Professional project management timeline with industry-standard Gantt chart functionality, interactive event creation, and comprehensive document integration - transforming Continuum into a complete story development platform.

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
- **Component Architecture**: Follow the established patterns in `ProjectDetailPage.tsx` for component composition, custom hooks, and state management
- **Styling Convention**: Use the CSS design system with variables, utilities, and component-specific styles
- **Code Organization**: Prefer small, focused components (under 200 lines) with single responsibilities over large monolithic files
- **Document Groups**: Support derivative relationships via `group_id` with dynamic type selection in composite documents
- **Group Reference Format**: Extended format `group:groupId:preferredType` enables specific document type selection within groups
- **Tagging Architecture**: Many-to-many relationship design with `tags`, `document_tags`, and `event_tags` tables for flexible content organization
- **Tag Management**: Project-scoped tags with color coding, comprehensive CRUD operations, and real-time UI updates
- **Tag Filtering**: Integrated tag-based filtering extends existing document search with multiple selection support
- **Testing Approach**: Focus on unit tests for business logic validation rather than complex integration testing with mocks
- **Document Evolution**: Simplified approach using existing systems:
  - Evolution discovery through documents with event associations (via `event_documents` table)
  - Leverages existing `group_id` system to group related document versions  
  - DocumentEvolution component shows all documents in same group and their event associations
  - Direct Supabase queries for efficiency - no complex backend API calls needed
  - Advanced recursive evolution queries (evolution "through Event X") reserved for future implementation
  - UI accessible via document dropdown "🔄 Evolution" option
- **✅ COMPLETED: Interactive Events & Timeline System**: 
  - **Professional Timeline Interface**: Full-screen Gantt chart modal with professional project management capabilities
  - **Complete Events Management**: Hierarchical parent-child event relationships with comprehensive CRUD operations
  - **Interactive Timeline Features**:
    - Advanced pan and zoom controls (0.25x-5x zoom range with reset and fit-to-view)
    - Click-to-create events with double-click functionality and precise time positioning
    - Parent-child event group collapsing with visual hierarchy controls
    - Real-time timeline manipulation with drag-based panning and scroll wheel zoom
  - **Document Management Integration**: 
    - View/edit/delete buttons for documents within event details
    - Seamless document operations accessible from timeline interface
    - Event-document associations with comprehensive relationship management
  - **Enhanced User Experience**:
    - Professional glassmorphism UI design with smooth transitions
    - Responsive controls with visual feedback (cursor changes, hover states)
    - Hash-based consistent color coding for event identification
    - Intuitive double-click creation with modal form interface
  - **Technical Implementation**:
    - Full backend API with 17 endpoints supporting CRUD operations, hierarchies, and document evolution
    - Advanced coordinate-to-time calculations accounting for zoom/pan transformations
    - Comprehensive state management with React hooks and TypeScript interfaces
    - Database migrations with cycle detection to prevent circular event dependencies
    - 103+ comprehensive unit tests validating all interactive functionality

## Frontend Architecture Patterns

### Component Structure
The application follows a modular component architecture with clear separation of concerns:

**Pages**: Top-level route components (e.g., `ProjectDetailPage.tsx`)
- Orchestrate data loading and high-level state management
- Compose feature-specific components
- Handle routing and navigation

**Components Directory Structure**:
```
src/
├── components/
│   ├── DocumentForm.tsx           # Document creation/editing
│   ├── DocumentViewer.tsx          # Document display
│   ├── DocumentList.tsx            # Document lists with actions
│   ├── DocumentFilters.tsx         # Reusable filter components
│   ├── DocumentPickerModal.tsx     # Document selection modal
│   ├── ComponentKeyInputModal.tsx  # Component key input
│   ├── DerivativeModal.tsx         # Derivative document creation
│   ├── PresetPickerModal.tsx       # Preset creation flow
│   ├── GroupSwitcherModal.tsx      # Group type switching
│   ├── TagManager.tsx              # Tag CRUD operations
│   ├── TagSelector.tsx             # Document-tag associations
│   ├── TagFilter.tsx               # Tag-based filtering
│   ├── EventsWidget.tsx            # Inline event management with document actions
│   ├── EventTimelineModal.tsx      # Professional Gantt chart timeline with interactive features
│   ├── EventSelector.tsx           # Document-event associations
│   ├── EventFilter.tsx             # Event-based filtering
│   └── DocumentEvolution.tsx       # Document version management across events
├── hooks/
│   ├── useProjectDetailState.ts    # Centralized state management
│   ├── useDocumentOperations.ts    # Business logic & API calls
│   └── useDocumentFilter.ts        # Filtering logic
└── styles/
    ├── variables.css               # Design system tokens
    ├── utilities.css               # Utility classes
    ├── layout.css                  # Layout and responsive styles
    └── components/                 # Component-specific styles
```

### CSS Architecture
**Design System Approach**:
- CSS custom properties for consistent theming
- Utility classes for rapid development
- Component-scoped styles for encapsulation
- Mobile-first responsive design
- Consistent spacing, typography, and color scales

**Import Structure**: All component styles are imported through the main CSS file using `@import` statements for optimal bundling.

### Custom Hooks Pattern
**State Management**: `useProjectDetailState` centralizes all component state with typed actions
**Business Logic**: `useDocumentOperations` handles API calls and complex operations
**Feature Logic**: `useDocumentFilter` provides reusable filtering capabilities

## Development Guidelines for New Features

### Component Development
1. **Keep components focused**: Each component should have a single, clear responsibility
2. **Use custom hooks**: Extract complex state logic and API operations into custom hooks
3. **Follow naming conventions**: Use descriptive names that clearly indicate purpose
4. **Leverage design system**: Use CSS variables, utilities, and established patterns
5. **Write tests**: Focus on unit tests for business logic and component behavior

### When Adding New Features
1. **Check existing patterns**: Look at `ProjectDetailPage.tsx` and its related components for established patterns
2. **Reuse components**: Before creating new components, check if existing ones can be extended or composed
3. **Use type safety**: Ensure all TypeScript types are properly defined and used
4. **Follow CSS architecture**: Place styles in appropriate component-specific files using the design system
5. **Test thoroughly**: Run `npm run test:run` and `npm run build` before committing changes

## Recent Refactoring (2025)
The ProjectDetailPage underwent a major architectural refactoring that serves as the template for all future development:
- **Component Extraction**: Large monolithic components were broken down into focused, reusable components
- **Custom Hooks**: State management and business logic were extracted into custom hooks for better separation of concerns
- **CSS Modularization**: Styles were organized into a comprehensive design system with variables, utilities, and component-specific modules
- **Type Safety**: Full TypeScript coverage with proper type definitions throughout
- **Testing Maintained**: All existing tests continue to pass, ensuring no regressions

This refactoring demonstrates the preferred architecture for complex UI components in this codebase.