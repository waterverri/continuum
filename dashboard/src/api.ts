import type { Session } from "@supabase/supabase-js"; // Corrected type-only import

const API_URL = import.meta.env.VITE_API_URL;

export const getProjects = async (session: Session) => {
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