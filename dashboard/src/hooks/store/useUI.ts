import { useGlobalStore } from '../../store';
import type { GlobalState, GlobalStateActions } from '../../store/types';

export function useUI() {
  return useGlobalStore((state: GlobalState & GlobalStateActions) => state.ui);
}

export function useModals() {
  return useGlobalStore((state: GlobalState & GlobalStateActions) => state.ui.modals);
}

export function useModalActions() {
  const openModal = useGlobalStore((state: GlobalState & GlobalStateActions) => state.openModal);
  const closeModal = useGlobalStore((state: GlobalState & GlobalStateActions) => state.closeModal);
  const closeAllModals = useGlobalStore((state: GlobalState & GlobalStateActions) => state.closeAllModals);

  return { openModal, closeModal, closeAllModals };
}

export function useEditingState() {
  const isEditing = useGlobalStore((state: GlobalState & GlobalStateActions) => state.ui.isEditing);
  const isCreating = useGlobalStore((state: GlobalState & GlobalStateActions) => state.ui.isCreating);

  return { isEditing, isCreating };
}

export function useDocumentManagement() {
  const startEdit = useGlobalStore((state: GlobalState & GlobalStateActions) => state.startEdit);
  const startCreate = useGlobalStore((state: GlobalState & GlobalStateActions) => state.startCreate);
  const cancelEdit = useGlobalStore((state: GlobalState & GlobalStateActions) => state.cancelEdit);

  return { startEdit, startCreate, cancelEdit };
}

export function useForm() {
  return useGlobalStore((state: GlobalState & GlobalStateActions) => state.form.formData);
}

export function useFormActions() {
  const setFormData = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setFormData);
  const updateFormData = useGlobalStore((state: GlobalState & GlobalStateActions) => state.updateFormData);
  const resetForm = useGlobalStore((state: GlobalState & GlobalStateActions) => state.resetForm);

  return { setFormData, updateFormData, resetForm };
}

export function useSidebars() {
  const sidebarOpen = useGlobalStore((state: GlobalState & GlobalStateActions) => state.ui.sidebarOpen);
  const leftSidebarOpen = useGlobalStore((state: GlobalState & GlobalStateActions) => state.ui.leftSidebarOpen);
  const rightSidebarOpen = useGlobalStore((state: GlobalState & GlobalStateActions) => state.ui.rightSidebarOpen);

  return { sidebarOpen, leftSidebarOpen, rightSidebarOpen };
}

export function useSidebarActions() {
  const setSidebarOpen = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setSidebarOpen);
  const setLeftSidebarOpen = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setLeftSidebarOpen);
  const setRightSidebarOpen = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setRightSidebarOpen);

  return { setSidebarOpen, setLeftSidebarOpen, setRightSidebarOpen };
}

export function useDragState() {
  return useGlobalStore((state: GlobalState & GlobalStateActions) => state.drag);
}

export function useDragActions() {
  const startDrag = useGlobalStore((state: GlobalState & GlobalStateActions) => state.startDrag);
  const endDrag = useGlobalStore((state: GlobalState & GlobalStateActions) => state.endDrag);
  const setDropTarget = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setDropTarget);

  return { startDrag, endDrag, setDropTarget };
}