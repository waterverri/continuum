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

export interface EventDependency {
  id: string;
  dependent_event_id: string;
  source_event_id: string;
  dependency_rule: string;
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