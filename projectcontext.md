# Project Context: Continuum (For Developer & LLM Use)

**Last Updated:** June 20, 2025

-----

### **About This Document**

**Purpose:** This document is the primary, centralized technical context file for any developer or LLM assistant collaborating on this project. Its goal is to provide a complete, up-to-date understanding of the project's vision, architecture, feature status, and file structure at all times.

**How to Use:** Before performing any task (writing code, suggesting features, creating documentation), you must first refer to this document to ensure your understanding is current.

## **Maintenance and Updates:** This document must be updated whenever a technical decision is made, a feature's implementation changes, or the roadmap is modified. Proactively suggesting updates to this file is a key responsibility.

## 1\. Core Technical Problem

The primary technical challenge is to design a system that can accept a unique identifier (for a "preset"), retrieve a complex set of related data from a PostgreSQL database based on predefined rules, concatenate it into a clean plain-text string, and serve it via a low-latency API endpoint. The system must be multi-tenant at a project level, ensuring strict data isolation between different writing projects, governed by a Role-Based Access Control (RBAC) system tied to user authentication.

## 2\. System Architecture

The application consists of three primary components:

  * **Frontend:** A web-based dashboard built with **Vite + React**. It handles all direct user authentication and simple CRUD operations against the database. It is deployed to **Firebase Hosting**.
  * **Backend:** A serverless API built with **Node.js and TypeScript, using the Google Cloud Functions Framework**. Its role is limited to handling complex, "platformized" features that require secure, server-side logic (e.g., the Preset Engine). It is deployed on **Google Cloud Run**.
  * **Database:** A **Supabase (PostgreSQL)** instance for data persistence, authentication, and authorization (Row Level Security).

### 2.1. Architectural Rationale & Decisions

The current project structure, with separate `package.json` and `.gitignore` files for the `api` and `dashboard` directories, is a deliberate choice to support the following principles:

  * **Component Decoupling:** The API and Frontend are treated as strictly independent applications. This separation, enforced by distinct dependency lists and ignore rules, prevents changes in one component from inadvertently affecting the other. It supports independent development, testing, and deployment cycles, which is crucial for stability.
  * **Documentation Centralization:** This `projectcontext.md` file is maintained as the single, authoritative source of truth for all architectural and roadmap information. This strategy minimizes documentation overhead and prevents "documentation drift," where multiple README files could become inconsistent. Component-level READMEs are intentionally kept minimal to direct all contributors to this centralized document.

## 3\. Data Model & Authentication

### 3.1. Authentication and Access Control

  * **Identity Provider:** User identity is managed by **Supabase's built-in Auth service** (`auth.users` table). The frontend dashboard handles all user sign-up and login flows directly using the `supabase-js` client library.
  * **Authorization Model:** A **Role-Based Access Control (RBAC)** system is implemented via the `project_members` table and enforced by PostgreSQL's **Row Level Security (RLS)** policies.

### 3.2. Data Access Patterns

A hybrid approach is used for data access to optimize for performance and security.

#### 3.2.1. Frontend to Supabase (Primary CRUD)

For all standard Create, Read, Update, and Delete (CRUD) operations, the frontend communicates **directly** with the Supabase API.

* **Mechanism:** The React application uses the `supabase-js` client library. This client automatically attaches the logged-in user's JWT to every request.
* **Security:** Supabase validates the JWT and uses the Row Level Security policies defined in `supabase/migrations/0002_implement_rls_policies.sql` to ensure users can only access data they are authorized to see.
* **Rationale:** This is the most performant and straightforward approach for simple data operations, fully leveraging Supabase's capabilities as a Backend-as-a-Service (BaaS).

#### 3.2.2. Backend API (Complex "Platformized" Logic)

The backend API is reserved for special cases that require complex, secure, or computationally intensive server-side logic.

* **Mechanism:** The frontend will make standard `fetch` calls to specific endpoints on the backend API (e.g., `GET /api/presets/:id/context`).
* **Authentication:** The backend API protects its endpoints using a custom middleware (`api/src/index.ts`) that validates the user's JWT by making a server-to-server call to the Supabase `/auth/v1/user` endpoint. This ensures that only authenticated users can access these special features.
* **Rationale:** This pattern is used for features like the "Preset Engine," where building a complex query or concatenating large amounts of data on the client would be insecure and inefficient.

### 3.3. Core Data Schema

All data is transactionally tied to a `project`. The `project_id` foreign key is the primary mechanism for data isolation.

| Table | Purpose | Key Fields | Relationships |
| :--- | :--- | :--- | :--- |
| **`profiles`** | Stores public user data. | `user_id`, `display_name` | Linked 1-to-1 with `auth.users(id)`. |
| **`project_members`**| Assigns users to projects with roles. | `project_id`, `user_id`, `role` | `project_id` → `projects(id)` <br> `user_id` → `auth.users(id)` |
| **`projects`** | The container for a single story/title. | `id`, `name` | |
| **`documents`** | Stores discrete text units (scenes, bios). | `id`, `project_id`, `group_id`, `document_type`, `content` | `project_id` → `projects(id)` |
| **`events`** | Stores time-based occurrences. | `id`, `project_id`, `name`, `time_start`, `time_end` | `project_id` → `projects(id)` |
| **`tags`** | A key-value store for metadata. | `id`, `document_id`/`event_id`, `key`, `value` | `document_id` → `documents(id)` <br> `event_id` → `events(id)` |
| **`presets`** | Stores filtering rules for context URLs. | `id`, `project_id`, `name`, `rules` (JSONB) | `project_id` → `projects(id)` |

## 4\. Feature State & Roadmap

### 4.1. Completed

  * **Conceptual Design:** All features listed have been conceptually designed.
  * **v1 DB Schema:** The initial schema is defined in `supabase/migrations/0001_initial_schema.sql`.
  * **CI/CD Pipelines:** Workflows for Database, API, and Frontend deployments are complete and operational.
  * **User Authentication:** A full authentication flow is implemented on the frontend.

### 4.2. Next Up: Phase 3 - Core Application CRUD

1.  **Implement Row Level Security (RLS) & Project Management:**
      * **Database:** Activate and write RLS policies for all data tables (`projects`, `documents`, `events`, etc.). Policies must enforce that users can only access data for projects they are a member of, respecting the `role` in `project_members` for write permissions. *(This is complete)*
      * **Frontend UI & Logic:**
          * Implement logic to list all projects a user is a member of by calling Supabase directly.
          * Implement the UI for a user to create a new project, inserting directly into the `projects` table. The `assign_project_owner` trigger will handle making the creator the `owner`.
          * Build UI to get details for a single project.
          * Implement UI to delete a project (RLS will enforce owner role).
          * Build a project settings page to manage members by inserting/deleting from the `project_members` table.
2.  **Frontend CRUD for `documents`:**
      * **Frontend UI & Logic:** Build the full, project-scoped CRUD UI (list, get one, create, edit, delete) for `documents`. Ensure all data access calls the Supabase API directly and respects RLS.

### 4.3. Future: Phase 4 - Events & Tagging

  * **Frontend UI & Logic:**
      * Build project-scoped CRUD UI for `events`.
      * Implement UI for `tags`, allowing them to be attached to and detached from both `documents` and `events`.

### 4.4. Future: Phase 5 - The Core "Preset" Engine

  * **API:**
      * Build CRUD endpoints for `presets`.
      * Implement the core logic for the preset engine: create the `GET /presets/:id/context` endpoint. This will read the preset's `rules` (JSONB), dynamically build a complex SQL query to fetch the relevant data, concatenate it into a clean string, and serve it as `text/plain`.
  * **Frontend:**
      * Design and build a "Preset Rule Builder" UI. This will allow users to intuitively create filter rules (e.g., "include all documents of type 'character' with tag 'protagonist'") that will be saved into the preset's `rules` field.

## 5\. Current File Structure

This structure outlines where the application's logic and code currently live.

```
/continuum/
├── api/                        # Backend Node.js Cloud Function
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # Main function entry point with Express routes
│       └── db/                 # Database interaction layer
│           └── supabaseClient.ts # Initializes Supabase client
│
└── dashboard/                  # Frontend Web Application
│   ├── package.json
│   ├── firebase.json
│   └── src/
│       ├── accessors/          # Modules for direct Supabase data access
│       │   └── projectAccessor.ts
│       ├── pages/              # Page-level components
│       │   ├── ProjectNavigationPage.tsx
│       │   └── ProjectDetailPage.tsx
│       ├── App.tsx             # Main component, handles routing & auth state
│       ├── Auth.tsx            # Login/Signup UI component
│       ├── main.tsx            # Application entry point
│       ├── supabaseClient.ts   # Initializes Supabase client for frontend
│       └── api.ts              # Utility for making calls to our backend API
│
└── supabase/
├── migrations/
│   └── 0001_initial_schema.sql
│   └── 0002_implement_rls_policies.sql
└── config.toml
```