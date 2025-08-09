# **Project Context: Continuum (For Developer & LLM Use)**

**Last Updated:** August 9, 2025

### **About This Document**

**Purpose:** This document is the primary, centralized technical context file for any developer or LLM assistant collaborating on this project. Its goal is to provide a complete, up-to-date understanding of the project's vision, architecture, feature status, and file structure at all times.

**How to Use:** Before performing any task (writing code, suggesting features, creating documentation), you must first refer to this document to ensure your understanding is current.

**Maintenance and Updates:** This document must be updated whenever a technical decision is made, a feature's implementation changes, or the roadmap is modified. Proactively suggesting updates to this file is a key responsibility.

## **1. Core Technical Problem**

The primary technical challenge is to design a system that can accept a unique identifier (for a "preset"), retrieve a complex set of related data from a PostgreSQL database based on predefined rules, concatenate it into a clean plain-text string, and serve it via a low-latency API endpoint. The system must be multi-tenant at a project level, ensuring strict data isolation between different writing projects, governed by a Role-Based Access Control (RBAC) system tied to user authentication.

## **2. System Architecture**

The application consists of three primary components:

  * **Frontend:** A web-based dashboard built with **Vite + React**. It handles all direct user authentication and simple CRUD operations against the database. It is deployed to **Firebase Hosting**.
  * **Backend:** A serverless API built with **Node.js and TypeScript, using the Google Cloud Functions Framework**. Its role is limited to handling complex, "platformized" features that require secure, server-side logic (e.g., the Preset Engine). It is deployed on **Google Cloud Run**.
  * **Database:** A **Supabase (PostgreSQL)** instance for data persistence, authentication, and authorization (Row Level Security).

### **2.1. Architectural Rationale & Decisions**

The current project structure, with separate package.json and .gitignore files for the api and dashboard directories, is a deliberate choice to support the following principles:

  * **Component Decoupling:** The API and Frontend are treated as strictly independent applications. This separation, enforced by distinct dependency lists and ignore rules, prevents changes in one component from inadvertently affecting the other. It supports independent development, testing, and deployment cycles, which is crucial for stability.
  * **Documentation Centralization:** This projectcontext.md file is maintained as the single, authoritative source of truth for all architectural and roadmap information. This strategy minimizes documentation overhead and prevents "documentation drift," where multiple README files could become inconsistent. Component-level READMEs are intentionally kept minimal to direct all contributors to this centralized document.

## **3. Data Model & Authentication**

### **3.1. Authentication and Access Control**

  * **Identity Provider:** User identity is managed by **Supabase's built-in Auth service** (auth.users table). The frontend dashboard handles all user sign-up and login flows directly using the supabase-js client library.
  * **Authorization Model:** A **Role-Based Access Control (RBAC)** system is implemented via the `project_members` table and enforced by PostgreSQL's **Row Level Security (RLS)** policies, as defined in the project's SQL migrations.

### **3.2. Data Access Patterns**

A hybrid approach is used for data access to optimize for performance and security.

#### **3.2.1. Frontend to Supabase (Primary CRUD)**

For all standard Create, Read, Update, and Delete (CRUD) operations, the frontend communicates **directly** with the Supabase API.

  * **Mechanism:** The React application uses the supabase-js client library. This client automatically attaches the logged-in user's JWT to every request.
  * **Security:** Supabase validates the JWT and uses the Row Level Security policies defined in `supabase/migrations/0002_implement_rls_policies.sql` and `supabase/migrations/0003_fix_project_members_policy.sql` to ensure users can only access data they are authorized to see.
  * **Rationale:** This is the most performant and straightforward approach for simple data operations, fully leveraging Supabase's capabilities as a Backend-as-a-Service (BaaS).

#### **3.2.2. Backend API (Complex "Platformized" Logic)**

The backend API is reserved for special cases that require complex, secure, or computationally intensive server-side logic.

  * **Mechanism:** The frontend will make standard fetch calls to specific endpoints on the backend API (e.g., GET /api/presets/:id/context).
  * **Authentication:** The backend API protects its endpoints using a custom middleware (`api/src/index.ts`) that validates the user's JWT by making a server-to-server call to the Supabase `/auth/v1/user` endpoint. This ensures that only authenticated users can access these special features.
  * **Rationale:** This pattern is used for features like the "Preset Engine," where building a complex query or concatenating large amounts of data on the client would be insecure and inefficient.

### **3.3. Core Data Schema**

All data is transactionally tied to a project. The `project_id` foreign key is the primary mechanism for data isolation.

| Table | Purpose | Key Fields | Relationships |
| :--- | :--- | :--- | :--- |
| **profiles** | Stores public user data. | user\_id, display\_name | Linked 1-to-1 with auth.users(id). |
| **project\_members**| Assigns users to projects with roles. | project\_id, user\_id, role | project\_id → projects(id) user\_id → auth.users(id) |
| **projects** | The container for a single story/title. | id, name | |
| **documents** | A dual-purpose entity for storing text units. (See Document Relationship Paradigm below). | id, project\_id, title, `group_id`, `document_type`, is\_composite, components (JSONB), `content` | project\_id → projects(id) |
| **events** | Stores time-based occurrences. | id, project\_id, name, time\_start, time\_end | project\_id → projects(id) |
| **event\_documents**| **(New)** The join table linking events to their related documents. | event\_id, document\_id | event\_id → events(id)\<br\>document\_id → documents(id) |
| **tags** | A key-value store for metadata. | id, document\_id/event\_id, key, value | document\_id → documents(id) event\_id → events(id) |
| **presets** | Stores filtering rules for context URLs. | id, project\_id, name, rules (JSONB) | project\_id → projects(id) |

### **3.4. Document Relationship Paradigm**

The `documents` table is the most complex entity. Relationships between documents, and between documents and other entities, are modeled in three distinct ways:

#### **1. Derivative Relationships (Implicit Grouping)**

  * **Purpose:** To link a source document with its derivatives (e.g., summaries, translations).
  * **Mechanism:** This is an implicit relationship managed by two columns on the `documents` table:
      * `group_id` (`uuid`): All documents in a "family" (the source and all its derivatives) share the same `group_id`.
      * `document_type` (`text`): This field defines the role of each document within the group (e.g., `'source_text'`, `'summary_short'`, `'translation_es'`).
  * **Characteristic:** This defines an unordered set of related documents. The application logic is responsible for querying by `group_id` to retrieve all members of a family.

#### **2. Composite Documents (Dynamic Assembly)**

  * **Purpose:** To create dynamic "blueprint" documents whose content is assembled from other documents at query time.
  * **Mechanism:** This is managed by three columns on the `documents` table:
      * `is_composite` (`boolean`): A flag that signals the document's content is not static. If `true`, the system must trigger the resolution logic.
      * `content` (`text`): For composite documents, this field acts as a template string containing placeholders (e.g., `{{chapter1}}`).
      * `components` (`jsonb`): A key-value map where keys match the placeholders in the `content` template and values are the `id`s of the documents to be resolved and injected. Example: `{"chapter1": "uuid-...", "chapter2": "uuid-..."}`.
  * **Characteristic:** This defines an ordered, structural, and directional dependency. The parent document's content is dynamically generated from its children.

#### **3. Event-to-Document Links (Many-to-Many)**

  * **Purpose:** To associate discrete `event` entities with the `document` entities that describe or relate to them.
  * **Mechanism:** A dedicated join table, `event_documents`.
  * **Characteristic:** This is a standard many-to-many relationship linking two distinct entity types.

## **4. Feature State & Roadmap**

### **4.1. Completed**

  * **Conceptual Design:** All features listed have been conceptually designed.
  * **v1 DB Schema & Triggers:** The initial schema and server-side helper functions are defined in `supabase/migrations/0001_initial_schema.sql`.
  * **CI/CD Pipelines:** Workflows for Database, API, and Frontend deployments are complete and operational.
  * **User Authentication:** A full authentication flow is implemented on the frontend.
  * **Row Level Security (RLS) & Project Management:**
      * **Database:** RLS policies are active for projects, `project_members`, and documents, ensuring users can only access data for projects they are a member of. This is defined in `0002_implement_rls_policies.sql` and `0003_fix_project_members_policy.sql`.
      * **Frontend UI & Logic:** The UI and logic for listing, creating, and deleting projects is complete. These actions call the Supabase API directly and rely on RLS for security.
  * **Phase 3: Complete Document Management System:**
      * **Database Schema:** Migration `0004_add_document_management_columns.sql` added `title`, `is_composite`, and `components` columns to the documents table.
      * **Backend API:** Full REST API implemented in `api/src/routes/documents.ts` with:
          * Document CRUD operations (GET, POST, PUT, DELETE) for individual projects
          * Document group management endpoints (GET /groups, GET /groups/:id, GET /groups/:id/resolve)
          * Cyclic dependency validation using DFS algorithm in `api/src/services/documentService.ts`
          * Document resolution engine for composite documents with recursive {{placeholder}} resolution
          * User-authenticated Supabase clients ensuring RLS compliance
      * **Frontend UI:** Complete document management interface in `ProjectDetailPage.tsx` with:
          * Mobile-responsive design with hideable sidebar navigation
          * Professional modal-based component selection (replacing browser prompts)
          * Document picker with advanced filtering (search, type, format)
          * Improved component management with visual document title display
          * Document viewer with raw content display and real-time template resolution
          * Error handling and loading states throughout
  * **Phase 4: Enhanced UX & Component Architecture (COMPLETED):**
      * **UI/UX Improvements:**
          * Responsive mobile-first design for all document management interfaces
          * Professional modal system replacing all browser prompt() dialogs
          * Document selection by title with content previews (users never see IDs)
          * Advanced filtering system with search, document type, and format filters
          * Improved header spacing and layout consistency
      * **Component Refactoring & Architecture:**
          * **Reusable Filtering System:** Extracted document filtering into modular, reusable components
          * **Custom Hook:** `useDocumentFilter` provides shared filtering logic with memoization for performance
          * **Modular Components:** `DocumentSearchInput`, `DocumentTypeFilter`, `DocumentFormatFilter`, `DocumentFilters`
          * **Consistent UI Components:** `DocumentList` and `DocumentListItem` with variant support for different contexts
          * **Enhanced Sidebar:** Added comprehensive search and filtering capabilities to sidebar navigation
          * **Performance Optimizations:** Memoized filtering operations and available types calculation
      * **Quality Assurance:**
          * **Focused Unit Testing:** Core business logic verified through targeted unit tests
          * **Clean Test Architecture:** Removed complex integration tests in favor of production validation
          * **Build Validation:** All TypeScript compilation errors resolved for deployment readiness
  * **Phase 5: Document Group Management System (COMPLETED):**
      * **Derivative Document Creation:**
          * Users can create derivative documents (summaries, translations, etc.) from any source document
          * Free-form document types with no system-imposed restrictions
          * Automatic group assignment using `group_id` for document families
          * Modal interface with source document information and custom type input
      * **Group-Based Composite Documents:**
          * Component type selector allowing choice between individual documents or document groups
          * Group picker modal showing representative documents and group metadata
          * Enhanced component display with group type indicators and document counts
          * Intelligent representative document selection (prefers source/original types)
      * **Advanced Group Type Switching:**
          * Group switcher modal for choosing specific document types within groups
          * Extended group reference format: `group:groupId:preferredType`
          * Auto mode vs. specific type selection with visual indicators
          * Real-time type switching without losing component configuration
      * **Backend Group API Infrastructure:**
          * `GET /api/documents/:projectId/groups` - List all document groups
          * `GET /api/documents/:projectId/groups/:groupId` - Get group documents  
          * `GET /api/documents/:projectId/groups/:groupId/resolve` - Resolve group content
          * Enhanced document resolution service supporting group references
          * Robust cycle detection validation for group-based dependencies
      * **Enhanced Document Resolution Engine:**
          * Support for group references with optional preferred types
          * Dynamic document selection based on type preferences
          * Fallback logic for missing types within groups
          * Seamless integration with existing composite document system

### **4.2. ✅ Completed: Phase 6 - Comprehensive Tagging System**

**Implementation Status:** COMPLETE - Full-stack tagging system successfully implemented and deployed.

**Database Schema:** 
  * **Migration 0005:** Redesigned tags architecture with proper many-to-many relationships
    - `tags` table: Project-scoped tag definitions with color coding
    - `document_tags` table: Many-to-many relationships between documents and tags
    - `event_tags` table: Ready for future events integration
  * **Migration 0006:** Complete RLS policies for multi-tenant tag access control

**Backend API (`/api/src/routes/tags.ts`):**
  * Full CRUD operations for tags with comprehensive validation
  * Document-tag association endpoints with conflict prevention
  * JWT authentication integration with existing middleware
  * Comprehensive error handling and user-friendly messages

**Frontend Components:**
  * **TagManager Modal:** Create, edit, delete project tags with color picker (10 predefined colors)
  * **TagSelector Modal:** Intuitive document-tag association management with real-time updates
  * **TagFilter Component:** Enhanced filtering integrated with existing document search
  * **Enhanced useDocumentFilter Hook:** Extended with tag-based filtering capabilities

**Key Features Implemented:**
  * Color-coded tags with professional UI design
  * Real-time tag filtering with multiple selection support
  * Project-scoped tag isolation with RLS enforcement  
  * Comprehensive validation (duplicate prevention, input sanitization)
  * Mobile-responsive design with touch-friendly interfaces
  * Integration with existing document management workflows

**Testing Coverage:**
  * **Frontend:** 32 comprehensive unit tests covering all components and hooks
  * **Backend:** 16 integration tests validating API endpoints and validation logic
  * **Build Validation:** Full TypeScript compliance and successful production builds

### **4.3. ✅ Completed: Phase 7 - Interactive Events & Timeline System**

**Implementation Status:** COMPLETE - Professional project management system with interactive timeline features successfully implemented and deployed.

**Database Schema Enhancements:**
  * **Migration 0007:** Core events system with hierarchical relationships and document evolution
    - `event_documents` table: Many-to-many relationships between events and documents
    - `event_hierarchy` table: Parent-child event relationships with cycle detection
    - Enhanced `events` table: Added `display_order` and `parent_event_id` columns
    - Enhanced `documents` table: Added `event_id` for document evolution tracking
  * **Migration 0008:** Comprehensive RLS policies for multi-tenant event access control

**Backend API Infrastructure:**
  * **17 Event API Endpoints:** Complete CRUD operations with advanced features
    - Basic CRUD: GET/POST/PUT/DELETE for events
    - Hierarchy Management: Parent-child relationship handling
    - Document Associations: Link/unlink documents to events
    - Timeline API: Chronological event ordering with hierarchy support
    - Document Evolution: Create and manage event-specific document versions
  * **Cycle Detection:** Prevents circular dependencies in event hierarchies
  * **JWT Authentication:** Integrated with existing middleware and RLS policies

**Professional Timeline Interface:**
  * **EventTimelineModal:** Full-screen Gantt chart with industry-standard project management features
    - **Advanced Pan & Zoom:** 0.25x-5x zoom range with smooth drag-based panning and visual feedback
    - **Click-to-Create Events:** Double-click timeline to create events with precise time positioning
    - **Interactive Timeline Controls:** Reset zoom, fit-to-view, and real-time pan offset display
    - **Parent-Child Collapsing:** Hierarchical event organization with expand/collapse functionality
    - **Hash-Based Color Coding:** Consistent, unique colors for each event based on ID hashing
  * **EventsWidget:** Redesigned inline event management
    - **Compact Interface:** Clean, professional design replacing modal-heavy workflows
    - **Document Integration:** Direct view/edit/delete buttons for event-associated documents
    - **Real-time Updates:** Live event management with comprehensive error handling

**Enhanced User Experience:**
  * **Professional UI Design:** Glassmorphism effects with smooth transitions and modern aesthetics
  * **Interactive Feedback:** Comprehensive cursor states (grab/grabbing/crosshair) and hover effects
  * **Coordinate Precision:** Advanced mouse-to-time calculations accounting for zoom/pan transformations
  * **Responsive Controls:** Touch-friendly interfaces with mobile-optimized interactions
  * **Visual Hierarchy:** Clear parent-child relationships with collapsible groups and child count indicators

**Key Features Implemented:**
  * **Event Hierarchies:** Events can have parent-child relationships (e.g., "Chapter 1" → "Morning Scene")
  * **Document Evolution:** Track how documents change over time through event-specific versions
  * **Interactive Timeline:** Professional Gantt chart with real-time manipulation capabilities
  * **Advanced Filtering:** Filter documents by associated events, separate base vs. event versions
  * **Document Management:** Comprehensive CRUD operations accessible directly from timeline interface
  * **Timeline Interaction:** Pan, zoom, click-to-create, and hierarchical organization in single interface

**Technical Implementation:**
  * **State Management:** Complex timeline state with pan/zoom/collapse states managed via React hooks
  * **Performance Optimization:** Memoized calculations and efficient rendering for smooth interactions
  * **Type Safety:** Comprehensive TypeScript interfaces for all timeline operations and event data
  * **Error Handling:** Robust validation and user feedback for all interactive operations

**Testing Coverage:**
  * **Backend:** 70 comprehensive API tests validating all endpoints and error conditions
  * **Frontend:** 103+ unit tests covering component behavior, user interactions, and interactive features
  * **Integration:** End-to-end workflow validation from event creation to timeline interaction

### **4.4. Next Up: Advanced Collaboration Features**

**Note:** With events system complete, the next phase focuses on user collaboration and advanced content generation features.

1.  **Project Member Management (Quick Win):**
      * **Frontend UI & Logic:** Build a project settings page where project owners can manage members (add/remove users, change roles) by inserting/deleting/updating rows in the `project_members` table.

### **4.4. Future: Phase 6 - The Core "Preset" Engine**

  * **API:**
      * Build CRUD endpoints for presets.
      * Implement the core logic for the preset engine: create the `GET /presets/:id/context` endpoint. This will read the preset's rules (JSONB), dynamically build a complex SQL query to fetch the relevant data (including recursively resolving composite documents), concatenate it into a clean string, and serve it as text/plain.
  * **Frontend:**
      * Design and build a "Preset Rule Builder" UI. This will allow users to intuitively create filter rules (e.g., "include all documents of type 'character' with tag 'protagonist'") that will be saved into the preset's `rules` field.

## **5. Current File Structure**

This structure outlines where the application's logic and code currently live.

```
/continuum/
├── api/                        # Backend Node.js Cloud Function
│   ├── package.json            # Dependencies including Jest, Supertest for testing
│   ├── tsconfig.json
│   ├── jest.config.js          # Jest testing configuration
│   ├── src/
│   │   ├── index.ts            # Main function entry point with Express routes & auth middleware
│   │   ├── db/                 # Database interaction layer
│   │   │   └── supabaseClient.ts
│   │   ├── routes/             # API route handlers
│   │   │   ├── documents.ts    # Document CRUD endpoints
│   │   │   ├── presets.ts      # Preset management endpoints  
│   │   │   ├── tags.ts         # Tag CRUD and document-tag association endpoints
│   │   │   └── events.ts       # Event CRUD, hierarchy management, and document evolution endpoints
│   │   └── services/           # Business logic layer
│   │       └── documentService.ts # Composite document resolution & validation
│   └── test/                   # Testing infrastructure
│       ├── setup.ts            # Jest configuration and mocks
│       ├── services/           # Service layer tests
│       ├── routes/             # API endpoint integration tests
│       │   ├── documents.test.ts
│       │   ├── presets.test.ts
│       │   ├── tags.test.ts    # Comprehensive tag API tests
│       │   └── events.test.ts  # Comprehensive events API tests
│       └── middleware/         # Authentication middleware tests
│
├── dashboard/                  # Frontend Web Application
│   ├── package.json            # Dependencies including Vitest, React Testing Library
│   ├── vitest.config.ts        # Vitest testing configuration
│   ├── firebase.json
│   └── src/
│       ├── accessors/          # Modules for direct Supabase data access
│       │   └── projectAccessor.ts
│       ├── components/        # Reusable UI components
│       │   ├── GroupSwitcherModal.tsx # Group type selection modal
│       │   ├── TagManager.tsx         # Tag CRUD modal with color picker
│       │   ├── TagSelector.tsx        # Document-tag association modal
│       │   ├── TagFilter.tsx          # Tag-based filtering component
│       │   ├── EventsWidget.tsx       # Redesigned inline event management with document actions
│       │   ├── EventTimelineModal.tsx # Professional full-screen Gantt chart with interactive features
│       │   ├── EventSelector.tsx      # Document-event association modal
│       │   ├── EventFilter.tsx        # Event-based filtering component
│       │   └── DocumentEvolution.tsx  # Document version management across events
│       ├── pages/              # Page-level components
│       │   ├── ProjectNavigationPage.tsx
│       │   └── ProjectDetailPage.tsx # Enhanced with group management, tagging, and modal interfaces
│       ├── hooks/              # Custom React hooks
│       │   └── useDocumentFilter.ts # Enhanced filtering logic with tag and event support
│       ├── styles/             # Component-specific CSS modules
│       │   └── ProjectDetailPage.css # Responsive design styles with tag UI
│       ├── test/               # Testing infrastructure
│       │   ├── setup.ts        # Test configuration and mocks
│       │   ├── test-utils.tsx  # Custom render functions and mock data
│       │   ├── components/     # Component tests
│       │   │   ├── DocumentFilter.unit.test.tsx
│       │   │   ├── TagManager.unit.test.tsx
│       │   │   ├── TagSelector.unit.test.tsx  
│       │   │   ├── TagFilter.unit.test.tsx
│       │   │   ├── EventManager.unit.test.tsx
│       │   │   ├── EventSelector.unit.test.tsx
│       │   │   └── EventFilter.unit.test.tsx
│       │   ├── hooks/          # Hook tests
│       │   │   └── useDocumentFilter.unit.test.tsx
│       │   └── accessors/      # Data accessor tests
│       ├── App.tsx             # Main component, handles routing & auth state
│       ├── Auth.tsx            # Login/Signup UI component
│       ├── main.tsx            # Application entry point
│       ├── supabaseClient.ts   # Initializes Supabase client for frontend
│       └── api.ts              # Utility for making calls to our backend API
│
└── supabase/
    ├── migrations/
    │   ├── 0001_initial_schema.sql         # Base tables, types, and triggers
    │   ├── 0002_implement_rls_policies.sql # Core RLS policies for projects & docs
    │   ├── 0003_fix_project_members_policy.sql # RLS policies for the members table
    │   ├── 0004_add_document_management_columns.sql # Document management enhancements
    │   ├── 0005_improve_tags_schema.sql    # Redesigned tagging system with many-to-many relationships
    │   ├── 0006_add_tags_rls_policies.sql  # Comprehensive RLS policies for tags and associations
    │   ├── 0007_events_system_enhancement.sql # Events system with hierarchies, associations, and document evolution
    │   └── 0008_events_rls_policies.sql    # Comprehensive RLS policies for events and associations
    └── config.toml
```
