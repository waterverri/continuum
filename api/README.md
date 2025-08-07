# Continuum API

The backend Node.js API for Continuum - The Writer's Context Engine.

## Development

```bash
# Install dependencies
npm install

# Start development server (Google Cloud Functions Framework)
npm run dev

# Compile TypeScript
npm run compile

# Run tests
npm test

# Clean build artifacts
npm run clean

# Format code
npm run fix
```

## Environment Setup

Create a `.env` file:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_service_key  # For deployment
```

## API Endpoints

### Document Management
- `GET /api/documents/:projectId` - List all documents in a project
- `GET /api/documents/:projectId/:documentId` - Get a specific document
- `POST /api/documents/:projectId` - Create a new document
- `PUT /api/documents/:projectId/:documentId` - Update a document
- `DELETE /api/documents/:projectId/:documentId` - Delete a document

### Document Groups
- `GET /api/documents/:projectId/groups` - List all document groups
- `GET /api/documents/:projectId/groups/:groupId` - Get documents in a group
- `GET /api/documents/:projectId/groups/:groupId/resolve` - Resolve group to content

### Presets
- `GET /api/presets/:projectId` - List project presets
- `POST /api/presets/:projectId` - Create a new preset
- `DELETE /api/presets/:presetId` - Delete a preset

### External API
- `GET /preset/:projectId/:presetName` - Public endpoint for LLM integration

## Key Features

- **JWT Authentication**: Secure API access with Supabase authentication
- **Row Level Security**: Database-level access control through Supabase RLS
- **Document Resolution**: Recursive resolution of composite documents and groups
- **Cycle Detection**: Prevention of infinite loops in document dependencies
- **Group Management**: Advanced document grouping with type-specific resolution
- **External Presets**: Public API endpoints for LLM integration

## Architecture

- **Node.js + TypeScript** for type-safe server-side development
- **Express.js** for HTTP routing and middleware
- **Google Cloud Functions Framework** for serverless deployment
- **Supabase** for database access and authentication
- **Jest + Supertest** for comprehensive testing

## Deployment

Deployed to Google Cloud Run with automated CI/CD via GitHub Actions.

See the main project README for complete documentation.