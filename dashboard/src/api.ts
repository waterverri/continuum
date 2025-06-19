import { Session } from "@supabase/supabase-js";

const API_URL = import.meta.env.VITE_API_URL;

export const getProjects = async (session: Session) => {
    // Ensure the path is correct if your base URL doesn't include /api
    const response = await fetch(`${API_URL}/api/projects`, {
        headers: {
            'Authorization': `Bearer ${session.access_token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch projects');
    }

    return await response.json();
};