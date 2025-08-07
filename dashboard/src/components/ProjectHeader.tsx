import { Link } from 'react-router-dom';

interface ProjectHeaderProps {
  onCreateDocument: () => void;
  onToggleSidebar: () => void;
}

export function ProjectHeader({ onCreateDocument, onToggleSidebar }: ProjectHeaderProps) {
  return (
    <div className="project-header">
      <div className="project-header__left">
        <button 
          className="project-header__sidebar-toggle"
          onClick={onToggleSidebar}
          title="Toggle sidebar"
        >
          ☰
        </button>
        <Link to="/" className="project-header__back-link">
          ← Back to All Projects
        </Link>
      </div>
      
      <div className="project-header__right">
        <button 
          className="btn btn--primary"
          onClick={onCreateDocument}
        >
          + Create Document
        </button>
      </div>
    </div>
  );
}