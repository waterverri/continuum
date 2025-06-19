# Project Context: Continuum (For Developer & LLM Use)

**Last Updated:** June 19, 2025

-----

### **About This Document**

**Purpose:** This document is the primary, centralized technical context file for any developer or LLM assistant collaborating on this project. Its goal is to provide a complete, up-to-date understanding of the project's vision, architecture, feature status, and file structure at all times.

**How to Use:** Before performing any task (writing code, suggesting features, creating documentation), you must first refer to this document to ensure your understanding is current.

## **Maintenance and Updates:** This document must be updated whenever a technical decision is made, a feature's implementation changes, or the roadmap is modified. Proactively suggesting updates to this file is a key responsibility.

## 1\. Core Technical Problem

The primary technical challenge is to design a system that can accept a unique identifier (for a "preset"), retrieve a complex set of related data from a PostgreSQL database based on predefined rules, concatenate it into a clean plain-text string, and serve it via a low-latency API endpoint. The system must be multi-tenant at a project level, ensuring strict data isolation between different writing projects, governed by a Role-Based Access Control (RBAC) system tied to user authentication.

## 2\. System Architecture

The application consists of three primary components:

  * **Frontend:** A web-based dashboard built with **Vite + React**. The entire UI is project-scoped after user login and project selection, and it is deployed to **Firebase Hosting**.
  * **Backend:** A serverless API built with **Node.js and TypeScript, using the Google Cloud Functions Framework**. It is containerized with a Dockerfile and deployed on **Google Cloud Run**.
  * **Database:** A **Supabase (PostgreSQL)** instance for data persistence.

### 2.1. Architectural Rationale & Decisions

The current project structure, with separate `package.json` and `.gitignore` files for the `api` and `dashboard` directories, is a deliberate choice to support the following principles:

  * **Component Decoupling:** The API and Frontend are treated as strictly independent applications. This separation, enforced by distinct dependency lists and ignore rules, prevents changes in one component from inadvertently affecting the other. It supports independent development, testing, and deployment cycles, which is crucial for stability.
  * **Documentation Centralization:** This `projectcontext.md` file is maintained as the single, authoritative source of truth for all architectural and roadmap information. This strategy minimizes documentation overhead and prevents "documentation drift," where multiple README files could become inconsistent. Component-level READMEs are intentionally kept minimal to direct all contributors to this centralized document.

## 3\. Data Model & Authentication

### 3.1. Authentication and Access Control

  * **Identity Provider:** User identity is managed by **Supabase's built-in Auth service** (`auth.users` table).
  * **Authorization Model:** A **Role-Based Access Control (RBAC)** system is implemented via the `project_members` table. This table links a `user_id` to a `project_id` with a specific `project_role` (`owner`, `editor`, `viewer`).

### 3.2. Backend JWT Validation

JWTs sent from the frontend client are validated on all protected API endpoints by a custom Express middleware located in `api/src/index.ts`.

* **Mechanism:** Instead of verifying the JWT signature locally, the middleware performs a server-to-server API call to the Supabase `/auth/v1/user` endpoint. It passes the client's JWT and the project's `ANON_KEY`. If Supabase returns a user object, the token is considered valid. If it returns an error (e.g., 401), the token is invalid, and access is denied.
* **Rationale:** This approach was chosen to simplify the backend architecture and reduce dependencies. It removes the need for the `express-jwt` and `jwks-rsa` libraries.
* **Trade-off:** The primary trade-off is performance. This method introduces network latency for every authenticated API request, as it requires a round-trip call to Supabase for validation. The previous JWKS-based approach was faster for subsequent requests after the initial key fetch.

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
  * **User Authentication:** A full authentication flow is implemented. Backend JWT validation is handled by a custom middleware making direct calls to the Supabase API.

### 4.2. Next Up: Phase 3 - Core Application CRUD

1.  **Implement Row Level Security (RLS) & Project Management:**
      * **Database:** Activate and write RLS policies for all data tables (`projects`, `documents`, `events`, etc.). Policies must enforce that users can only access data for projects they are a member of, respecting the `role` in `project_members` for write permissions.
      * **API Endpoints:**
          * `GET /projects`: List all projects a user is a member of.
          * `POST /projects`: Create a new project, automatically making the creator the `owner`.
          * `GET /projects/:id`: Get details for a single project.
          * `DELETE /projects/:id`: Delete a project (owner role required).
          * `POST /projects/:id/members`: Add a new member to a project (owner role required).
      * **Frontend UI:**
          * Implement a project selection page/component for users with multiple projects.
          * Implement the UI for a user to create a new project.
          * Build a project settings page to manage members.
2.  **API CRUD Endpoints for `documents`:**
      * **API Endpoints:** Build the full, project-scoped CRUD endpoints (GET list, GET one, POST, PUT, DELETE) for `documents`. Ensure all data access respects RLS.
      * **Frontend UI:** Build the main dashboard view for listing, creating, and editing `documents` within the currently selected project.

### 4.3. Future: Phase 4 - Events & Tagging

  * **API:**
      * Build project-scoped CRUD endpoints for `events`.
      * Build endpoints for `tags`, allowing them to be attached to and detached from both `documents` and `events`.
  * **Frontend:**
      * Implement UI for creating and managing `events`. Consider a timeline view.
      * Integrate tagging functionality into the `document` and `event` editing views.

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
│       ├── App.tsx             # Main component, handles session state
│       ├── Auth.tsx            # Login/Signup UI component
│       ├── main.tsx            # Application entry point
│       ├── supabaseClient.ts   # Initializes Supabase client for frontend
│       └── api.ts              # Utility for making authenticated API calls
│
└── supabase/
├── migrations/
│   └── 0001_initial_schema.sql
└── config.toml
```