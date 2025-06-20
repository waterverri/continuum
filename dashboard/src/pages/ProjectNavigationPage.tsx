import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProjects, createProject, deleteProject } from '../accessors/projectAccessor';
import './ProjectNavigationPage.css';

// Define a type for our project for better type safety
interface Project {
  id: string;
  name: string;
  created_at: string;
}

export default function ProjectNavigationPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');

  const fetchProjects = async () => {
    try {
      setError(null);
      setLoading(true);
      const projectsData = await getProjects();
      setProjects(projectsData || []);
    } catch (error: any) {
      setError(`Failed to fetch projects: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      setError("Project name cannot be empty.");
      return;
    }
    try {
      const newProject = await createProject(newProjectName);
      setProjects([newProject, ...projects]); // Add new project to the top of the list
      setNewProjectName(''); // Clear input
      setError(null);
    } catch (error: any) {
      setError(`Failed to create project: ${error.message}`);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
        try {
            await deleteProject(projectId);
            setProjects(projects.filter(p => p.id !== projectId)); // Update UI instantly
        } catch (error: any) {
            setError(`Failed to delete project: ${error.message}`);
        }
    }
  }

  return (
    <div className="project-nav-container">
      <h3>Create a New Project</h3>
      <form onSubmit={handleCreateProject} className="project-form">
        <input
          type="text"
          placeholder="My New Story"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
        />
        <button type="submit">Create</button>
      </form>

      <hr />

      <h3>Your Projects</h3>
      {loading && <p>Loading projects...</p>}
      {error && <p className="error-message">{error}</p>}
      
      {!loading && projects.length > 0 ? (
        <ul className="project-list">
          {projects.map((project) => (
            <li key={project.id}>
              <Link to={`/projects/${project.id}`} className="project-link">
                {project.name}
              </Link>
              <button onClick={() => handleDeleteProject(project.id)} className="delete-btn">
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !loading && <p>You don't have any projects yet. Create one to get started!</p>
      )}
    </div>
  );
}