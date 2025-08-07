# Styles Architecture

This directory contains a comprehensive CSS design system built with modularity and maintainability in mind.

## Structure

```
styles/
├── variables.css              # Design system tokens (colors, spacing, etc.)
├── utilities.css              # Utility classes for rapid development
├── layout.css                 # Main layout and responsive styles
├── ProjectDetailPage.css      # Main import file for all styles
└── components/                # Component-specific styles
    ├── button.css             # Button variants and sizes
    ├── form.css               # Form controls and filters
    ├── modal.css              # Modal overlays and content
    ├── document.css           # Document-related components
    └── tag.css                # Tag system styles
```

## Design System

### CSS Custom Properties (variables.css)
The design system uses CSS custom properties for consistent theming:

```css
:root {
  /* Colors */
  --color-primary: #007bff;
  --color-text-muted: #6c757d;
  
  /* Spacing */
  --spacing-sm: 0.5rem;
  --spacing-lg: 1rem;
  
  /* Typography */
  --font-size-md: 0.875rem;
  --font-weight-medium: 500;
  
  /* Layout */
  --sidebar-width: 350px;
  --z-modal: 2000;
}
```

### Utility Classes (utilities.css)
Atomic CSS classes for rapid development:

```css
.flex { display: flex; }
.items-center { align-items: center; }
.gap-md { gap: var(--spacing-md); }
.text-muted { color: var(--color-text-muted); }
.rounded-lg { border-radius: var(--radius-lg); }
```

## Component Styles

### Naming Convention
Follow BEM-like naming for component-specific styles:

```css
/* Block */
.document-form { }

/* Element */
.document-form__title { }
.document-form__actions { }

/* Modifier */
.document-form--editing { }
.btn--primary { }
.btn--sm { }
```

### Responsive Design
Mobile-first approach with consistent breakpoints:

```css
/* Mobile first */
.sidebar {
  width: 100vw;
}

/* Tablet and up */
@media (min-width: 768px) {
  .sidebar {
    width: var(--sidebar-width);
  }
}
```

## Adding New Styles

### For New Components
1. Create a new file in `styles/components/[component-name].css`
2. Import it in `ProjectDetailPage.css`
3. Use design system variables and utilities where possible
4. Follow the established naming conventions

### For New Utilities
Add to `utilities.css` following the atomic CSS pattern:

```css
.new-utility-class {
  property: var(--design-token);
}
```

### For New Design Tokens
Add to `variables.css` under the appropriate category:

```css
:root {
  --new-token: value;
}
```

## Best Practices

### Use Design System First
```css
/* Good */
.my-component {
  padding: var(--spacing-lg);
  color: var(--color-text-primary);
  border-radius: var(--radius-md);
}

/* Avoid */
.my-component {
  padding: 16px;
  color: #333;
  border-radius: 8px;
}
```

### Prefer Utility Classes
```html
<!-- Good -->
<div class="flex items-center gap-md">

<!-- Less preferred -->
<div class="custom-flex-container">
```

### Component-Specific Styles
```css
/* Good - Specific to component behavior */
.document-picker-item:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

/* Avoid - Generic styling that could be a utility */
.document-picker-item {
  display: flex; /* Use .flex instead */
  gap: 1rem;     /* Use .gap-lg instead */
}
```

### Responsive Design
```css
/* Good - Mobile first */
.component {
  padding: var(--spacing-sm);
}

@media (min-width: 768px) {
  .component {
    padding: var(--spacing-lg);
  }
}
```

## Import Order

When importing CSS files, follow this order:
1. Design system (variables, utilities)
2. Layout styles
3. Component styles
4. Page-specific styles

Example in `ProjectDetailPage.css`:
```css
@import './variables.css';
@import './utilities.css';
@import './layout.css';
@import './components/button.css';
@import './components/form.css';
/* ... other component styles */
```

## Performance Considerations

- Use `@import` statements for development modularity
- Build process handles CSS bundling and optimization
- Utility classes are designed for reuse to minimize final bundle size
- Component styles are scoped to prevent conflicts

## Dark Mode Support (Future)
The design system is built to support theming:

```css
/* Add to variables.css when implementing dark mode */
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #1a1a1a;
    --color-text-primary: #ffffff;
    /* ... other dark mode tokens */
  }
}
```