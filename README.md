# Continuum: The Writer's Context Engine

A private, multi-project application designed to serve as an intelligent "story bible," providing precise, dynamic, and contextually-aware information to assist writers in their long-form storytelling process with Large Language Models (LLMs).

## About The Project

For authors writing epic stories with deep lore, hundreds of chapters, and complex character arcs, maintaining continuity when using an LLM is a major challenge. Standard context windows are too small, and providing raw text is inefficient and noisy.

Continuum solves this problem. It allows a writer to manage all of their different titles from a single dashboard. For each project, it functions as a powerful engine where the writer can deconstruct their world into a structured, queryable knowledge base. Through a user-friendly interface, the writer can create and manage presets that retrieve the exact context needed for any given scene—be it a character's history, a summary of past events, or the rules of a magic system.

The result is a simple, unique URL for each preset that can be fed directly to an LLM, providing it with a perfectly curated, concise, and relevant package of information for the correct story.

## Core Features

* **Multi-Project Organization:** Manage all your different stories and titles in one place. All documents, events, tags, and presets are scoped to a specific project.
* **Flexible Data Model:** Store documents, character bios, lore, location profiles, and more within each project.
* **User-Defined Tagging:** Create your own custom key-value tags for any document or event (e.g., `Bestiary: Dragon`, `Plotline: Crimson Amulet`).
* **Event & Timeline Management:** Track events with a generalized, numerical dating system that supports any custom calendar.
* **Document Versioning:** Link different versions of a document together (e.g., a `raw` scene and its `summary`) and retrieve the specific version you need.
* **Web Dashboard:** An intuitive user interface to manage your entire story bible, with a clear separation between projects.
* **Visual Preset Builder:** Create complex context "packages" by visually filtering and selecting information *from the currently active project*.
* **Simple, Shareable Endpoints:** The dashboard generates a single, simple URL for each preset.
* **Dynamic Biography Generation:** A special preset type that can automatically assemble a character's biography based on their chronological life events within a specific project.

## Architectural Overview

Continuum is a full-stack application composed of three main parts:

* **Frontend:** A web-based dashboard (likely built with a modern framework like React, Vue, or Svelte). The user selects a project upon login, and the entire session is scoped to that project.
* **Backend:** A serverless API using **Node.js, TypeScript, and the Google Cloud Functions Framework**, deployed as a container to **Google Cloud Run**. The API logic will enforce project-based data separation.
* **Database & Auth:** A **Supabase (PostgreSQL)** instance serves as the persistent data store. User authentication is handled by Supabase's built-in Auth service, which manages user identities. Our application extends this with a role-based access system on a per-project basis.

## Proposed Data Model

The database is structured around user identity and projects. All core data (`documents`, `events`, etc.) is isolated within a specific `project`. Access is controlled by a user's role within each project.

| Table             | Purpose                                                                                   | Key Fields                                                          | Relationships                                               |
| :---------------- | :---------------------------------------------------------------------------------------- | :------------------------------------------------------------------ | :---------------------------------------------------------- |
| **`profiles`** | Stores public user data.                                                                  | `user_id`, `display_name`, `avatar_url`                             | Linked 1-to-1 with Supabase's `auth.users` table.           |
| **`project_members`** | Assigns users to projects with specific roles.                                            | `project_id`, `user_id`, `role`                                     | `project_id` → `projects(id)` <br> `user_id` → `auth.users(id)` |
| `projects`        | The top-level container for a single story or title.                                      | `id`, `name`, `created_at`                                          |                                                             |
| `documents`       | Stores text content (a scene, a bio, a note).                                             | `id`, **`project_id`**, `group_id`, `document_type`, `content`      | `project_id` → `projects(id)`                               |
| `events`          | Stores timed events with a start and end date.                                            | `id`, **`project_id`**, `name`, `time_start`, `time_end`              | `project_id` → `projects(id)`                               |
| `tags`            | Stores flexible, user-defined key-value metadata.                                         | `document_id` or `event_id`, `key`, `value`                           | `document_id` → `documents(id)` <br> `event_id` → `events(id)` |
| `presets`         | Stores filtering rules for each generated URL.                                            | `id` (for URL), **`project_id`**, `name`, `rules` (JSON object)       | `project_id` → `projects(id)`                               |

## Getting Started

Prerequisites for development:

* Node.js
* TypeScript
* Google Cloud SDK (`gcloud`)
* A Supabase account

### API Development
To run the backend function locally:
1. Navigate to the `/api` directory.
2. Run `npm install` to install dependencies.
3. Run `npm run dev` to start the local development server.


## API Usage

The final product used by the writer is a simple URL generated by the dashboard. This URL is inherently linked to a project and will only ever return data from that project's context.

**Example Usage:**

* **Static Preset URL:** `https://continuum.your-domain.app/context/aK2jNfP8x`
    * Returns a pre-defined bundle of context from its parent project, concatenated into plain text.
* **Dynamic Biography URL:** `https://continuum.your-domain.app/context/bY8zQjA1x?as_of_time=10525`
    * Returns a plain text biography for a specific character, assembled on the fly from events and documents within that character's project, up to time `10525`.

## Project Roadmap

1.  **Phase 1: Backend Foundation & Database Schema**
    * **(Done)** Finalize and implement the Supabase database schema, including the `projects` table and all foreign key relationships.
    * **(Done)** Set up the initial Node.js/TypeScript serverless function project.
    * Create basic, project-scoped CRUD endpoints for documents and tags.
2.  **Phase 2: Core Dashboard UI**
    * Build the project selection/management screen.
    * Build the frontend for creating, viewing, and editing documents within the selected project.
    * Implement the dynamic tagging interface.
3.  **Phase 3: Preset Engine**
    * Develop the "Preset Builder" UI.
    * Implement the backend logic for saving and executing project-scoped presets.
4.  **Phase 4: Advanced Features**
    * Implement the "Dynamic Biography" preset type.
    * Refine the UI/UX and add support for custom calendar definitions per project.
