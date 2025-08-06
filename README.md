# Continuum: The Writer's Context Engine

A private, multi-project application designed to serve as an intelligent "story bible," providing precise, dynamic, and contextually-aware information to assist writers in their long-form storytelling process with Large Language Models (LLMs).

## The Scene, and the Frustration

The cursor blinks. It’s 2 AM, and you’re deep into chapter seventy-three of your epic fantasy series. Your protagonist, Elara, a cynical war orphan turned formidable spy, is about to have a clandestine meeting with a mentor she hasn’t seen in a decade. The emotional weight of this scene rests on a mountain of history.

You turn to your AI writing partner, ready to draft the dialogue. But first, the ritual of context-building begins. You need the AI to remember:

* Elara’s core personality: her distrust of authority, stemming from the betrayal that led to her parents' death.
* The significance of the silver locket she always wears, a memento from her mother.
* The mentor’s complex history: he was once her father's best friend, but went into hiding after the betrayal, leaving many to think him a coward.
* The specific events of their last encounter ten years ago, a brief, cryptic warning given in a crowded market.

You open a sprawling, 200-page document of notes, a chaotic mix of timelines, character sketches, and discarded scenes. You begin the frantic copy-paste dance, desperately trying to assemble a coherent context block. The result is a jumbled mess of text. You feed it to the LLM, cross your fingers, and hit 'generate'.

The output is… fine. Technically correct, but hollow. The dialogue is generic. The AI misses the subtle undercurrent of resentment and longing in Elara's voice because it doesn’t truly *understand* the subtext. It has a collection of facts, not a tapestry of experience. Even worse, it has her mention an event from a different character's backstory, a continuity error that sends a chill down your spine. The flow is broken. The magic is gone.

What if your story bible wasn’t a dead archive? What if it were a living, intelligent partner in your storytelling?

## A New Continuum

**Continuum** was born from that frustration. It’s a tool built on the belief that your world's lore should be as dynamic and accessible as your imagination. It starts by letting you manage each of your stories in its own, self-contained universe on a clean, simple dashboard. Your sprawling fantasy epic will never bleed into your hardboiled sci-fi noir.

Within each project, you create living **documents**: a profile for Elara, a history of her village, a detailed description of the silver locket. You map out your entire history with a flexible **timeline**, creating discrete **events** like "The Sacking of Silverwood" at time `1052`.

But what about the scene itself? The context for "Elara Meets Mentor" isn't just one document; it's a mosaic of many.

With Continuum, you create a new kind of document—a **Blueprint**. You title it "Elara Meets Mentor - Scene Context". Its content isn't a wall of text you have to maintain. Instead, it’s a simple, elegant template that you compose:

> #### Scene Context: A clandestine meeting in the port city of Kai's Landing.
>
> **Protagonist Mindset: Elara**
> A cynical but resourceful spy, shaped by the loss of her parents. She trusts actions, not words, and harbors a deep-seated resentment for the mentor she believes abandoned her.
> *Full Profile: {{elara_character_profile}}*
>
> **Relevant History:**
> A summary of the last time they met, ten years prior during the Festival of Silver Sails.
> *Full Event Details: {{event_last_mentor_meeting}}*
>
> **Key Items:**
> Elara clutches the silver locket her mother gave her, a constant, physical reminder of her loss.
> *Description: {{item_silver_locket}}*

Each `{{...}}` is a living link to another document in your world. There is no copy-pasting. You are not duplicating information; you are **weaving it together**. If you update Elara's main profile, this blueprint is automatically updated the moment you next need it.

This blueprint document is what you save as a **Preset**.

Now, let's revisit that 2 AM writing session. Instead of the chaotic copy-paste, you open Continuum and simply retrieve the stable URL for your "Elara Meets Mentor" preset.

You turn back to your AI prompt. You delete the wall of jumbled text and paste in just that one line. The API at that URL delivers the perfectly assembled package. Continuum has followed your blueprint, resolving every link in an instant to create the exact context the LLM needs.

You hit 'generate' again. This time, the magic is there. The dialogue crackles with the unspoken history between the characters. Elara’s cynicism is sharp, but undercut with a flicker of the hope she’d long buried. It's perfect.

This is Continuum. It's not just a place to store your notes. It's an engine that turns your story bible from a static reference into the dynamic, living context your creative process deserves.

## Features

* **User Authentication:** Full user sign-up and login with email/password and Google.
* **Project Management:** Create, manage, and collaborate on writing projects with role-based access control.
* **Document Management:** Complete CRUD system for static and composite documents.
* **Composite Documents:** Dynamic "blueprint" documents that assemble content from other documents using {{placeholder}} syntax.
* **Cyclic Dependency Protection:** Server-side validation prevents infinite loops in document references.
* **Real-time Resolution:** View how composite documents resolve into final assembled content.
* **Secure API:** Backend API protected with JWT authentication and Row Level Security.
* **Automated Deployments:** Full CI/CD pipelines for the frontend, backend, and database migrations.

## Architectural Overview

Continuum is a full-stack application composed of three main parts:

* **Frontend:** A web-based dashboard built with a modern JavaScript framework.
* **Backend:** A serverless API using Node.js and TypeScript, deployed as a container to Google Cloud Run.
* **Database & Auth:** A Supabase (PostgreSQL) instance for the database and user authentication.

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
3.  Create a `.env.local` file and add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. For local development, also add `VITE_API_URL=http://localhost:8080`.
4.  Run `npm run dev` to start the local development server, typically available at `http://localhost:5173`.

## Current Implementation Status

### ✅ Completed Features

**Core Infrastructure:**
- **Full-stack architecture** with React frontend, Node.js API, and Supabase database
- **User authentication** with JWT-based security and Row Level Security (RLS)
- **Project management** with multi-tenancy and role-based access control

**Document Management System:**
- **Complete CRUD operations** for both static and composite documents
- **Composite document engine** with recursive {{placeholder}} resolution
- **Cyclic dependency validation** using DFS algorithms
- **Professional UI** with responsive design and mobile-first approach

**Enhanced User Experience:**
- **Modal-based interfaces** replacing browser prompts for better UX
- **Advanced document picker** with search, filtering, and content previews  
- **Responsive design** optimized for desktop, tablet, and mobile devices
- **Real-time content resolution** for composite documents

**Testing Infrastructure:**
- **Frontend testing** with Vitest + React Testing Library (30+ tests)
- **Backend testing** with Jest + Supertest (13+ tests)
- **Comprehensive coverage** of components, services, API endpoints, and middleware
- **Mock infrastructure** for all external dependencies

### 🚀 Next Phase: Events & Tagging
- Timeline-based event management
- Document-event relationships
- Metadata tagging system
- Project member management

## Testing

### Frontend Tests
```bash
cd dashboard
npm run test        # Run in watch mode
npm run test:run    # Run once
npm run test:ui     # Run with UI interface
npm run coverage    # Generate coverage report
```

### Backend Tests
```bash
cd api
npm test              # Run all tests
npm run test:watch    # Run in watch mode  
npm run test:coverage # Generate coverage report
```

## Contributing

We welcome contributions! If you're interested in helping with development, please start by reading the `projectcontext.md` file at the root of the repository. It contains the detailed technical specifications, architecture, and roadmap required for development.
