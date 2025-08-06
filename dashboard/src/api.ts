// This file is reserved for making authenticated calls to our backend API,
// which will be used for complex, "platformized" features.

const API_URL = import.meta.env.VITE_API_URL;

export interface Document {
  id: string;
  project_id: string;
  title: string;
  group_id?: string;
  document_type?: string;
  content?: string;
  is_composite: boolean;
  components?: Record<string, string>;
  created_at: string;
  resolved_content?: string;
}

export interface Preset {
  id: string;
  project_id: string;
  name: string;
  rules: { document_id: string };
  created_at: string;
  document?: Document;
}

export const getPresetContext = async (presetId: string, accessToken: string) => {
    // Example of a future API call
    const response = await fetch(`${API_URL}/api/presets/${presetId}/context`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch preset context');
    }

    return await response.text();
};

// Document API functions
export const getDocuments = async (projectId: string, accessToken: string): Promise<Document[]> => {
    const response = await fetch(`${API_URL}/api/documents/${projectId}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch documents');
    }

    const data = await response.json();
    return data.documents;
};

export const getDocument = async (projectId: string, documentId: string, accessToken: string, resolve = false): Promise<Document> => {
    const url = `${API_URL}/api/documents/${projectId}/${documentId}${resolve ? '?resolve=true' : ''}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch document');
    }

    const data = await response.json();
    return data.document;
};

export const createDocument = async (projectId: string, document: Partial<Document>, accessToken: string): Promise<Document> => {
    const response = await fetch(`${API_URL}/api/documents/${projectId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(document),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create document');
    }

    const data = await response.json();
    return data.document;
};

export const updateDocument = async (projectId: string, documentId: string, document: Partial<Document>, accessToken: string): Promise<Document> => {
    const response = await fetch(`${API_URL}/api/documents/${projectId}/${documentId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(document),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update document');
    }

    const data = await response.json();
    return data.document;
};

export const deleteDocument = async (projectId: string, documentId: string, accessToken: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/documents/${projectId}/${documentId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to delete document');
    }
};

// Preset API functions
export const getPresets = async (projectId: string, accessToken: string): Promise<Preset[]> => {
    const response = await fetch(`${API_URL}/api/presets/${projectId}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch presets');
    }

    return await response.json();
};

export const createPreset = async (projectId: string, name: string, documentId: string, accessToken: string): Promise<Preset> => {
    const response = await fetch(`${API_URL}/api/presets/${projectId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, documentId }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create preset');
    }

    return await response.json();
};

export const deletePreset = async (presetId: string, accessToken: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/presets/${presetId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to delete preset');
    }
};