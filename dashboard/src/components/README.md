# Components Architecture

This directory contains reusable UI components following the established patterns from the ProjectDetailPage refactoring.

## Component Categories

### Document Management
- **DocumentForm.tsx** - Handles document creation and editing with form validation
- **DocumentViewer.tsx** - Displays document content with resolve functionality for composite docs
- **DocumentList.tsx** / **DocumentListItem.tsx** - Renders document lists with actions and metadata
- **DocumentFilters.tsx** - Provides reusable search and filter controls

### Modal Components
- **DocumentPickerModal.tsx** - Document selection interface with search/filter
- **ComponentKeyInputModal.tsx** - Input modal for component key creation
- **DerivativeModal.tsx** - Workflow for creating derivative documents
- **ComponentTypeSelectorModal.tsx** - Choose between document or group components
- **GroupPickerModal.tsx** - Select document groups for components
- **PresetPickerModal.tsx** - Two-step preset creation workflow

### Tag System
- **TagManager.tsx** - CRUD operations for project tags with color picker
- **TagSelector.tsx** - Associate/disassociate tags with documents
- **TagFilter.tsx** - Filter documents by tags

## Design Patterns

### Component Props
- Use TypeScript interfaces for all props
- Prefer callback props for actions (`onSave`, `onCancel`, `onClick`)
- Include optional `variant` props for different display modes
- Pass through common props like `className` when needed

### State Management
- Extract complex state into custom hooks (see `src/hooks/`)
- Use `useState` for simple local state
- Prefer controlled components with callback props

### Styling
- Use the CSS design system (`src/styles/variables.css`)
- Component-specific styles go in `src/styles/components/[component].css`
- Leverage utility classes from `src/styles/utilities.css`
- Follow BEM-like naming for CSS classes

### Testing
- Test component behavior, not implementation
- Use React Testing Library for user interaction testing
- Mock external dependencies and API calls
- Focus on accessibility and user experience

## Usage Examples

### Basic Component Usage
```tsx
import { DocumentForm } from '../components/DocumentForm';
import type { DocumentFormData } from '../hooks/useProjectDetailState';

function MyPage() {
  const [formData, setFormData] = useState<DocumentFormData>({...});
  
  return (
    <DocumentForm
      formData={formData}
      setFormData={setFormData}
      onSave={() => handleSave()}
      onCancel={() => handleCancel()}
      isCreating={true}
      documents={documents}
    />
  );
}
```

### Modal Component Usage
```tsx
import { DocumentPickerModal } from '../components/DocumentPickerModal';

function MyComponent() {
  const [showPicker, setShowPicker] = useState(false);
  
  return (
    <>
      {showPicker && (
        <DocumentPickerModal
          documents={availableDocuments}
          componentKey="myKey"
          onSelect={(docId) => handleSelect(docId)}
          onCancel={() => setShowPicker(false)}
        />
      )}
    </>
  );
}
```

## Adding New Components

1. **Follow the established patterns** - Look at existing components for structure
2. **Create TypeScript interfaces** - Define clear prop and state types
3. **Add component-specific styles** - Create CSS files in `styles/components/`
4. **Write tests** - Add unit tests in `src/test/components/`
5. **Update imports** - Add to relevant parent components
6. **Document usage** - Add examples to this README if it's a commonly used pattern

## Best Practices

- Keep components under 200 lines when possible
- Use descriptive, self-documenting component names
- Prefer composition over inheritance
- Handle loading and error states appropriately
- Make components accessible (ARIA labels, keyboard navigation)
- Use semantic HTML elements
- Optimize for mobile-first responsive design