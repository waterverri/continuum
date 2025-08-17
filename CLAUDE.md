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
- **Frontend**: Vitest + React Testing Library (103+ unit tests)
- **Backend**: Jest + Supertest (comprehensive API testing)
- **Strategy**: Focus on business logic validation and user interactions

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

**Current System Features:**

**Core Infrastructure:**
- User authentication and project management with role-based access control
- Complete document management with static and composite document support
- Professional responsive UI with mobile-first design

**Document System:**
- Document filtering with reusable components and custom hooks
- Document groups with derivative creation and intelligent type selection
- Composite documents with recursive resolution and group references
- Comprehensive tagging system with color-coded organization
- Text extraction and automatic document creation

**Events & Timeline:**
- Professional Gantt chart with industry-standard project management features
- Interactive timeline with pan/zoom and touch/trackpad support
- Hierarchical event organization with comprehensive filtering

**Collaboration & Presets:**
- Complete project member management with secure invitation system
- Advanced preset system with recursive component resolution
- PDF export functionality with professional styling
- Namespaced overrides for precise component control

**Next**: Advanced preset rule builder interface, enhanced collaboration tools, document versioning system

**Current Status**: Production-ready story development platform with complete collaboration, preset, and event management systems.

## Environment Setup

API requires `.env` with:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Dashboard requires `.env.local` with:
- `VITE_SUPABASE_URL` 
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL=http://localhost:8080` (for local development)

## Important Technical Details

- The `projectcontext.md` file contains comprehensive technical specifications
- Composite documents use server-side validation to prevent cyclic dependencies
- All database schema changes implemented as Supabase migrations
- **Component Architecture**: Small, focused components with custom hooks for state management
- **Styling Convention**: CSS design system with variables, utilities, and component-specific styles
- **Document Groups**: Support derivative relationships with `group:groupId:preferredType` format
- **Tagging Architecture**: Many-to-many relationship design for flexible content organization
- **Testing Approach**: Focus on unit tests for business logic validation
- **Document Evolution**: Event-based document versioning with group relationships
- **Security**: Backend APIs for administrative operations, RLS for data isolation
**Current System Capabilities:**

**Interactive Events & Timeline**: Professional Gantt chart with pan/zoom controls, touch support, hierarchical organization, and real-time filtering

**Project Collaboration**: Complete member management with role-based access control and secure invitation system

**Advanced Presets**: Recursive component resolution, namespaced overrides, PDF export, and enhanced group references

**Document Operations**: Smart text extraction, automatic document creation, rename functionality, and professional modal interfaces

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

## Recent Major Achievements (2025)

**Complete System Implementation:**

1. **Project Collaboration Infrastructure**: Full member management with secure backend APIs, role-based access control, and invitation system

2. **Advanced Preset System**: Recursive component resolution, namespaced overrides, PDF export, and professional dashboard interface

3. **Enhanced Event Management**: Comprehensive tagging, advanced filtering, professional timeline interface with touch/trackpad support

4. **Document Operation Enhancements**: Text extraction, rename functionality, automatic document creation with relationship preservation

5. **Professional UI/UX**: Security-focused landing page, mobile optimization, touch support, and complete modal system

**Architectural Evolution:**
The system has evolved from component extraction and refactoring to complete feature implementation across all major subsystems. The codebase now demonstrates production-ready patterns with comprehensive testing, security validation, and mobile-first responsive design throughout all interfaces.

This evolution establishes the foundation for advanced features like preset rule builders and real-time collaboration tools.