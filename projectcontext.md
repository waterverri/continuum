# Project Context: Continuum (For Developer & LLM Use)
**Last Updated:** June 15, 2025

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

* **Frontend:** A web-based dashboard. The entire UI is project-scoped after user login and project selection.
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
* **API Scaffolding:** A basic Node.js/TypeScript Cloud Function has been created.

### 4.2. Next Up: Phase 1 - Foundation (Active)

1.  **Frontend Scaffolding:** Create the initial directory and file structure for the `dashboard/` application (e.g., using Vite + React).
2.  **Frontend CI/CD:** Create a new GitHub Actions workflow to build and deploy the static frontend application (e.g., to Firebase Hosting or Google Cloud Storage).
3.  **Authentication Setup:**
    * **Backend:** Implement Supabase Auth helpers to secure API endpoints. Create routes for user sign-up, login, and session management.
    * **Frontend:** Build the authentication UI (login/signup pages) and the client-side logic to handle JWTs.
4.  **Basic API Implementation:**
    * Create the foundational, project-scoped CRUD endpoints for `projects` and `documents`, ensuring they respect RBAC.
5.  **Basic Frontend Functionality:**
    * Implement the project selection page that appears after a user logs in.
    * Create a basic view to list documents from the selected project by calling the API endpoints.

## 5. Proposed File Structure

This structure outlines where different pieces of logic and code will live.
```
/continuum/
├── api/                        # Backend Node.js Cloud Function
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # Main function entry point
│       ├── routes/             # API route definitions
│       ├── controllers/        # Logic to handle requests
│       ├── services/           # Core business logic
│       ├── db/                 # Database interaction layer
│       │   ├── supabaseClient.ts # Initializes Supabase client
│       │   └── queries.ts      # Complex SQL queries
│       └── utils/
│
└── dashboard/                  # Frontend Web Application
│   └── ...
│
└── supabase/
├── migrations/
│   └── 0001_initial_schema.sql
└── config.toml
```
