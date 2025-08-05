# Next Session Priorities

## Phase 4: Events & Tagging System

### Immediate Tasks (High Priority)

1. **Project Member Management (Quick Win - 1-2 hours)**
   - Create project settings page/modal in the frontend
   - Add UI to invite users by email to projects  
   - Add UI to manage existing member roles (owner, editor, viewer)
   - Add UI to remove members from projects
   - This uses existing `project_members` table and RLS policies

2. **Events System Foundation (3-4 hours)**
   - Create migration `0005_add_event_documents_table.sql` for the `event_documents` join table
   - Extend `ProjectDetailPage.tsx` with Events section alongside Documents
   - Build basic CRUD for events (create, list, edit, delete)
   - Add timeline visualization for events using `time_start` and `time_end` fields

### Medium Priority

3. **Event-Document Linking (2-3 hours)**
   - Build UI to link events to relevant documents via `event_documents` table
   - Add "Related Events" section to document viewer
   - Add "Related Documents" section to event viewer

4. **Tagging System (2-3 hours)**
   - Build tag management UI for both documents and events
   - Add tag filtering/search capabilities
   - Use existing `tags` table with key-value pairs

### Future Sessions

5. **Phase 5: Preset Engine (Major Feature)**
   - Build the core context generation system
   - Create preset rule builder UI
   - Implement `GET /presets/:id/context` endpoint for LLM context generation
   - This is the main value proposition of Continuum

## Technical Notes

- All database tables already exist per `0001_initial_schema.sql`
- Only missing the `event_documents` join table (simple migration)
- RLS policies already cover events and tags
- Focus on UI/UX since backend foundation is solid

## Success Metrics

- Users can collaborate on projects with proper role management
- Users can organize story events on a timeline
- Users can link events to relevant documents for context
- Users can tag and filter their content effectively

Ready for Phase 5 (Preset Engine) which delivers the core Continuum value proposition.