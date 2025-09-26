import { useGlobalStore } from '../../store';

export function useUI() {
  return useGlobalStore((state) => state.ui);
}

export function useModals() {
  return useGlobalStore((state) => state.ui.modals);
}

export function useModalActions() {
  const openModal = useGlobalStore((state) => state.openModal);
  const closeModal = useGlobalStore((state) => state.closeModal);
  const closeAllModals = useGlobalStore((state) => state.closeAllModals);

  return { openModal, closeModal, closeAllModals };
}

export function useEditingState() {
  const isEditing = useGlobalStore((state) => state.ui.isEditing);
  const isCreating = useGlobalStore((state) => state.ui.isCreating);

  return { isEditing, isCreating };
}

export function useDocumentManagement() {
  const startEdit = useGlobalStore((state) => state.startEdit);
  const startCreate = useGlobalStore((state) => state.startCreate);
  const cancelEdit = useGlobalStore((state) => state.cancelEdit);

  return { startEdit, startCreate, cancelEdit };
}

export function useForm() {
  return useGlobalStore((state) => state.form.formData);
}

export function useFormActions() {
  const setFormData = useGlobalStore((state) => state.setFormData);
  const updateFormData = useGlobalStore((state) => state.updateFormData);
  const resetForm = useGlobalStore((state) => state.resetForm);

  return { setFormData, updateFormData, resetForm };
}

export function useSidebars() {
  const sidebarOpen = useGlobalStore((state) => state.ui.sidebarOpen);
  const leftSidebarOpen = useGlobalStore((state) => state.ui.leftSidebarOpen);
  const rightSidebarOpen = useGlobalStore((state) => state.ui.rightSidebarOpen);

  return { sidebarOpen, leftSidebarOpen, rightSidebarOpen };
}

export function useSidebarActions() {
  const setSidebarOpen = useGlobalStore((state) => state.setSidebarOpen);
  const setLeftSidebarOpen = useGlobalStore((state) => state.setLeftSidebarOpen);
  const setRightSidebarOpen = useGlobalStore((state) => state.setRightSidebarOpen);

  return { setSidebarOpen, setLeftSidebarOpen, setRightSidebarOpen };
}

export function useDragState() {
  return useGlobalStore((state) => state.drag);
}

export function useDragActions() {
  const startDrag = useGlobalStore((state) => state.startDrag);
  const endDrag = useGlobalStore((state) => state.endDrag);
  const setDropTarget = useGlobalStore((state) => state.setDropTarget);

  return { startDrag, endDrag, setDropTarget };
}