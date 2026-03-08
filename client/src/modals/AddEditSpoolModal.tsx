import { useState } from 'react';
import type { Spool, SpoolCreateRequest } from '@ha-addon/types';
import './Modal.css';

const FILAMENT_TYPES = ['PLA', 'PETG', 'TPU', 'ABS', 'ASA', 'Nylon', 'PC', 'PVA', 'HIPS', 'Other'];

const PRESET_COLORS: { name: string; hex: string }[] = [
  { name: 'White', hex: '#ffffff' },
  { name: 'Black', hex: '#1a1a1a' },
  { name: 'Gray', hex: '#808080' },
  { name: 'Red', hex: '#d62828' },
  { name: 'Orange', hex: '#f77f00' },
  { name: 'Yellow', hex: '#fcbf49' },
  { name: 'Green', hex: '#2d6a4f' },
  { name: 'Lime', hex: '#80b918' },
  { name: 'Blue', hex: '#1d3557' },
  { name: 'Light Blue', hex: '#48cae4' },
  { name: 'Purple', hex: '#7b2cbf' },
  { name: 'Pink', hex: '#ff69b4' },
  { name: 'Brown', hex: '#6f4518' },
  { name: 'Beige', hex: '#d4a373' },
  { name: 'Silver', hex: '#c0c0c0' },
  { name: 'Gold', hex: '#c9a227' },
  { name: 'Transparent', hex: '#e8e8e8' },
];

interface AddEditSpoolModalProps {
  spool?: Spool | null;
  onSave: (data: SpoolCreateRequest) => void;
  onCancel: () => void;
}

export default function AddEditSpoolModal({ spool, onSave, onCancel }: AddEditSpoolModalProps) {
  const [name, setName] = useState(spool?.name ?? '');
  const [filamentType, setFilamentType] = useState(spool?.filamentType ?? 'PLA');
  const [selectedColor, setSelectedColor] = useState(() => {
    if (spool?.color) {
      const match = PRESET_COLORS.find((c) => c.name === spool.color);
      return match?.name ?? PRESET_COLORS[0].name;
    }
    return PRESET_COLORS[0].name;
  });
  const [manufacturer, setManufacturer] = useState(spool?.manufacturer ?? '');
  const [initialWeight, setInitialWeight] = useState(String(spool?.initialWeight ?? 1000));
  const [remainingWeight, setRemainingWeight] = useState(String(spool?.remainingWeight ?? spool?.initialWeight ?? 1000));
  const [spoolWeight, setSpoolWeight] = useState(String(spool?.spoolWeight ?? ''));
  const [diameter, setDiameter] = useState(String(spool?.diameter ?? 1.75));
  const [purchaseDate, setPurchaseDate] = useState(spool?.purchaseDate?.split('T')[0] ?? '');
  const [expirationDate, setExpirationDate] = useState(spool?.expirationDate?.split('T')[0] ?? '');
  const [notes, setNotes] = useState(spool?.notes ?? '');

  const getColorHex = () => PRESET_COLORS.find((c) => c.name === selectedColor)?.hex ?? '#ffffff';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const autoName = name.trim() || `${filamentType} - ${selectedColor}`;
    onSave({
      name: autoName,
      filamentType,
      color: selectedColor,
      colorHex: getColorHex(),
      manufacturer: manufacturer || undefined,
      initialWeight: parseFloat(initialWeight),
      remainingWeight: parseFloat(remainingWeight),
      spoolWeight: spoolWeight ? parseFloat(spoolWeight) : undefined,
      diameter: parseFloat(diameter),
      purchaseDate: purchaseDate || undefined,
      expirationDate: expirationDate || undefined,
      notes: notes || undefined,
    });
  };

  const isEditing = !!spool;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{isEditing ? 'Edit Spool' : 'Add New Spool'}</h3>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>Filament Type *</label>
              <select value={filamentType} onChange={(e) => setFilamentType(e.target.value)} autoFocus>
                {FILAMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`${filamentType} - ${selectedColor}`}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Color *</label>
            <div className="color-palette">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={`color-swatch ${selectedColor === c.name ? 'selected' : ''}`}
                  style={{ backgroundColor: c.hex }}
                  onClick={() => setSelectedColor(c.name)}
                  title={c.name}
                />
              ))}
            </div>
            <span className="form-hint">Selected: {selectedColor}</span>
          </div>

          <div className="form-group">
            <label>Manufacturer</label>
            <input type="text" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="e.g., Bambu Lab, Prusament..." />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Initial Weight (g) *</label>
              <input type="number" value={initialWeight} onChange={(e) => setInitialWeight(e.target.value)} min="1" required />
            </div>
            <div className="form-group">
              <label>Remaining Weight (g) *</label>
              <input type="number" value={remainingWeight} onChange={(e) => setRemainingWeight(e.target.value)} min="0" required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Spool Weight (g)</label>
              <input type="number" value={spoolWeight} onChange={(e) => setSpoolWeight(e.target.value)} min="0" placeholder="Empty spool weight" />
            </div>
            <div className="form-group">
              <label>Diameter (mm)</label>
              <input type="number" value={diameter} onChange={(e) => setDiameter(e.target.value)} min="1" step="0.01" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Purchase Date</label>
              <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Expiration Date</label>
              <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes..." />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn btn-primary">{isEditing ? 'Save Changes' : 'Add Spool'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
