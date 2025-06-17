# Project Context: Continuum (For Developer & LLM Use)
**Last Updated:** June 17, 2025

---
### **About This Document**

**Purpose:** This document is the primary, centralized technical context file for any developer or LLM assistant collaborating on this project. Its goal is to provide a complete, up-to-date understanding of the project's vision, architecture, feature status, and file structure at all times.

**How to Use:** Before performing any task (writing code, suggesting features, creating documentation), you must first refer to this document to ensure your understanding is current.

**Maintenance and Updates:** This document must be updated whenever a technical decision is made, a feature's implementation changes, or the roadmap is modified. Proactively suggesting updates to this file is a key responsibility.
---

## 1. Core Technical Problem

The primary technical challenge is to design a system that can accept a unique identifier (for a "preset"), retrieve a complex set of related data from a PostgreSQL database based on predefined rules, concatenate it into a clean plain-text string, and serve it via a low-latency API endpoint. The system must be multi-tenant at a project level, ensuring strict data isolation between different writing projects, governed by a Role-Based Access Control (RBAC) system tied to user authentication.

## 2. System Architecture

The application consists of three primary components:

* **Frontend:** A web-based dashboard built with **Vite + React**. The entire UI is project-scoped after user login and project selection, and it is deployed to **Firebase Hosting**.
* **Backend:** A serverless API built with **Node.js and TypeScript, using the Google Cloud Functions Framework**. It is containerized with a Dockerfile and deployed on **Google Cloud Run**.
* **Database:** A **Supabase (PostgreSQL)** instance for data persistence.

## 3. Data Model & Authentication

### 3.1. Authentication and Access Control

* **Identity Provider:** User identity is managed by **Supabase's built-in Auth service** (`auth.users` table).
* **Authorization Model:** A **Role-Based Access Control (RBAC)** system is implemented via the `project_members` table. This table links a `user_id` to a `project_id` with a specific `project_role` (`owner`, `editor`, `viewer`).

### 3.2. Core Data Schema

All data is transactionally tied to a `project`. The `project_id` foreign key is the primary mechanism for data isolation.

| Table             | Purpose                                     | Key Fields                                      | Relationships                                               |
| :---------------- | :------------------------------------------ | :---------------------------------------------- | :---------------------------------------------------------- |
| **`profiles`** | Stores public user data.                    | `user_id`, `display_name`                       | Linked 1-to-1 with `auth.users(id)`.                        |
| **`project_members`**| Assigns users to projects with roles.       | `project_id`, `user_id`, `role`                 | `project_id` → `projects(id)` <br> `user_id` → `auth.users(id)` |
| **`projects`** | The container for a single story/title.     | `id`, `name`                                    |                                                             |
| **`documents`** | Stores discrete text units (scenes, bios).  | `id`, `project_id`, `group_id`, `document_type`, `content` | `project_id` → `projects(id)`                               |
| **`events`** | Stores time-based occurrences.              | `id`, `project_id`, `name`, `time_start`, `time_end` | `project_id` → `projects(id)`                               |
| **`tags`** | A key-value store for metadata.             | `id`, `document_id`/`event_id`, `key`, `value`  | `document_id` → `documents(id)` <br> `event_id` → `events(id)` |
| **`presets`** | Stores filtering rules for context URLs.    | `id`, `project_id`, `name`, `rules` (JSONB)     | `project_id` → `projects(id)`                               |

## 4. Feature State & Roadmap

### 4.1. Completed

* **Conceptual Design:** All features listed in the README have been conceptually designed.
* **v1 DB Schema:** The initial schema is defined in `supabase/migrations/0001_initial_schema.sql`.
* **CI/CD for DB:** GitHub Actions workflow (`db-migration.yml`) is set up to push Supabase migrations.
* **CI/CD for API:** GitHub Actions workflow (`api-deploy.yml`) is set up to deploy the API container to Google Cloud Run.
* **CI/CD for Frontend:** GitHub Actions workflow (`frontend-deploy.yml`) is set up to build and deploy the static frontend application to Firebase Hosting.
* **User Authentication:** A full authentication flow has been implemented.
    * **Backend:** API includes endpoints for email/password signup, login, and Google OAuth. A JWT-based middleware protects routes.
    * **Frontend:** UI for login/signup/Google login is complete. Client-side logic handles the Supabase session and provides an authenticated API utility.

### 4.2. Next Up: Phase 3 - Core Application CRUD

1.  **Implement Row Level Security (RLS) and Project Management:**
    * Activate and configure RLS policies on all data tables in Supabase (`projects`, `documents`, `events`, etc.).
    * Policies should ensure that users can only read/write data for projects where they are listed as a member in `project_members`.
    * The `role` in `project_members` should be used to define permissions (e.g., only `owner` or `editor` can write).
    * CRUD Endpoints for Project Creation, Deletion, and Access Sharing (Perhaps change ownership?)
    * Implement the UI for a user to create a new project.
    * Implement a project selection page/component for users with multiple projects.
2.  **API CRUD Endpoints:**
    * Build out the full, project-scoped CRUD (Create, Read, Update, Delete) endpoints for `documents`.
    * Ensure all data access in these endpoints respects the authenticated user's ID and their project roles.
    * Build the main dashboard view for listing, creating, and editing `documents` within the currently selected project.

## 5. Current File Structure

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
