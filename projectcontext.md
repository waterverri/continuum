Excellent point. Consolidating the descriptions of these complex relationships into a dedicated section will greatly improve the clarity of the technical documentation.

Here is the updated `projectcontext.md` with the new, dedicated section explaining the document relationship paradigm.

-----

# **Project Context: Continuum (For Developer & LLM Use)**

**Last Updated:** June 20, 2025

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

### **4.2. Next Up: Phase 3 Cont. - Core Application Logic & Document Management**

**Note:** The implementation of document management has evolved beyond simple CRUD and requires significant application-level logic.

1.  **Document Management:**

      * **Database Schema:** A new migration must be created to add the following columns to the `documents` table:
          * `title TEXT NOT NULL`
          * `is_composite BOOLEAN NOT NULL DEFAULT FALSE`
          * `components JSONB NULL`
      * **Backend Logic (New Requirement):** The creation and updating of composite documents are **not** simple CRUD operations. They require server-side logic, likely in a new Cloud Function, to ensure data integrity. This function must:
          * **Perform Cyclic Dependency Validation:** On every write operation for a composite document, the function must traverse the dependency graph defined in the `components` field to ensure the change does not create an infinite loop (e.g., Document A cannot contain Document B if B already contains A). This is a mandatory data integrity step.
      * **Application Logic (Reading):** A resolution engine must be built. When a document with `is_composite = true` is requested, this engine must:
        1.  Take the document's `content` as a master template.
        2.  Parse the `components` JSONB map (`{"key": "document_id", ...}`).
        3.  For each key, **recursively resolve the content** of the associated document ID.
        4.  Inject the resolved content into the template, replacing placeholders like `{{key}}`.
        5.  Return the final assembled string.
      * **Frontend UI & Logic:** Build the UI to manage both static and composite documents within `ProjectDetailPage.tsx`. This includes a standard text editor for static documents and a specialized "Component Editor" for composite documents to manage the template and component map.

2.  **Frontend CRUD for Project Members:**

      * **Frontend UI & Logic:** Build a project settings page where project owners can manage members (add/remove users, change roles) by inserting/deleting/updating rows in the `project_members` table.

### **4.3. Future: Phase 4 - Events & Tagging**

  * **Database Schema:** A new migration must be created to add the `event_documents` join table.
  * **Frontend UI & Logic:**
      * Build project-scoped CRUD UI for events.
      * Implement UI for creating links between events and documents via the `event_documents` table.
      * Implement UI for tags, allowing them to be attached to and detached from both documents and events.

### **4.4. Future: Phase 5 - The Core "Preset" Engine**

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
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # Main function entry point with Express routes & auth middleware
│       └── db/                 # Database interaction layer
│           └── supabaseClient.ts
│       # (New logic for composite document validation would go here)
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
    │   ├── 0001_initial_schema.sql         # Base tables, types, and triggers
    │   ├── 0002_implement_rls_policies.sql # Core RLS policies for projects & docs
    │   └── 0003_fix_project_members_policy.sql # RLS policies for the members table
    └── config.toml
```
