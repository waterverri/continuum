# Project Context: Continuum (The Writer's Context Engine)
**Last Updated:** June 14, 2025 at 3:02 PM WIB

---
### **About This Document (`projectcontext.md`)**

**Purpose:** This document is the primary, centralized context file for any AI or LLM assistant collaborating on this project. Its goal is to provide a complete, up-to-date understanding of the project's vision, architecture, feature status, and file structure at all times.

**How to Use:** Before performing any task (writing code, suggesting features, creating documentation), the AI assistant must first refer to this document to ensure its understanding is current.

**Maintenance and Updates:**
* This document must be updated whenever a new decision is made, a feature is added or changed, or the project's roadmap is modified.
* The AI assistant is responsible for proactively suggesting updates to this file as part of its responses after a significant change has been discussed. This ensures its own "memory" of the project remains accurate for future collaboration.
---

## 1. Project Background & Core Purpose

Continuum is a full-stack web application designed to solve a critical problem for writers who use Large Language Models (LLMs) for long-form, creative storytelling.

**The User Persona:** An author working on one or more large-scale projects (e.g., novels, series) with deep lore, complex character histories, and intricate plotlines.

**The Problem:** Standard LLM context windows are too small to hold the entire history of a long story. Providing large amounts of raw text is inefficient, costly, and introduces "noise" that degrades the quality of the LLM's output. The writer needs a way to provide surgically precise, relevant, and properly detailed context for any given scene or chapter they are working on.

**The Solution:** Continuum acts as a **personal, queryable story bible**. It allows the writer to manage all their projects from a single dashboard. For each project, they deconstruct their world into structured documents and events. They then use a visual "Preset Builder" to create complex "context packages." The system generates a simple, unique URL for each preset, which the writer can paste into their LLM prompt. The API at that URL then delivers a clean, concatenated plain-text response containing the exact context required.

## 2. System Architecture

The application consists of three primary components:

* **Frontend:** A web-based dashboard where the writer manages their projects. The entire UI is project-scoped.
* **Backend:** A serverless API built with **Node.js, Express, and TypeScript**, deployed on **Google Cloud Run**. It handles all data logic and serves the context presets.
* **Database:** A **Supabase (PostgreSQL)** instance for data persistence.

## 3. Data Model

The database schema is designed to be flexible and relational, organized around a top-level `projects` entity.

* `projects`: The container for a single story/title. (`id`, `user_id`, `name`)
* `documents`: Stores discrete text units like scenes, bios, or lore. Linked to one `project`. (`id`, `project_id`, `group_id`, `document_type`, `content`)
* `events`: Stores time-based occurrences with a user-defined numerical timeline. Linked to one `project`. (`id`, `project_id`, `name`, `time_start`, `time_end`)
* `tags`: A flexible, user-defined key-value store to link metadata to documents and events. (`id`, `document_id`/`event_id`, `key`, `value`)
* `presets`: Stores the complex filtering rules for each generated URL. Linked to one `project`. (`id`, `project_id`, `name`, `rules` (JSON))

## 4. Feature State

### 4.1. Completed (Conceptual Design Phase)

The following features have been fully discussed and their high-level design has been agreed upon:

* **Multi-Project Architecture:** The system is built to support multiple writing projects under a single user account.
* **User-Defined Tagging:** A flexible key-value system for metadata.
* **Event & Timeline Management:** A system for creating discrete, timed events using a generalized numbering system.
* **Document-Event Linking:** Documents can be linked to events to provide narrative descriptions.
* **Document Versioning:** Documents can be linked via a `group_id` to represent different versions of the same core idea.
* **Dashboard-driven Workflow:** The primary user interaction is through a web dashboard.
* **Visual Preset Builder:** A UI tool for creating "context packages."
* **Simple URL Endpoints:** The output of the Preset Builder is a simple, stable URL (`/context/:presetId`).
* **Dynamic Biography Generation:** A special preset type that can assemble a character's history on the fly.

### 4.2. Currently In Progress

* **Infrastructure Setup:** We are setting up the core project infrastructure.
    * **Task:** Implementing CI/CD pipeline for database migrations.
    * **Completed:** Initial `README.md` and `projectcontext.md` have been created.

### 4.3. Future Roadmap

1.  **Phase 1: Infrastructure & Backend Foundation**
    * **Setup Database CI/CD:** Implement the GitHub Actions workflow to automatically apply Supabase migrations on push to `main`.
    * **Finalize & Migrate Schema:** Solidify the database schema and create the initial migration files.
    * **Set up API Project:** Scaffold the Node.js/TypeScript/Express backend application.
    * **Initial Endpoints:** Create project-scoped CRUD endpoints for `projects`, `documents`, and `tags`.
2.  **Phase 2: Core Dashboard UI**
    * Build the project selection/management screen.
    * Implement the UI for creating/editing documents and their tags within a selected project.
3.  **Phase 3: Preset Engine**
    * Develop the "Preset Builder" UI.
    * Implement backend logic for saving and executing presets.
4.  **Phase 4: Advanced Features**
    * Implement the "Dynamic Biography" preset logic.
    * Implement the event management UI and timeline features.

## 5. Proposed File Mapping

This structure outlines where different pieces of logic and code will live.

```
/continuum-writer-context/
├── .env.example                # Template for environment variables (Supabase URL, API keys)
├── .gitignore
├── README.md                   # High-level project overview
├── projectcontext.md          # Detailed context for LLM collaboration (this file)
├── package.json                # Project dependencies and scripts (for both api/dashboard)
│
├── api/                        # Backend Node.js/Express API
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # Main server entry point (Express app setup)
│       ├── routes/             # API route definitions
│       │   ├── presets.ts      # Routes for /context/:id and managing presets
│       │   ├── documents.ts    # CRUD routes for documents
│       │   └── ...
│       ├── controllers/        # Logic to handle requests and send responses
│       │   ├── presetController.ts
│       │   └── documentController.ts
│       ├── services/           # Core business logic
│       │   ├── presetService.ts    # Logic for building and executing preset queries
│       │   ├── dynamicBioService.ts # Logic for the dynamic biography generation
│       │   └── ...
│       ├── db/                 # Database interaction layer
│       │   ├── supabaseClient.ts # Initializes and exports the Supabase client
│       │   └── queries.ts      # Complex SQL queries or query builder functions
│       └── utils/              # Shared utility functions
│
└── dashboard/                  # Frontend Web Application (e.g., React/Vite)
    ├── package.json
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx            # Main application entry point
        ├── App.tsx             # Root component with routing
        ├── pages/              # Top-level page components
        │   ├── ProjectSelectPage.tsx
        │   ├── DocumentEditorPage.tsx
        │   └── PresetBuilderPage.tsx
        ├── components/         # Reusable UI components (buttons, forms, layout)
        │   ├── layout/
        │   └── ui/
        ├── services/           # Functions for making API calls to the backend
        │   └── apiClient.ts
        └── state/              # Global state management (e.g., Zustand, Redux)
            └── projectStore.ts   # Store for the currently selected project
