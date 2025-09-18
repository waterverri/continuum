import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjectDetailState } from '../../hooks/useProjectDetailState';
import type { Document, Preset, Tag, Event } from '../../api';

describe('useProjectDetailState', () => {
  let result: ReturnType<typeof useProjectDetailState>;

  beforeEach(() => {
    const { result: hookResult } = renderHook(() => useProjectDetailState());
    result = hookResult.current;
  });

  describe('initial state', () => {
    it('should initialize with empty arrays for core data', () => {
      expect(result.documents).toEqual([]);
      expect(result.presets).toEqual([]);
      expect(result.tags).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('should initialize with correct loading and error states', () => {
      expect(result.loading).toBe(true);
      expect(result.error).toBe(null);
    });

    it('should initialize with correct document management states', () => {
      expect(result.selectedDocument).toBe(null);
      expect(result.isEditing).toBe(false);
      expect(result.isCreating).toBe(false);
      expect(result.resolvedContent).toBe(null);
    });

    it('should initialize with correct UI states', () => {
      expect(result.sidebarOpen).toBe(false);
    });

    it('should initialize with empty form data', () => {
      expect(result.formData).toEqual({
        title: '',
        content: '',
        document_type: '',
        components: {},
        group_id: undefined,
        ai_model: undefined
      });
    });

    it('should initialize with all modals closed', () => {
      const expectedModals = {
        showDocumentPicker: false,
        showKeyInput: false,
        showPresetPicker: false,
        showPresetEdit: false,
        showPresetDashboard: false,
        showDerivativeModal: false,
        showComponentTypeSelector: false,
        showGroupPicker: false,
        showGroupAssignmentPicker: false,
        showGroupSwitcher: false,
        showTagManager: false,
        showTagSelector: false,
        showEventManager: false,
        showEventSelector: false,
        showEventTimeline: false,
        showDocumentEvolution: false,
        showDocumentDeletion: false,
      };
      expect(result.modals).toEqual(expectedModals);
    });

    it('should initialize modal-related states as null/empty', () => {
      expect(result.componentKeyToAdd).toBe(null);
      expect(result.keyInputValue).toBe('');
      expect(result.sourceDocument).toBe(null);
      expect(result.switcherComponentKey).toBe(null);
      expect(result.switcherGroupId).toBe(null);
      expect(result.tagSelectorDocumentId).toBe(null);
      expect(result.eventSelectorDocument).toBe(null);
      expect(result.evolutionDocument).toBe(null);
      expect(result.editingPreset).toBe(null);
      expect(result.documentToDelete).toBe(null);
    });
  });

  describe('state setters', () => {
    it('should update documents state', () => {
      const { result } = renderHook(() => useProjectDetailState());
      const mockDocuments: Document[] = [
        { id: '1', title: 'Test Doc', project_id: 'proj1' } as Document
      ];

      act(() => {
        result.current.setDocuments(mockDocuments);
      });

      expect(result.current.documents).toEqual(mockDocuments);
    });

    it('should update presets state', () => {
      const { result } = renderHook(() => useProjectDetailState());
      const mockPresets: Preset[] = [
        { id: '1', name: 'Test Preset', project_id: 'proj1' } as Preset
      ];

      act(() => {
        result.current.setPresets(mockPresets);
      });

      expect(result.current.presets).toEqual(mockPresets);
    });

    it('should update tags state', () => {
      const { result } = renderHook(() => useProjectDetailState());
      const mockTags: Tag[] = [
        { id: '1', name: 'Test Tag', project_id: 'proj1' } as Tag
      ];

      act(() => {
        result.current.setTags(mockTags);
      });

      expect(result.current.tags).toEqual(mockTags);
    });

    it('should update events state', () => {
      const { result } = renderHook(() => useProjectDetailState());
      const mockEvents: Event[] = [
        { id: '1', title: 'Test Event', project_id: 'proj1' } as Event
      ];

      act(() => {
        result.current.setEvents(mockEvents);
      });

      expect(result.current.events).toEqual(mockEvents);
    });

    it('should update loading state', () => {
      const { result } = renderHook(() => useProjectDetailState());

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.loading).toBe(false);
    });

    it('should update error state', () => {
      const { result } = renderHook(() => useProjectDetailState());

      act(() => {
        result.current.setError('Test error');
      });

      expect(result.current.error).toBe('Test error');
    });

    it('should update sidebar state', () => {
      const { result } = renderHook(() => useProjectDetailState());

      act(() => {
        result.current.setSidebarOpen(true);
      });

      expect(result.current.sidebarOpen).toBe(true);
    });
  });

  describe('form management', () => {
    it('should update form data', () => {
      const { result } = renderHook(() => useProjectDetailState());
      const newFormData = {
        title: 'New Title',
        content: 'New Content',
        document_type: 'prompt',
        components: { key1: 'value1' },
        group_id: 'group1',
        ai_model: 'gpt-4'
      };

      act(() => {
        result.current.setFormData(newFormData);
      });

      expect(result.current.formData).toEqual(newFormData);
    });

    it('should reset form to initial state', () => {
      const { result } = renderHook(() => useProjectDetailState());

      // First set some data
      act(() => {
        result.current.setFormData({
          title: 'Title',
          content: 'Content',
          document_type: 'prompt',
          components: { key: 'value' },
          group_id: 'group1',
          ai_model: 'gpt-4'
        });
      });

      // Then reset
      act(() => {
        result.current.resetForm();
      });

      expect(result.current.formData).toEqual({
        title: '',
        content: '',
        document_type: '',
        components: {},
        group_id: undefined,
        ai_model: undefined
      });
    });
  });

  describe('modal management', () => {
    it('should open a specific modal', () => {
      const { result } = renderHook(() => useProjectDetailState());

      act(() => {
        result.current.openModal('showDocumentPicker');
      });

      expect(result.current.modals.showDocumentPicker).toBe(true);
      expect(result.current.modals.showKeyInput).toBe(false); // Others remain closed
    });

    it('should close a specific modal', () => {
      const { result } = renderHook(() => useProjectDetailState());

      // First open the modal
      act(() => {
        result.current.openModal('showDocumentPicker');
      });

      // Then close it
      act(() => {
        result.current.closeModal('showDocumentPicker');
      });

      expect(result.current.modals.showDocumentPicker).toBe(false);
    });

    it('should close all modals', () => {
      const { result } = renderHook(() => useProjectDetailState());

      // First open multiple modals
      act(() => {
        result.current.openModal('showDocumentPicker');
        result.current.openModal('showKeyInput');
        result.current.openModal('showPresetPicker');
      });

      // Verify they're open
      expect(result.current.modals.showDocumentPicker).toBe(true);
      expect(result.current.modals.showKeyInput).toBe(true);
      expect(result.current.modals.showPresetPicker).toBe(true);

      // Then close all
      act(() => {
        result.current.closeAllModals();
      });

      // Verify all are closed
      Object.values(result.current.modals).forEach(modalState => {
        expect(modalState).toBe(false);
      });
    });
  });

  describe('document management actions', () => {
    const mockDocument: Document = {
      id: 'doc1',
      title: 'Test Document',
      content: 'Test content',
      document_type: 'prompt',
      components: { key1: 'value1' },
      group_id: 'group1',
      ai_model: 'gpt-4',
      project_id: 'proj1'
    } as Document;

    it('should start editing a document', () => {
      const { result } = renderHook(() => useProjectDetailState());

      act(() => {
        result.current.startEdit(mockDocument);
      });

      expect(result.current.selectedDocument).toEqual(mockDocument);
      expect(result.current.isEditing).toBe(true);
      expect(result.current.formData).toEqual({
        title: 'Test Document',
        content: 'Test content',
        document_type: 'prompt',
        components: { key1: 'value1' },
        group_id: 'group1',
        ai_model: 'gpt-4'
      });
      expect(result.current.resolvedContent).toBe(null);
    });

    it('should handle document with missing optional fields when editing', () => {
      const { result } = renderHook(() => useProjectDetailState());
      const minimalDoc: Document = {
        id: 'doc1',
        title: 'Minimal Doc',
        project_id: 'proj1'
      } as Document;

      act(() => {
        result.current.startEdit(minimalDoc);
      });

      expect(result.current.formData).toEqual({
        title: 'Minimal Doc',
        content: '',
        document_type: '',
        components: {},
        group_id: undefined,
        ai_model: undefined
      });
    });

    it('should start creating a new document', () => {
      const { result } = renderHook(() => useProjectDetailState());

      // First set some existing state
      act(() => {
        result.current.setSelectedDocument(mockDocument);
        result.current.setFormData({
          title: 'Existing',
          content: 'Existing content',
          document_type: 'prompt',
          components: {},
          group_id: undefined,
          ai_model: undefined
        });
      });

      // Then start creating
      act(() => {
        result.current.startCreate();
      });

      expect(result.current.isCreating).toBe(true);
      expect(result.current.selectedDocument).toBe(null);
      expect(result.current.resolvedContent).toBe(null);
      expect(result.current.formData).toEqual({
        title: '',
        content: '',
        document_type: '',
        components: {},
        group_id: undefined,
        ai_model: undefined
      });
    });

    it('should cancel editing/creating', () => {
      const { result } = renderHook(() => useProjectDetailState());

      // First start editing and open some modals
      act(() => {
        result.current.startEdit(mockDocument);
        result.current.openModal('showDocumentPicker');
        result.current.openModal('showKeyInput');
      });

      // Then cancel
      act(() => {
        result.current.cancelEdit();
      });

      expect(result.current.isEditing).toBe(false);
      expect(result.current.isCreating).toBe(false);
      expect(result.current.formData).toEqual({
        title: '',
        content: '',
        document_type: '',
        components: {},
        group_id: undefined,
        ai_model: undefined
      });
      // All modals should be closed
      Object.values(result.current.modals).forEach(modalState => {
        expect(modalState).toBe(false);
      });
    });
  });

  describe('modal-related state setters', () => {
    it('should update component key to add', () => {
      const { result } = renderHook(() => useProjectDetailState());

      act(() => {
        result.current.setComponentKeyToAdd('newKey');
      });

      expect(result.current.componentKeyToAdd).toBe('newKey');
    });

    it('should update key input value', () => {
      const { result } = renderHook(() => useProjectDetailState());

      act(() => {
        result.current.setKeyInputValue('test input');
      });

      expect(result.current.keyInputValue).toBe('test input');
    });

    it('should update source document', () => {
      const { result } = renderHook(() => useProjectDetailState());
      const mockDoc = { id: '1', title: 'Source' } as Document;

      act(() => {
        result.current.setSourceDocument(mockDoc);
      });

      expect(result.current.sourceDocument).toEqual(mockDoc);
    });

    it('should update switcher states', () => {
      const { result } = renderHook(() => useProjectDetailState());

      act(() => {
        result.current.setSwitcherComponentKey('componentKey');
        result.current.setSwitcherGroupId('groupId');
      });

      expect(result.current.switcherComponentKey).toBe('componentKey');
      expect(result.current.switcherGroupId).toBe('groupId');
    });

    it('should update tag selector document id', () => {
      const { result } = renderHook(() => useProjectDetailState());

      act(() => {
        result.current.setTagSelectorDocumentId('docId');
      });

      expect(result.current.tagSelectorDocumentId).toBe('docId');
    });

    it('should update event selector document', () => {
      const { result } = renderHook(() => useProjectDetailState());
      const mockDoc = { id: '1', title: 'Event Doc' } as Document;

      act(() => {
        result.current.setEventSelectorDocument(mockDoc);
      });

      expect(result.current.eventSelectorDocument).toEqual(mockDoc);
    });

    it('should update evolution document', () => {
      const { result } = renderHook(() => useProjectDetailState());
      const mockDoc = { id: '1', title: 'Evolution Doc' } as Document;

      act(() => {
        result.current.setEvolutionDocument(mockDoc);
      });

      expect(result.current.evolutionDocument).toEqual(mockDoc);
    });

    it('should update editing preset', () => {
      const { result } = renderHook(() => useProjectDetailState());
      const mockPreset = { id: '1', name: 'Test Preset' } as Preset;

      act(() => {
        result.current.setEditingPreset(mockPreset);
      });

      expect(result.current.editingPreset).toEqual(mockPreset);
    });

    it('should update document to delete', () => {
      const { result } = renderHook(() => useProjectDetailState());
      const mockDoc = { id: '1', title: 'To Delete' } as Document;

      act(() => {
        result.current.setDocumentToDelete(mockDoc);
      });

      expect(result.current.documentToDelete).toEqual(mockDoc);
    });
  });

  describe('state consistency', () => {
    it('should maintain consistency when switching between edit and create modes', () => {
      const { result } = renderHook(() => useProjectDetailState());
      const mockDoc = { id: '1', title: 'Test', project_id: 'proj1' } as Document;

      // Start editing
      act(() => {
        result.current.startEdit(mockDoc);
      });

      expect(result.current.isEditing).toBe(true);
      expect(result.current.isCreating).toBe(false);

      // Switch to creating - note: startCreate doesn't automatically clear isEditing
      act(() => {
        result.current.startCreate();
      });

      expect(result.current.isEditing).toBe(true); // Still true - startCreate doesn't clear this
      expect(result.current.isCreating).toBe(true);
      expect(result.current.selectedDocument).toBe(null);

      // To properly switch modes, use cancelEdit first
      act(() => {
        result.current.cancelEdit();
        result.current.startCreate();
      });

      expect(result.current.isEditing).toBe(false);
      expect(result.current.isCreating).toBe(true);
    });

    it('should reset resolved content when starting edit or create', () => {
      const { result } = renderHook(() => useProjectDetailState());
      const mockDoc = { id: '1', title: 'Test', project_id: 'proj1' } as Document;

      // Set some resolved content
      act(() => {
        result.current.setResolvedContent('existing content');
      });

      expect(result.current.resolvedContent).toBe('existing content');

      // Start editing - should reset resolved content
      act(() => {
        result.current.startEdit(mockDoc);
      });

      expect(result.current.resolvedContent).toBe(null);

      // Set resolved content again
      act(() => {
        result.current.setResolvedContent('more content');
      });

      // Start creating - should reset resolved content
      act(() => {
        result.current.startCreate();
      });

      expect(result.current.resolvedContent).toBe(null);
    });
  });
});