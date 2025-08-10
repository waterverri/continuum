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
  tags?: Tag[];
  event_id?: string; // For event-specific document versions
  event_documents?: EventDocument[]; // For document-event associations
  events?: Event; // For joined event data
}

export interface Preset {
  id: string;
  project_id: string;
  name: string;
  rules: { 
    document_id: string;
    component_overrides?: Record<string, string>;
  };
  created_at: string;
  document?: Document;
}

export interface Tag {
  id: string;
  project_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface DocumentTag {
  document_id: string;
  tag_id: string;
  created_at: string;
}

export interface Event {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  time_start?: number;
  time_end?: number;
  display_order: number;
  parent_event_id?: string;
  created_at: string;
}

export interface EventDocument {
  event_id: string;
  document_id: string;
  created_at: string;
}

export interface EventHierarchy {
  parent_event_id: string;
  child_event_id: string;
  created_at: string;
}

export interface PresetContext {
    preset_id: string;
    preset_name: string;
    base_document_id: string;
    base_document_title: string;
    content: string;
    applied_overrides: Record<string, string> | null;
}

export const getPresetContext = async (presetId: string, accessToken: string): Promise<PresetContext> => {
    const response = await fetch(`${API_URL}/api/presets/${presetId}/context`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get preset context');
    }

    return await response.json();
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

export const updatePreset = async (presetId: string, name: string, documentId?: string, accessToken?: string): Promise<Preset> => {
    const response = await fetch(`${API_URL}/api/presets/${presetId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, documentId }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update preset');
    }

    return await response.json();
};

export const updatePresetOverrides = async (presetId: string, overrides: Record<string, string>, accessToken?: string): Promise<Preset> => {
    const response = await fetch(`${API_URL}/api/presets/${presetId}/overrides`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ overrides }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update preset overrides');
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

// Group API types
export interface DocumentGroup {
  groupId: string;
  documents: Document[];
  representativeDoc: Document;
}

export interface GroupResolveResponse {
  document: Document;
  resolvedContent: string;
  groupId: string;
  selectedFromGroup: boolean;
  availableTypes: string[];
  resolutionError?: string;
}

// Group API functions
export const getDocumentGroups = async (projectId: string, accessToken: string): Promise<DocumentGroup[]> => {
  const response = await fetch(`${API_URL}/api/documents/${projectId}/groups`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch document groups');
  }

  const data = await response.json();
  return data.groups;
};

export const getGroupDocuments = async (projectId: string, groupId: string, accessToken: string): Promise<{
  groupId: string;
  documents: Document[];
  representativeDoc: Document;
  totalCount: number;
}> => {
  const response = await fetch(`${API_URL}/api/documents/${projectId}/groups/${groupId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch group documents');
  }

  return await response.json();
};

export const resolveGroupDocument = async (
  projectId: string, 
  groupId: string, 
  accessToken: string,
  preferredType?: string
): Promise<GroupResolveResponse> => {
  const url = new URL(`${API_URL}/api/documents/${projectId}/groups/${groupId}/resolve`);
  if (preferredType) {
    url.searchParams.set('preferredType', preferredType);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to resolve group document');
  }

  return await response.json();
};

// Tag API functions
export const getTags = async (projectId: string, accessToken: string): Promise<Tag[]> => {
  const response = await fetch(`${API_URL}/api/tags/${projectId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch tags');
  }

  const data = await response.json();
  return data.tags;
};

export const createTag = async (projectId: string, name: string, color: string, accessToken: string): Promise<Tag> => {
  const response = await fetch(`${API_URL}/api/tags/${projectId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, color }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create tag');
  }

  const data = await response.json();
  return data.tag;
};

export const updateTag = async (projectId: string, tagId: string, updates: { name?: string; color?: string }, accessToken: string): Promise<Tag> => {
  const response = await fetch(`${API_URL}/api/tags/${projectId}/${tagId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update tag');
  }

  const data = await response.json();
  return data.tag;
};

export const deleteTag = async (projectId: string, tagId: string, accessToken: string): Promise<void> => {
  const response = await fetch(`${API_URL}/api/tags/${projectId}/${tagId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete tag');
  }
};

export const getDocumentTags = async (projectId: string, documentId: string, accessToken: string): Promise<Tag[]> => {
  const response = await fetch(`${API_URL}/api/tags/${projectId}/documents/${documentId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch document tags');
  }

  const data = await response.json();
  return data.tags;
};

export const addTagsToDocument = async (projectId: string, documentId: string, tagIds: string[], accessToken: string): Promise<void> => {
  const response = await fetch(`${API_URL}/api/tags/${projectId}/documents/${documentId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tagIds }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add tags to document');
  }
};

export const removeTagFromDocument = async (projectId: string, documentId: string, tagId: string, accessToken: string): Promise<void> => {
  const response = await fetch(`${API_URL}/api/tags/${projectId}/documents/${documentId}/${tagId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to remove tag from document');
  }
};

// Event API functions
export const getEvents = async (projectId: string, accessToken: string, includeHierarchy = false): Promise<{ events: Event[], hierarchy?: EventHierarchy[] }> => {
  const url = `${API_URL}/api/events/${projectId}${includeHierarchy ? '?include_hierarchy=true' : ''}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch events');
  }

  return await response.json();
};

export const getEvent = async (projectId: string, eventId: string, accessToken: string): Promise<{
  event: Event,
  documents: EventDocument[],
  parentEvents: Event[],
  childEvents: Event[]
}> => {
  const response = await fetch(`${API_URL}/api/events/${projectId}/${eventId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch event');
  }

  return await response.json();
};

export const createEvent = async (projectId: string, event: Partial<Event>, accessToken: string): Promise<Event> => {
  const response = await fetch(`${API_URL}/api/events/${projectId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create event');
  }

  const data = await response.json();
  return data.event;
};

export const updateEvent = async (projectId: string, eventId: string, event: Partial<Event>, accessToken: string): Promise<Event> => {
  const response = await fetch(`${API_URL}/api/events/${projectId}/${eventId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update event');
  }

  const data = await response.json();
  return data.event;
};

export const deleteEvent = async (projectId: string, eventId: string, accessToken: string): Promise<void> => {
  const response = await fetch(`${API_URL}/api/events/${projectId}/${eventId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete event');
  }
};

export const addDocumentToEvent = async (projectId: string, eventId: string, documentId: string, accessToken: string): Promise<void> => {
  const response = await fetch(`${API_URL}/api/events/${projectId}/${eventId}/documents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ document_id: documentId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add document to event');
  }
};

export const removeDocumentFromEvent = async (projectId: string, eventId: string, documentId: string, accessToken: string): Promise<void> => {
  const response = await fetch(`${API_URL}/api/events/${projectId}/${eventId}/documents/${documentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to remove document from event');
  }
};

export const getEventTimeline = async (projectId: string, accessToken: string): Promise<{ events: Event[], hierarchy: EventHierarchy[] }> => {
  const response = await fetch(`${API_URL}/api/events/${projectId}/timeline`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch event timeline');
  }

  return await response.json();
};

// Document evolution functions removed - using simplified approach via direct Supabase queries