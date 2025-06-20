import { useParams, Link } from 'react-router-dom';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <div>
      <h2>Project Details</h2>
      <p>You are now working within project ID: <strong>{projectId}</strong>.</p>
      <p>This is where you'll manage documents, events, and tags for this project.</p>
      <p>This page is not yet developed.</p>
      <br />
      <Link to="/">← Back to All Projects</Link>
    </div>
  );
}