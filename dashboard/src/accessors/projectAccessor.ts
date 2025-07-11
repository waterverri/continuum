import { supabase } from '../supabaseClient';

export const getProjects = async () => {
  // The user's JWT is automatically sent by the supabase client,
  // and RLS policies are enforced on the server.
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching projects from Supabase:", error);
    throw error;
  }

  return data;
};

export const createProject = async (name: string) => {
  if (!name) {
    throw new Error("Project name cannot be empty.");
  }
  
  // RLS policies on the 'projects' table will allow this insert.
  // The 'assign_project_owner' trigger will then run on the database.
  let insert = await supabase
    .from('projects')
    .insert([{ name }])

  if (insert.error) {
    console.error("Error creating project:", insert.error);
    throw insert.error;
  }

  let selected = await supabase
    .from('projects')
    .select()
    .filter("name","eq",name)
    .single()

  if (selected.error) {
    console.error("Error creating project:", selected.error);
    throw selected.error;
  }

  return selected.data;
};

export const deleteProject = async (projectId: string) => {
  // RLS policies will check if the user has the 'owner' role
  // before allowing the deletion.
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);
  
  if (error) {
    console.error("Error deleting project:", error);
    throw error;
  }

  return true;
};