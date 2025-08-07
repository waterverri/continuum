// Document Search Input Component
interface DocumentSearchInputProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
}

function DocumentSearchInput({ searchTerm, onSearchChange, placeholder = 'Search documents...' }: DocumentSearchInputProps) {
  return (
    <div className="filter-group">
      <input
        type="text"
        className="filter-input"
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
  );
}

// Document Type Filter Component
interface DocumentTypeFilterProps {
  typeFilter: string;
  onTypeChange: (value: string) => void;
  availableTypes: string[];
}

function DocumentTypeFilter({ typeFilter, onTypeChange, availableTypes }: DocumentTypeFilterProps) {
  return (
    <select 
      className="filter-select"
      value={typeFilter}
      onChange={(e) => onTypeChange(e.target.value)}
    >
      <option value="">All Types</option>
      {availableTypes.map(type => (
        <option key={type} value={type}>{type}</option>
      ))}
    </select>
  );
}

// Document Format Filter Component
interface DocumentFormatFilterProps {
  formatFilter: string;
  onFormatChange: (value: string) => void;
}

function DocumentFormatFilter({ formatFilter, onFormatChange }: DocumentFormatFilterProps) {
  return (
    <select 
      className="filter-select"
      value={formatFilter}
      onChange={(e) => onFormatChange(e.target.value)}
    >
      <option value="">All Formats</option>
      <option value="static">Static Documents</option>
      <option value="composite">Composite Documents</option>
    </select>
  );
}

// Combined Filters Component
interface DocumentFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  typeFilter: string;
  onTypeChange: (value: string) => void;
  formatFilter: string;
  onFormatChange: (value: string) => void;
  availableTypes: string[];
  searchPlaceholder?: string;
  showFilters?: boolean;
}

export function DocumentFilters({ 
  searchTerm, 
  onSearchChange, 
  typeFilter, 
  onTypeChange, 
  formatFilter, 
  onFormatChange, 
  availableTypes,
  searchPlaceholder,
  showFilters = true
}: DocumentFiltersProps) {
  return (
    <div className="modal-filters">
      <DocumentSearchInput 
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        placeholder={searchPlaceholder}
      />
      
      {showFilters && (
        <div className="filter-row">
          <DocumentTypeFilter 
            typeFilter={typeFilter}
            onTypeChange={onTypeChange}
            availableTypes={availableTypes}
          />
          <DocumentFormatFilter 
            formatFilter={formatFilter}
            onFormatChange={onFormatChange}
          />
        </div>
      )}
    </div>
  );
}

export { DocumentSearchInput, DocumentTypeFilter, DocumentFormatFilter };
export type { DocumentFiltersProps, DocumentSearchInputProps, DocumentTypeFilterProps, DocumentFormatFilterProps };