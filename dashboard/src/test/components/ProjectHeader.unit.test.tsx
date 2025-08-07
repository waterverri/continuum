import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ProjectHeader } from '../../components/ProjectHeader';

// Wrapper for React Router
const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('ProjectHeader', () => {
  const mockOnCreateDocument = vi.fn();
  const mockOnToggleSidebar = vi.fn();

  beforeEach(() => {
    mockOnCreateDocument.mockClear();
    mockOnToggleSidebar.mockClear();
  });

  it('renders the header with back link and create button', () => {
    render(
      <ProjectHeader 
        onCreateDocument={mockOnCreateDocument}
        onToggleSidebar={mockOnToggleSidebar}
      />,
      { wrapper: RouterWrapper }
    );

    expect(screen.getByText('← Back to All Projects')).toBeInTheDocument();
    expect(screen.getByText('+ Create Document')).toBeInTheDocument();
  });

  it('calls onCreateDocument when create button is clicked', () => {
    render(
      <ProjectHeader 
        onCreateDocument={mockOnCreateDocument}
        onToggleSidebar={mockOnToggleSidebar}
      />,
      { wrapper: RouterWrapper }
    );

    fireEvent.click(screen.getByText('+ Create Document'));
    expect(mockOnCreateDocument).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleSidebar when sidebar toggle is clicked', () => {
    render(
      <ProjectHeader 
        onCreateDocument={mockOnCreateDocument}
        onToggleSidebar={mockOnToggleSidebar}
      />,
      { wrapper: RouterWrapper }
    );

    // Note: sidebar toggle might not be visible on desktop, but should be clickable
    const toggleButton = screen.getByTitle('Toggle sidebar');
    fireEvent.click(toggleButton);
    expect(mockOnToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('has correct link to home page', () => {
    render(
      <ProjectHeader 
        onCreateDocument={mockOnCreateDocument}
        onToggleSidebar={mockOnToggleSidebar}
      />,
      { wrapper: RouterWrapper }
    );

    const backLink = screen.getByText('← Back to All Projects');
    expect(backLink).toHaveAttribute('href', '/');
  });

  it('applies correct CSS classes', () => {
    render(
      <ProjectHeader 
        onCreateDocument={mockOnCreateDocument}
        onToggleSidebar={mockOnToggleSidebar}
      />,
      { wrapper: RouterWrapper }
    );

    const header = screen.getByText('← Back to All Projects').closest('.project-header');
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass('project-header');
  });
});