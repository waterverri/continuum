# Continuum Dashboard

The frontend React application for Continuum - The Writer's Context Engine.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test        # Watch mode
npm run test:run    # Single run
npm run test:ui     # UI interface

# Lint code
npm run lint
```

## Environment Setup

Create a `.env.local` file:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:8080  # For local API development
```

## Key Features

- **Document Management**: Complete CRUD operations for static and composite documents
- **Document Groups**: Create and manage derivative documents with intelligent type selection
- **Group-Based Composition**: Choose between individual documents or entire groups in composite documents
- **Advanced Modal System**: Professional UI with responsive design and comprehensive filtering
- **Real-time Resolution**: Live preview of composite document content with group substitutions

## Architecture

- **React 18** with TypeScript for type safety
- **Vite** for fast development and building
- **Supabase** for authentication and direct database access
- **Vitest + React Testing Library** for testing
- **ESLint** for code quality

See the main project README for complete documentation.