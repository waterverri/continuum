import ReactTextareaAutocomplete from 'react-textarea-autocomplete';
import type { Document } from '../api';
import type { AutocompleteItem } from './AutocompleteDropdown';
import { useAutocomplete } from './AutocompleteDropdown';

interface AutocompleteTextareaV2Props {
  value: string;
  onChange: (value: string) => void;
  documents: Document[];
  currentComponents: Record<string, string>;
  onComponentAdd: (key: string, documentId: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
}

export function AutocompleteTextareaV2({
  value,
  onChange,
  documents,
  currentComponents,
  onComponentAdd,
  rows = 15,
  placeholder = '',
  className = ''
}: AutocompleteTextareaV2Props) {

  const autocomplete = useAutocomplete(documents, currentComponents);

  // Generate component key based on title
  const generateComponentKey = (title: string): string => {
    let baseKey = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');

    if (!/^[a-z]/.test(baseKey)) {
      baseKey = 'doc_' + baseKey;
    }

    let key = baseKey;
    let counter = 1;
    while (Object.keys(currentComponents).includes(key)) {
      key = `${baseKey}_${counter}`;
      counter++;
    }

    return key;
  };

  // Generate group component value
  const generateGroupComponentValue = (item: AutocompleteItem): string => {
    if (item.group_id) {
      return `group:${item.group_id}:${item.id}`;
    } else {
      return `group:${item.id}:${item.id}`;
    }
  };

  // Trigger function for {{ pattern
  const trigger = {
    '{{': {
      dataProvider: (token: string) => {
        if (token.length < 1) return [];

        // Use the existing autocomplete logic
        autocomplete.show(token, { top: 0, left: 0 }); // Position doesn't matter for this component
        return autocomplete.items.map(item => ({
          ...item,
          name: item.title // react-textarea-autocomplete expects 'name' field
        }));
      },
      component: ({ entity }: { entity: AutocompleteItem & { name: string } }) => (
        <div className="autocomplete-item">
          <div className="item-main">
            <span className="item-title">{entity.title}</span>
            {entity.matchType === 'alias' && entity.alias && (
              <span className="item-alias">({entity.alias})</span>
            )}
            {entity.matchType === 'tag' && (
              <span className="item-tag-match">via tag</span>
            )}
          </div>
          <div className="item-meta">
            {entity.document_type && (
              <span className="item-type">{entity.document_type}</span>
            )}
            {entity.isInComponents && (
              <span className="item-badge">Already used</span>
            )}
          </div>
        </div>
      ),
      output: (item: AutocompleteItem & { name: string }) => {
        // Generate component key and add to components
        let componentKey: string;
        let componentValue: string;

        if (item.isInComponents) {
          // Find existing key for this document
          const existingKey = Object.keys(currentComponents).find(key => {
            const value = currentComponents[key];
            return value === item.id ||
                   value === `group:${item.group_id}:${item.id}` ||
                   (item.group_id && value.startsWith(`group:${item.group_id}`));
          });
          componentKey = existingKey || generateComponentKey(item.title);

          if (existingKey) {
            const existingValue = currentComponents[existingKey];
            const newValue = generateGroupComponentValue(item);
            if (existingValue !== newValue) {
              onComponentAdd(componentKey, newValue);
            }
          }
        } else {
          componentKey = generateComponentKey(item.title);
          componentValue = generateGroupComponentValue(item);
          onComponentAdd(componentKey, componentValue);
        }

        return `{{${componentKey}}}`;
      }
    }
  };

  return (
    <ReactTextareaAutocomplete
      className={`form-textarea ${className}`}
      value={value}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      trigger={trigger}
      rows={rows}
      placeholder={placeholder}
      loadingComponent={() => <div>Loading...</div>}
      containerStyle={{
        position: 'relative',
        width: '100%'
      }}
      listStyle={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)',
        maxWidth: '400px',
        minWidth: '320px',
        maxHeight: '320px',
        overflow: 'auto',
        fontSize: '14px',
        zIndex: 1000
      }}
      itemStyle={{
        padding: '12px 16px',
        cursor: 'pointer',
        borderBottom: '1px solid #f1f5f9'
      }}
      dropdownStyle={{
        position: 'absolute',
        zIndex: 1000
      }}
    />
  );
}