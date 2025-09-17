# Continuum: AI-Powered Writing Platform

A comprehensive AI-powered writing platform that serves as an intelligent "story bible," providing precise, dynamic, and contextually-aware information to assist writers in their long-form storytelling process. Features integrated AI chat, document versioning, advanced timeline management, and seamless collaboration tools.

## The Scene, and the Frustration

The cursor blinks. It's 2 AM, and you're deep into chapter seventy-three of your epic fantasy series. Your protagonist, Elara, a cynical war orphan turned formidable spy, is about to have a clandestine meeting with a mentor she hasn't seen in a decade. The emotional weight of this scene rests on a mountain of history.

You turn to your AI writing partner, ready to draft the dialogue. But first, the ritual of context-building begins. You need the AI to remember:

* Elara's core personality: her distrust of authority, stemming from the betrayal that led to her parents' death.

* The significance of the silver locket she always wears, a memento from her mother.

* The mentor's complex history: he was once her father's best friend, but went into hiding after the betrayal, leaving many to think him a coward.

* The specific events of their last encounter ten years ago, a brief, cryptic warning given in a crowded market.

You face the daunting task of context gathering, with crucial scenes scattered across 72 previously written chapters and character backgrounds hiding in your sprawling 200-page document of notes. Desperate and exhausted, you first try the brute force approach—dumping entire chapters and your complete notes document into the AI. 

The response costs a small fortune in tokens and is... fine. Technically correct, but hollow. The dialogue is generic. The AI misses the subtle undercurrent of resentment and longing in Elara's voice because it doesn't truly understand the subtext. Even worse, it has her mention an event from a different character's backstory, a continuity error that sends a chill down your spine.

Back to square one. You resign yourself to the copy-paste dance—two hours of meticulously hunting through your manuscript and notes, manually extracting relevant scenes, dialogue exchanges, and character details. You assemble them into a coherent context document, carefully arranging and annotating each fragment. By the time you finish this painstaking curation and get a usable AI response, your creative momentum has long since evaporated.

What if your story bible wasn't a dead archive? What if it were a living, intelligent partner in your storytelling?

## A New Continuum

Continuum was born from that frustration. It's a tool built on the belief that your world's lore should be as dynamic and accessible as your imagination. It starts by letting you manage each of your stories in its own, self-contained universe on a clean, simple dashboard. Your sprawling fantasy epic will never bleed into your hardboiled sci-fi noir.

Within each project, you work the way writers naturally think—in scenes, moments, and character beats, not massive chapter files. As you craft your epic fantasy, you're no longer trapped in monolithic documents where crucial details get buried. 

Remember that frustrating 2 AM hunt for Elara's backstory? Those days are gone. Now, as you develop her world, you create natural story fragments—her childhood in the war-torn province, the day she discovered her parents' betrayal, her first meeting with the mentor. Each becomes its own small document, tagged and linked to timeline events.

Later, when you're deep in chapter seventy-three and need that perfect reference to her past, you simply filter for "Elara + backstory" and watch as every relevant scene materializes before you. No more frantic searching, no more lost creative momentum.

But Continuum truly shines when confronting the writer's eternal struggle with detail management. That comprehensive 20-page document detailing Elara's childhood? Too overwhelming when you just need to reference her relationship with her father.

This is where Continuum's AI Transform feature becomes invaluable. Simply select that detailed document, choose your "Summarization" prompt template, and instantly transform it into different versions—a thoughtful summary for scene planning or a one-line essence for quick dialogue reference. Each version is automatically stored within your project, ready to be referenced whenever needed.

Need to update Elara's psychological profile after writing a pivotal scene that changes her outlook? Instead of manually revising multiple documents, open an AI chat with both her current profile AND the new scene as context. "Update Elara's psychological profile based on how this confrontation with her uncle changed her," you type. The AI analyzes both documents together and suggests comprehensive updates that maintain continuity with her established character while incorporating this new development.

As you write more scenes involving Elara's trust issues evolving, simply add each relevant document to your AI chat context: "Given these three scenes showing Elara's gradual change, help me update her psychological profile." The AI integrates all this information, providing you with coherent character development that honors every moment you've written.

As your narrative universe expands, you organize Elara's world in the way storytellers naturally think. Her psychological profile with all its complexity, her physical appearance that evolves throughout the story, her distinctive speech patterns that reveal her origins, and pivotal moments in her history—each becomes its own document, all nested within an "elara_docs" group.

When crafting that critical reunion scene, instead of dumping entire character histories into your AI prompt, you create a Composite Blueprint. You title it "Elara Meets Mentor - Scene Context". Its content isn't a wall of text you manually maintain, but an elegant template:

> #### Scene Context: A clandestine meeting in the port city of Kai's Landing.

> Protagonist Mindset: Elara  

> {{group:elara_docs:psychological}} - Focus on trust issues and abandonment

> Relevant History:  

> {{group:mentor_history:summary}} - His role in her past  

> {{group:mentor_meeting_5126:full}} - What happened ten years ago

> Key Items:  

> {{group:items:silver_locket}} - Physical reminder of loss

Each {{...}} is a living link. When creating your composite, you SELECT which specific document from each group to include—the detailed analysis or just a quick summary, depending on what the scene requires. There is no copy-pasting. You are not duplicating information; you are dynamically assembling exactly what you need. If you update any source document, your composite blueprint automatically reflects those changes.

Now, let's revisit that 2 AM writing session. Instead of the chaotic copy-paste dance, you open your composite blueprint and start an AI chat about this document. "Help me write dialogue for this reunion scene," you type. The AI receives the perfectly assembled context—Elara's psychological state, the mentor's history, their last meeting, the significance of the locket—all woven together coherently.

Everything connects. Chat documents can reference other chat documents. Transformations create new grouped documents. Your timeline helps you find exactly what's relevant for any moment in your story. Your composite blueprints pull it all together into perfect context packages.

You hit 'generate' again. This time, the magic is there. The dialogue crackles with the unspoken history between the characters. Elara's cynicism is sharp, but undercut with a flicker of the hope she'd long buried. It's perfect—because the AI had access to your story bible not as scattered fragments, but as an intelligent, interconnected knowledge system.

This is Continuum. It's not just a place to store your notes. It's an engine that turns your story bible from a static reference into the dynamic, living context your creative process deserves.

## Features

### Core Platform Features
* **User Authentication:** Full user sign-up and login with email/password and Google OAuth integration.
* **Project Management:** Complete collaboration system with role-based access control, member management, and secure invitation system.
* **AI Integration:** Universal chat system with multiple provider support (OpenAI, Google Vertex AI), user credits management, and dynamic model selection.

### Document Management System
* **Modern Document Interface:** Redesigned viewer with markdown rendering, hide/show functionality, and professional reading experience.
* **Document Types:** Static, composite, and AI prompt documents, or chat.
* **Document Groups:** Create derivative documents organized by groups with bidirectional assignment and intelligent type selection.
* **Composite Documents:** Dynamic "blueprint" documents that assemble content from other documents using {{placeholder}} syntax.
* **Document History:** Complete versioning system with rollback capabilities, audit trails, and seamless restoration.
* **Advanced Tagging:** Comprehensive organization with color-coded tags, advanced filtering integration, and auto-inheritance from events.

### AI-Powered Features
* **Universal AI Chat:** Document-context aware conversations with regeneration, provider tracking, and source integration.
* **Document Transformation:** AI-powered document modification using searchable template system and project-level configuration.
* **Multiple AI Providers:** Support for OpenAI, Google Vertex AI with dynamic model fetching and secure key management.
* **Usage Credits:** User credit system with transparent usage tracking and pricing management.

### Timeline & Event Management
* **Rewritten Timeline Architecture:** Centralized TimelineCalculator with collapsible time scales and enhanced visualization.
* **Event Dependencies:** Comprehensive dependency system with cycle detection, duration support, and client-side RLS compliance.
* **Advanced Timeline Controls:** Smart positioning, center-focused zoom, and enhanced pan/zoom with touch/trackpad support.
* **Event-Document Integration:** Auto-inheritance of document tags when creating events with seamless association management.
* **Datetime Precision:** Events converted to datetime format with fractional day precision for accurate scheduling.

### Collaboration & Presets
* **Advanced Preset System:** Recursive component resolution, namespaced overrides, and PDF export functionality.
* **Professional Interfaces:** Complete modal system with modern UX patterns and mobile optimization.
* **Secure API Architecture:** Backend API protected with JWT authentication, Row Level Security, and AI provider key management.
* **Automated Deployments:** Full CI/CD pipelines for frontend, backend, and database migrations.

## Architectural Overview

Continuum is a full-stack AI-powered application composed of four main components:

* **Frontend (React + Vite):** Web dashboard with AI chat interfaces, modern document viewer, and advanced timeline visualization.
* **Backend API (Node.js + TypeScript):** Serverless API handling complex operations, event dependencies, and preset generation.
* **AI Proxy System:** Comprehensive AI integration with multiple provider support, credit management, and structured message processing.
* **Database & Auth (Supabase):** PostgreSQL database with Row Level Security, user authentication, and AI request logging optimization.

## Getting Started

Prerequisites for development:

* Node.js
* TypeScript
* Google Cloud SDK (`gcloud`)
* A Supabase account

### API Development

1.  Navigate to the `/api` directory.
2.  Run `npm install` to install dependencies.
3.  You will need a `.env` file with `SUPABASE_URL` and `SUPABASE_ANON_KEY` to run locally with the Functions Framework.
4.  Run `npm run dev` to start the local development server.

### Dashboard Development

1.  Navigate to the `/dashboard` directory.
2.  Run `npm install` to install dependencies.
3.  Create a `.env.local` file and add your `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL=http://localhost:8080` for local development.
4.  Run `npm run dev` to start the local development server, typically available at `http://localhost:5173`.

## System Overview

**AI-Powered Writing Platform:**
- Universal AI chat system with document context integration and multiple provider support
- Document transformation workflows with searchable templates and project-level AI configuration
- User credits system with transparent usage tracking and secure provider key management
- AI request logging with performance optimization and structured message support

**Advanced Document Management:**
- Modern document viewer with markdown rendering and hide/show functionality
- Complete versioning system with rollback capabilities and audit trails
- Document types refactored to boolean flag architecture with AI prompt template support
- Enhanced tagging with auto-inheritance from events and advanced filtering integration
- Bidirectional group assignment utilities for improved relationship management

**Timeline System Architecture:**
- Complete timeline rewrite with centralized TimelineCalculator for all positioning
- Collapsible time scale visualization with smart positioning and center-focused zoom
- Comprehensive event dependency system with cycle detection and duration support
- Events converted to datetime format with fractional day precision
- Enhanced pan/zoom controls with touch/trackpad support and mobile optimization

**Collaboration & Integration:**
- Complete member management with role-based access control and secure invitation system
- Advanced preset system with recursive component resolution and PDF export
- Event-document relationship system with auto-tag inheritance and intuitive UX
- Professional modal interfaces with modern UX patterns throughout
- Mobile-first responsive design with comprehensive touch optimization

**Current Status:**
Production-ready AI-powered writing platform with comprehensive document management, timeline visualization, event dependencies, AI chat integration, and advanced collaboration tools.

## Testing

### Testing

**Frontend:** Vitest + React Testing Library with 103+ unit tests
```bash
cd dashboard && npm run test:run
```

**Backend:** Jest + Supertest with comprehensive API tests
```bash
cd api && npm test
```

## Contributing

We welcome contributions! If you're interested in helping with development, please start by reading the `projectcontext.md` file at the root of the repository. It contains the detailed technical specifications, architecture, and roadmap required for development.
