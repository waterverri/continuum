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

Continuum is a full-stack AI-powered writing platform with four main components:

**Frontend (React + Vite)**: Web dashboard deployed to Firebase Hosting. Handles user authentication, direct CRUD operations with Supabase using Row Level Security, and AI chat interfaces.

**Backend (Node.js + TypeScript)**: Serverless API deployed to Google Cloud Run. Handles complex server-side logic including the "Preset Engine", AI proxy system, and event dependency management.

**AI Proxy System**: Comprehensive AI integration with multiple provider support (OpenAI, Google Vertex AI), user credits management, and structured message processing for chat and document transformation.

**Database (Supabase/PostgreSQL)**: Handles data persistence, user authentication, authorization via Row Level Security policies, and AI request logging with performance optimization.

## Data Access Patterns

**Frontend → Supabase Direct**: Standard CRUD operations use supabase-js client directly. Security enforced by RLS policies in migrations.

**Frontend → Backend API → Supabase**: Complex operations (preset context generation, event dependencies, AI chat) go through backend APIs.

**Frontend → AI Proxy → External Providers**: AI chat, document transformation, and content generation use the AI proxy system with credit management and provider abstraction.

## Key Data Model Concepts

**Project-Based Isolation**: All data is scoped to projects via `project_id` foreign keys. Users access projects through the `project_members` table with role-based permissions.

**Document Relationships**: The `documents` table supports multiple relationship patterns:
1. **Derivative**: Documents grouped by `group_id` with different document types
2. **Composite**: Dynamic documents with `is_composite=true` that resolve content from other documents via `components` JSONB field
3. **Event Links**: Many-to-many relationships between events and documents via `event_documents` join table with automatic tag inheritance
4. **Prompt Documents**: Special documents with `is_prompt=true` for AI chat and transformation templates
5. **Document History**: Full versioning system with rollback capabilities and audit trails

## Security & Authentication

- User identity managed by Supabase Auth
- Frontend uses supabase-js client with automatic JWT attachment
- Backend validates JWTs via Supabase `/auth/v1/user` endpoint
- Row Level Security policies enforce project-based data isolation
- AI provider keys managed securely in database with user-level isolation
- User credits system prevents unauthorized AI usage
- Never commit secrets - use environment variables for system keys

## Current Implementation Status

**Current System Features:**

**Core Infrastructure:**
- User authentication and project management with role-based access control
- Complete document management with static, composite, and prompt document support
- Professional responsive UI with modern document viewer and markdown rendering
- AI credits system with usage tracking and provider management

**Document System:**
- Modern document viewer with hide/show functionality and markdown rendering
- Document groups with derivative creation and bidirectional assignment
- Composite documents with recursive resolution and group references
- Comprehensive tagging system with advanced filtering integration
- Document history and versioning with rollback capabilities
- AI-powered document transformation and chat integration
- Text extraction and automatic document creation

**Events & Timeline:**
- Complete timeline architecture rewrite with centralized TimelineCalculator
- Collapsible time scale visualization with smart positioning
- Comprehensive event dependency system with cycle detection
- Events converted to datetime format with fractional day precision
- Interactive timeline with enhanced pan/zoom and center-focused controls
- Hierarchical event organization with parent-child relationships
- Auto-inheritance of document tags when creating events

**AI & Chat System:**
- Universal AI chat system with document context integration
- Multiple AI provider support (OpenAI, Google Vertex AI) with dynamic model fetching
- Project-level AI configuration with searchable model selection
- Chat message management with regeneration and provider tracking
- Document transformation system with template-based workflows
- AI request logging with performance optimization

**Collaboration & Presets:**
- Complete project member management with secure invitation system
- Advanced preset system with recursive component resolution
- PDF export functionality with professional styling
- Namespaced overrides for precise component control

**Current Status**: Production-ready AI-powered writing platform with comprehensive document management, timeline visualization, event dependencies, AI chat integration, and advanced collaboration tools.

## Environment Setup

API requires `.env` with:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- AI provider keys (configured per-project in database)
- Google Cloud service account for Vertex AI

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
- **Document Groups**: Support derivative relationships with bidirectional assignment utilities
- **Document Types**: Boolean flag architecture with `is_prompt` for AI templates
- **Tagging Architecture**: Many-to-many relationship design with auto-inheritance from events
- **Timeline Architecture**: Centralized TimelineCalculator with collapsible time scales
- **Event Dependencies**: Client-side dependency management with comprehensive cycle detection
- **AI Integration**: Proxy architecture with structured message support and credit management
- **Testing Approach**: Focus on unit tests for business logic validation
- **Document Versioning**: Complete history tracking with rollback functionality
- **Security**: Backend APIs for administrative operations, RLS for data isolation, secure AI key management
**Current System Capabilities:**

**AI-Powered Writing Assistant**: Universal chat system with document context, multiple provider support, transformation templates, and usage credits

**Advanced Timeline Management**: Rewritten architecture with collapsible time scales, event dependencies, cycle detection, and centralized calculations

**Document Versioning**: Complete history tracking with rollback capabilities, audit trails, and seamless restoration

**Enhanced Document Interface**: Modern viewer with markdown rendering, hide/show controls, and advanced tag filtering integration

**Project Collaboration**: Complete member management with role-based access control and secure invitation system

**Advanced Presets**: Recursive component resolution, namespaced overrides, PDF export, and enhanced group references

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
│   ├── DocumentViewer.tsx          # Modern document display with markdown rendering
│   ├── DocumentList.tsx            # Document lists with actions
│   ├── DocumentFilters.tsx         # Advanced filter components with tag integration
│   ├── DocumentPickerModal.tsx     # Document selection modal
│   ├── ComponentKeyInputModal.tsx  # Component key input
│   ├── DerivativeModal.tsx         # Derivative document creation
│   ├── PresetPickerModal.tsx       # Preset creation flow
│   ├── GroupSwitcherModal.tsx      # Group type switching
│   ├── TagManager.tsx              # Tag CRUD operations
│   ├── TagSelector.tsx             # Document-tag associations
│   ├── TagFilter.tsx               # Tag-based filtering
│   ├── EventsWidget.tsx            # Inline event management with document actions
│   ├── EventTimelineModal.tsx      # Rewritten timeline with collapsible scales
│   ├── EventDependencyModal.tsx    # Event dependency management with cycle detection
│   ├── EventSelector.tsx           # Document-event associations
│   ├── EventFilter.tsx             # Event-based filtering
│   ├── DocumentEvolution.tsx       # Document version management across events
│   ├── DocumentHistoryModal.tsx    # Document history with rollback functionality
│   ├── AIChatModal.tsx             # Universal AI chat with document context
│   └── TransformModal.tsx          # AI document transformation with templates
├── hooks/
│   ├── useProjectDetailState.ts    # Centralized state management
│   ├── useDocumentOperations.ts    # Business logic & API calls
│   ├── useDocumentFilter.ts        # Advanced filtering logic
│   ├── useAIChat.ts               # AI chat and transformation logic
│   └── useTimelineCalculations.ts  # Centralized timeline calculations
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

1. **Complete AI Integration**: Universal chat system with multiple provider support, user credits, dynamic model fetching, and document transformation workflows

2. **Timeline System Rewrite**: Centralized architecture with collapsible time scales, enhanced pan/zoom, and smart positioning algorithms

3. **Event Dependency Management**: Comprehensive dependency system with cycle detection, duration support, and client-side RLS compliance

4. **Document Versioning System**: Complete history tracking with rollback capabilities, audit trails, and seamless restoration

5. **Enhanced Document Interface**: Modern viewer with markdown rendering, hide/show functionality, and advanced tag filtering integration

6. **Document Type Architecture**: Refactored to boolean flag system with `is_prompt` for AI templates and improved type management

**Architectural Evolution:**
The system has evolved from a document management platform to a comprehensive AI-powered writing assistant. Major architectural changes include:

- **AI-First Architecture**: Complete integration of AI chat and transformation systems with secure provider management
- **Timeline System Rewrite**: Centralized calculations and collapsible visualizations replacing fragmented positioning logic
- **Event Dependency Graph**: Full dependency management with cycle detection and intelligent scheduling
- **Document Versioning**: Complete history tracking system with rollback capabilities
- **Modern UI/UX**: Document viewer redesign with markdown rendering and advanced filtering

The codebase demonstrates production-ready patterns with comprehensive testing, security validation, AI provider management, and responsive design throughout all interfaces.