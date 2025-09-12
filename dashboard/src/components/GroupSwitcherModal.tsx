import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { getGroupDocuments } from '../api';
import type { Document } from '../api';

interface GroupSwitcherModalProps {
  projectId: string;
  groupId: string;
  componentKey: string;
  currentReference: string;
  onSwitch: (componentKey: string, groupId: string, preferredType?: string) => void;
  onCancel: () => void;
}

export function GroupSwitcherModal({ 
  projectId, 
  groupId, 
  componentKey, 
  currentReference,
  onSwitch, 
  onCancel 
}: GroupSwitcherModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('');
  const [groupData, setGroupData] = useState<{
    groupId: string;
    documents: Document[];
    representativeDoc: Document;
    totalCount: number;
  } | null>(null);

  const currentPreferredType = currentReference.startsWith('group:') ? 
    currentReference.split(':')[2] || null : null;

  // Initialize selectedType with current preference
  useEffect(() => {
    setSelectedType(currentPreferredType || '');
  }, [currentPreferredType]);

  useEffect(() => {
    const fetchGroupData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setError('Authentication required');
          return;
        }

        const data = await getGroupDocuments(projectId, groupId, session.access_token);
        setGroupData(data);
      } catch (err) {
        console.error('Error fetching group data:', err);
        setError('Failed to load group information');
      } finally {
        setLoading(false);
      }
    };

    fetchGroupData();
  }, [projectId, groupId]);

  const availableTypes = useMemo(() => {
    if (!groupData) return [];
    return [...new Set(groupData.documents.map(d => d.document_type).filter((type): type is string => Boolean(type)))];
  }, [groupData]);

  const handleApply = () => {
    const preferredType = selectedType || undefined;
    onSwitch(componentKey, groupId, preferredType);
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content component-key-modal">
          <div className="modal-header">
            <h3>Switch Group Type</h3>
            <button className="modal-close" onClick={onCancel}>×</button>
          </div>
          <div className="modal-body">
            <div className="loading">Loading group information...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !groupData) {
    return (
      <div className="modal-overlay">
        <div className="modal-content component-key-modal">
          <div className="modal-header">
            <h3>Switch Group Type</h3>
            <button className="modal-close" onClick={onCancel}>×</button>
          </div>
          <div className="modal-body">
            <div className="error-message">
              {error || 'Failed to load group data'}
              <button onClick={onCancel}>×</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content component-key-modal">
        <div className="modal-header">
          <h3>Switch Group Type for "{componentKey}"</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="key-input-section">
            <div className="source-document-info">
              <p><strong>Group:</strong> {groupData.representativeDoc.title}</p>
              <p><strong>Documents in group:</strong> {groupData.totalCount}</p>
              <p><strong>Current selection:</strong> {currentPreferredType || 'Auto (representative document)'}</p>
            </div>

            <p>Choose which document type to use from this group:</p>
            
            <div className="form-group">
              <label className="form-label">
                Document Type:
                <select 
                  className="form-input"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                >
                  <option value="">Auto (Representative Document)</option>
                  {availableTypes.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {availableTypes.length === 0 && (
              <div className="empty-state">
                <p>No document types found in this group.</p>
                <p>All documents will use the representative document selection.</p>
              </div>
            )}

            <p className="key-input-help">
              <strong>Auto:</strong> Uses the representative document (prefers source/original types).<br/>
              <strong>Specific Type:</strong> Always uses the specified document type from the group.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={handleApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}