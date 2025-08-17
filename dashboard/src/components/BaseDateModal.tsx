
export interface BaseDateModalProps {
  isOpen: boolean;
  baseDate: Date;
  onBaseDateChange: (date: Date) => void;
  onSave: (date: Date) => Promise<void>;
  onClose: () => void;
  timeToDate: (timeValue: number) => Date;
}

export function BaseDateModal({
  isOpen,
  baseDate,
  onBaseDateChange,
  onSave,
  onClose,
  timeToDate
}: BaseDateModalProps) {
  
  if (!isOpen) return null;

  const handleSave = async () => {
    await onSave(baseDate);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Set Base Date</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Base Date (T0)</label>
            <p className="help-text">
              This date corresponds to T0. All timeline values will be calculated relative to this date.
            </p>
            <input
              type="date"
              value={baseDate.toISOString().split('T')[0]}
              onChange={(e) => onBaseDateChange(new Date(e.target.value))}
            />
          </div>
          <div className="form-group">
            <label>Preview</label>
            <div className="date-preview">
              <p>T0 = {baseDate.toLocaleDateString()}</p>
              <p>T5 = {timeToDate(5).toLocaleDateString()}</p>
              <p>T10 = {timeToDate(10).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="form-actions">
            <button 
              className="btn btn--secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              className="btn btn--primary"
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}