# Custom Hooks

This directory contains reusable custom hooks that encapsulate complex state management and business logic.

## Architecture Pattern

Custom hooks follow a clear separation of concerns:
- **State Hooks**: Manage component state and UI interactions
- **Operation Hooks**: Handle API calls and business logic  
- **Feature Hooks**: Provide specific functionality (filtering, validation, etc.)

## Available Hooks

### useProjectDetailState.ts
**Purpose**: Centralized state management for ProjectDetailPage
**Returns**: State variables, setters, and state management actions

```tsx
const state = useProjectDetailState();

// Core data
state.documents        // Document[]
state.selectedDocument // Document | null
state.isEditing       // boolean

// Modal state
state.modals.showTagManager // boolean
state.openModal('showTagManager')
state.closeModal('showTagManager')

// Actions
state.startEdit(document)
state.cancelEdit()
state.resetForm()
```

### useDocumentOperations.ts
**Purpose**: Document CRUD operations and API interactions
**Parameters**: State setters and project configuration
**Returns**: Operation functions

```tsx
const operations = useDocumentOperations({
  projectId,
  documents: state.documents,
  setDocuments: state.setDocuments,
  // ... other dependencies
});

// Operations
await operations.loadDocuments()
await operations.handleCreateDocument(formData)
await operations.handleUpdateDocument(id, formData)
await operations.handleDeleteDocument(id)
```

### useDocumentFilter.ts
**Purpose**: Document filtering and search functionality
**Parameters**: Documents array to filter
**Returns**: Filtered results and filter controls

```tsx
const filter = useDocumentFilter(documents);

// Filter state
filter.searchTerm      // string
filter.typeFilter      // string
filter.selectedTagIds  // string[]

// Results
filter.filteredDocuments // Document[]
filter.availableTypes    // string[]

// Actions
filter.setSearchTerm('query')
filter.resetFilters()
```

## Creating New Hooks

### State Management Hook Template
```tsx
// useMyFeatureState.ts
import { useState, useCallback } from 'react';

export function useMyFeatureState() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const reset = useCallback(() => {
    setData([]);
    setLoading(false);
  }, []);
  
  return {
    // State
    data,
    setData,
    loading,
    setLoading,
    
    // Actions
    reset,
  };
}
```

### Operations Hook Template
```tsx
// useMyFeatureOperations.ts
import { useCallback } from 'react';
import { myApi } from '../api';

interface UseMyFeatureOperationsProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function useMyFeatureOperations({ 
  onSuccess, 
  onError 
}: UseMyFeatureOperationsProps) {
  
  const performOperation = useCallback(async (data: any) => {
    try {
      const result = await myApi.create(data);
      onSuccess?.();
      return result;
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }, [onSuccess, onError]);
  
  return {
    performOperation,
  };
}
```

## Hook Patterns

### Dependency Injection
Pass dependencies as parameters to make hooks testable:

```tsx
// Good
export function useDocumentOperations({
  projectId,
  setDocuments,
  setError
}: UseDocumentOperationsProps) {
  // Implementation uses injected dependencies
}

// Usage
const operations = useDocumentOperations({
  projectId,
  setDocuments: state.setDocuments,
  setError: state.setError,
});
```

### Return Object Structure
Organize returns by category:

```tsx
return {
  // State
  documents,
  loading,
  error,
  
  // Computed values
  filteredDocuments,
  hasChanges,
  
  // Actions
  loadDocuments,
  createDocument,
  resetState,
};
```

### Error Handling
Handle errors consistently:

```tsx
const handleOperation = useCallback(async () => {
  try {
    setLoading(true);
    const result = await apiCall();
    setData(result);
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    setLoading(false);
  }
}, []);
```

## Testing Hooks

### Test Structure
```tsx
// useMyHook.test.tsx
import { renderHook, act } from '@testing-library/react';
import { useMyHook } from './useMyHook';

describe('useMyHook', () => {
  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useMyHook());
    
    expect(result.current.data).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
  
  it('should handle actions correctly', async () => {
    const { result } = renderHook(() => useMyHook());
    
    await act(async () => {
      await result.current.performAction('test');
    });
    
    expect(result.current.data).toContain('test');
  });
});
```

### Mocking Dependencies
```tsx
// Mock API calls
vi.mock('../api', () => ({
  myApi: {
    create: vi.fn(),
    update: vi.fn(),
  },
}));
```

## Best Practices

### Single Responsibility
Each hook should have a single, clear purpose:
```tsx
// Good - Focused on filtering
useDocumentFilter(documents)

// Avoid - Mixing concerns
useDocumentFilterAndEditor(documents, onEdit)
```

### Stable References
Use `useCallback` for functions that are dependencies:
```tsx
const handleAction = useCallback(async (data) => {
  // Implementation
}, [dependency1, dependency2]);
```

### Type Safety
Always provide TypeScript types:
```tsx
interface UseMyHookReturn {
  data: MyData[];
  loading: boolean;
  performAction: (input: string) => Promise<void>;
}

export function useMyHook(): UseMyHookReturn {
  // Implementation
}
```

### Avoid Side Effects
Keep hooks pure - side effects should be explicit:
```tsx
// Good - Explicit side effect
const { performAction } = useMyOperations();
useEffect(() => {
  performAction();
}, [performAction]);

// Avoid - Hidden side effect in hook
const data = useMyHookWithAutoLoad(); // Unclear when loading happens
```

## Integration with Components

### Hook Composition
```tsx
function MyComponent() {
  // State management
  const state = useMyFeatureState();
  
  // Business logic
  const operations = useMyFeatureOperations({
    onSuccess: () => state.reset(),
    onError: (error) => state.setError(error),
  });
  
  // Feature-specific logic
  const filter = useDocumentFilter(state.documents);
  
  return (
    <div>
      {/* Component JSX using hook returns */}
    </div>
  );
}
```

This pattern keeps components clean and focused on presentation while hooks handle complex logic and state management.