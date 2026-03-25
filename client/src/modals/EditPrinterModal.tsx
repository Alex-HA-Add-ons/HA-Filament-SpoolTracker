import { useState, useEffect, useCallback } from 'react';
import type { Printer, Spool, HADiscoveredEntity } from '@ha-addon/types';
import './Modal.css';

const ENTITY_SUFFIXES = {
  entityPrintStatus: '_print_status',
  entityTaskName: '_task_name',
  entityPrintWeight: '_print_weight',
  entityCoverImage: '_cover_image',
  entityPrintStart: '_print_start',
} as const;

/** Default domain and attribute per monitored entity (Bambu: cover_image is image entity, attribute entity_picture). */
const ENTITY_DEFAULT_DOMAIN: Record<string, string> = {
  [ENTITY_SUFFIXES.entityPrintStatus]: 'sensor',
  [ENTITY_SUFFIXES.entityTaskName]: 'sensor',
  [ENTITY_SUFFIXES.entityPrintWeight]: 'sensor',
  [ENTITY_SUFFIXES.entityCoverImage]: 'image',
  [ENTITY_SUFFIXES.entityPrintStart]: 'sensor',
};
const ENTITY_ATTRIBUTE: Record<string, string> = {
  [ENTITY_SUFFIXES.entityPrintStatus]: 'state',
  [ENTITY_SUFFIXES.entityTaskName]: 'state',
  [ENTITY_SUFFIXES.entityPrintWeight]: 'state',
  [ENTITY_SUFFIXES.entityCoverImage]: 'entity_picture',
  [ENTITY_SUFFIXES.entityPrintStart]: 'state',
};

export type EditPrinterSaveData = {
  name: string;
  entityPrefix: string;
  haDeviceId: string;
  model?: string;
  activeSpoolId?: string | null;
  entityPrintStatus?: string | null;
  entityTaskName?: string | null;
  entityPrintWeight?: string | null;
  entityCoverImage?: string | null;
  entityPrintStart?: string | null;
};

interface EditPrinterModalProps {
  printer: Printer;
  spools?: Spool[];
  onSave: (data: EditPrinterSaveData) => void;
  onClose: () => void;
  onDiscover?: () => Promise<HADiscoveredEntity[]>;
  /** Optional: fetch current HA state for entity IDs. Used to show "current value" in monitored entities. */
  onFetchEntityStates?: (ids: string[]) => Promise<Record<string, string | null>>;
}

function pickEntityBySuffix(entities: string[], suffix: string): string | null {
  const found = entities.find((e) => e.endsWith(suffix));
  return found ?? null;
}

export default function EditPrinterModal({ printer, spools = [], onSave, onClose, onDiscover, onFetchEntityStates }: EditPrinterModalProps) {
  const [name, setName] = useState(printer.name);
  const [entityPrefix, setEntityPrefix] = useState(printer.entityPrefix);
  const [haDeviceId, setHaDeviceId] = useState(printer.haDeviceId);
  const [model, setModel] = useState(printer.model || '');
  const [activeSpoolId, setActiveSpoolId] = useState(printer.activeSpoolId ?? '');
  const [entityPrintStatus, setEntityPrintStatus] = useState(printer.entityPrintStatus ?? '');
  const [entityTaskName, setEntityTaskName] = useState(printer.entityTaskName ?? '');
  const [entityPrintWeight, setEntityPrintWeight] = useState(printer.entityPrintWeight ?? '');
  const [entityCoverImage, setEntityCoverImage] = useState(printer.entityCoverImage ?? '');
  const [entityPrintStart, setEntityPrintStart] = useState(printer.entityPrintStart ?? '');
  const [discovering, setDiscovering] = useState(false);
  const [entityStates, setEntityStates] = useState<Record<string, string | null>>({});
  const [entityStatesLoading, setEntityStatesLoading] = useState(false);

  useEffect(() => {
    setName(printer.name);
    setEntityPrefix(printer.entityPrefix);
    setHaDeviceId(printer.haDeviceId);
    setModel(printer.model || '');
    setActiveSpoolId(printer.activeSpoolId ?? '');
    setEntityPrintStatus(printer.entityPrintStatus ?? '');
    setEntityTaskName(printer.entityTaskName ?? '');
    setEntityPrintWeight(printer.entityPrintWeight ?? '');
    setEntityCoverImage(printer.entityCoverImage ?? '');
    setEntityPrintStart(printer.entityPrintStart ?? '');
  }, [printer]);

  const prefix = entityPrefix.trim();
  const defaultEntityId = (suffix: string) =>
    prefix ? `${ENTITY_DEFAULT_DOMAIN[suffix] ?? 'sensor'}.${prefix}${suffix}` : '';
  const effectiveEntity = (override: string, suffix: string) =>
    override.trim() ? override.trim() : defaultEntityId(suffix);

  /** Request key for API and display: entity_id or entity_id[attribute] (e.g. image.x_cover_image[entity_picture]). */
  const getRequestKey = (override: string, suffix: string) => {
    const id = effectiveEntity(override, suffix) || defaultEntityId(suffix);
    if (!id) return '';
    const attr = ENTITY_ATTRIBUTE[suffix];
    return attr === 'state' ? id : `${id}[${attr}]`;
  };

  /** Default request key for placeholder / display when no override (includes [attribute] when not state). */
  const defaultRequestKey = (suffix: string) => {
    const id = defaultEntityId(suffix);
    if (!id) return '—';
    const attr = ENTITY_ATTRIBUTE[suffix];
    return attr === 'state' ? id : `${id}[${attr}]`;
  };

  const getRequestIds = useCallback(() => {
    return [
      getRequestKey(entityPrintStatus, ENTITY_SUFFIXES.entityPrintStatus),
      getRequestKey(entityTaskName, ENTITY_SUFFIXES.entityTaskName),
      getRequestKey(entityPrintWeight, ENTITY_SUFFIXES.entityPrintWeight),
      getRequestKey(entityCoverImage, ENTITY_SUFFIXES.entityCoverImage),
      getRequestKey(entityPrintStart, ENTITY_SUFFIXES.entityPrintStart),
    ].filter(Boolean) as string[];
  }, [entityPrefix, entityPrintStatus, entityTaskName, entityPrintWeight, entityCoverImage, entityPrintStart]);

  const fetchEntityStates = useCallback(() => {
    const ids = getRequestIds();
    if (!onFetchEntityStates || ids.length === 0) return;
    setEntityStatesLoading(true);
    onFetchEntityStates(ids)
      .then((data) => setEntityStates(data))
      .catch(() => setEntityStates({}))
      .finally(() => setEntityStatesLoading(false));
  }, [onFetchEntityStates, getRequestIds]);

  useEffect(() => {
    if (onFetchEntityStates && getRequestIds().length > 0) fetchEntityStates();
    else setEntityStates({});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch only when modal opens for this printer
  }, [printer.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: name.trim(),
      entityPrefix: prefix,
      haDeviceId: haDeviceId.trim(),
      model: model.trim() || undefined,
      activeSpoolId: activeSpoolId.trim() || null,
      entityPrintStatus: entityPrintStatus.trim() || null,
      entityTaskName: entityTaskName.trim() || null,
      entityPrintWeight: entityPrintWeight.trim() || null,
      entityCoverImage: entityCoverImage.trim() || null,
      entityPrintStart: entityPrintStart.trim() || null,
    });
  };

  const handleDiscover = async () => {
    if (!onDiscover) return;
    const prefix = entityPrefix.trim();
    const deviceId = haDeviceId.trim();
    if (!prefix && !deviceId) return;
    setDiscovering(true);
    try {
      const list = await onDiscover();
      const match = list.find((e) => e.deviceId === prefix || e.deviceId === deviceId);
      if (!match) {
        setDiscovering(false);
        return;
      }
      const defaultId = (suffix: string) => (prefix ? `${ENTITY_DEFAULT_DOMAIN[suffix] ?? 'sensor'}.${prefix}${suffix}` : '');
      const setOverride = (
        discovered: string | null,
        suffix: string,
        setter: (v: string) => void,
      ) => {
        const def = defaultId(suffix);
        if (!discovered || discovered === def) setter('');
        else setter(discovered);
      };
      setOverride(pickEntityBySuffix(match.entities, ENTITY_SUFFIXES.entityPrintStatus), ENTITY_SUFFIXES.entityPrintStatus, setEntityPrintStatus);
      setOverride(pickEntityBySuffix(match.entities, ENTITY_SUFFIXES.entityTaskName), ENTITY_SUFFIXES.entityTaskName, setEntityTaskName);
      setOverride(pickEntityBySuffix(match.entities, ENTITY_SUFFIXES.entityPrintWeight), ENTITY_SUFFIXES.entityPrintWeight, setEntityPrintWeight);
      setOverride(pickEntityBySuffix(match.entities, ENTITY_SUFFIXES.entityCoverImage), ENTITY_SUFFIXES.entityCoverImage, setEntityCoverImage);
      setOverride(pickEntityBySuffix(match.entities, ENTITY_SUFFIXES.entityPrintStart), ENTITY_SUFFIXES.entityPrintStart, setEntityPrintStart);
      if (onFetchEntityStates) {
        const ids = [
          defaultId(ENTITY_SUFFIXES.entityPrintStatus),
          defaultId(ENTITY_SUFFIXES.entityTaskName),
          defaultId(ENTITY_SUFFIXES.entityPrintWeight),
          defaultId(ENTITY_SUFFIXES.entityCoverImage),
          defaultId(ENTITY_SUFFIXES.entityPrintStart),
        ].filter(Boolean);
        const overrides = [
          pickEntityBySuffix(match.entities, ENTITY_SUFFIXES.entityPrintStatus),
          pickEntityBySuffix(match.entities, ENTITY_SUFFIXES.entityTaskName),
          pickEntityBySuffix(match.entities, ENTITY_SUFFIXES.entityPrintWeight),
          pickEntityBySuffix(match.entities, ENTITY_SUFFIXES.entityCoverImage),
          pickEntityBySuffix(match.entities, ENTITY_SUFFIXES.entityPrintStart),
        ];
        const suffixes = [ENTITY_SUFFIXES.entityPrintStatus, ENTITY_SUFFIXES.entityTaskName, ENTITY_SUFFIXES.entityPrintWeight, ENTITY_SUFFIXES.entityCoverImage, ENTITY_SUFFIXES.entityPrintStart];
        const requestIds = suffixes
          .map((s, i) => {
            const effectiveId = overrides[i] || ids[i];
            if (!effectiveId) return '';
            const attr = ENTITY_ATTRIBUTE[s];
            return attr === 'state' ? effectiveId : `${effectiveId}[${attr}]`;
          })
          .filter(Boolean);
        if (requestIds.length > 0) {
          onFetchEntityStates(requestIds).then((data) => setEntityStates(data)).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Failed to re-discover entities:', err);
    } finally {
      setDiscovering(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Printer</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name *</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Bambu X1C"
            />
          </div>
          <div className="form-group">
            <label>Entity Prefix</label>
            <input
              type="text"
              value={entityPrefix}
              onChange={(e) => setEntityPrefix(e.target.value)}
              placeholder="e.g., p2s_00m09a360200242"
            />
            <span className="form-hint">
              Prefix used to match state changes. Must match your HA entity IDs (e.g. sensor.<strong>{entityPrefix || '…'}</strong>_print_status).
            </span>
          </div>
          <div className="form-group">
            <label>Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g., X1 Carbon"
            />
          </div>
          <div className="form-group">
            <label>HA Device ID</label>
            <input
              type="text"
              value={haDeviceId}
              onChange={(e) => setHaDeviceId(e.target.value)}
              placeholder="e.g., p2s_00m09a360200242"
            />
            <span className="form-hint">
              Unique device identifier in Home Assistant. Usually same as Entity Prefix.
            </span>
          </div>

          <div className="form-group">
            <label>Loaded spool</label>
            <select
              value={activeSpoolId}
              onChange={(e) => setActiveSpoolId(e.target.value)}
            >
              <option value="">None</option>
              {spools.filter((s) => s.archivedAt === null).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.filamentType})
                </option>
              ))}
            </select>
            <span className="form-hint">
              Spool currently loaded on this printer. Used to auto-deduct filament when a print completes and the job has no spool assigned.
            </span>
          </div>

          <div className="form-group monitored-entities">
            <div className="monitored-entities-header">
              <label>Monitored entities</label>
              <div className="monitored-entities-header-actions">
                {onDiscover && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleDiscover}
                    disabled={discovering}
                  >
                    {discovering ? 'Loading…' : 'Re-discover'}
                  </button>
                )}
                {onFetchEntityStates && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={fetchEntityStates}
                    disabled={entityStatesLoading || !prefix}
                  >
                    {entityStatesLoading ? 'Loading…' : 'Refresh values'}
                  </button>
                )}
              </div>
            </div>
            <p className="form-hint">
              Entity IDs used for print status, task name, print weight, cover image, and print start time. Leave override empty to use the default <code>sensor.{prefix || '…'}_*</code>.
            </p>
            <div className="monitored-entity-rows">
              <div className="monitored-entity-row">
                <span className="monitored-entity-label">Print status</span>
                <div className="monitored-entity-effective-line">
                  <code className="monitored-entity-effective">
                    {getRequestKey(entityPrintStatus, ENTITY_SUFFIXES.entityPrintStatus) || defaultRequestKey(ENTITY_SUFFIXES.entityPrintStatus)}
                  </code>
                  {(getRequestKey(entityPrintStatus, ENTITY_SUFFIXES.entityPrintStatus) || defaultRequestKey(ENTITY_SUFFIXES.entityPrintStatus) !== '—') && (
                    <span className="monitored-entity-current">
                      · Current value: {entityStatesLoading ? '…' : (entityStates[getRequestKey(entityPrintStatus, ENTITY_SUFFIXES.entityPrintStatus)] ?? '—')}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={entityPrintStatus}
                  onChange={(e) => setEntityPrintStatus(e.target.value)}
                  placeholder={defaultRequestKey(ENTITY_SUFFIXES.entityPrintStatus)}
                  className="monitored-entity-override"
                />
              </div>
              <div className="monitored-entity-row">
                <span className="monitored-entity-label">Task name</span>
                <div className="monitored-entity-effective-line">
                  <code className="monitored-entity-effective">
                    {getRequestKey(entityTaskName, ENTITY_SUFFIXES.entityTaskName) || defaultRequestKey(ENTITY_SUFFIXES.entityTaskName)}
                  </code>
                  {(getRequestKey(entityTaskName, ENTITY_SUFFIXES.entityTaskName) || defaultRequestKey(ENTITY_SUFFIXES.entityTaskName) !== '—') && (
                    <span className="monitored-entity-current">
                      · Current value: {entityStatesLoading ? '…' : (entityStates[getRequestKey(entityTaskName, ENTITY_SUFFIXES.entityTaskName)] ?? '—')}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={entityTaskName}
                  onChange={(e) => setEntityTaskName(e.target.value)}
                  placeholder={defaultRequestKey(ENTITY_SUFFIXES.entityTaskName)}
                  className="monitored-entity-override"
                />
              </div>
              <div className="monitored-entity-row">
                <span className="monitored-entity-label">Print weight</span>
                <div className="monitored-entity-effective-line">
                  <code className="monitored-entity-effective">
                    {getRequestKey(entityPrintWeight, ENTITY_SUFFIXES.entityPrintWeight) || defaultRequestKey(ENTITY_SUFFIXES.entityPrintWeight)}
                  </code>
                  {(getRequestKey(entityPrintWeight, ENTITY_SUFFIXES.entityPrintWeight) || defaultRequestKey(ENTITY_SUFFIXES.entityPrintWeight) !== '—') && (
                    <span className="monitored-entity-current">
                      · Current value: {entityStatesLoading ? '…' : (entityStates[getRequestKey(entityPrintWeight, ENTITY_SUFFIXES.entityPrintWeight)] ?? '—')}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={entityPrintWeight}
                  onChange={(e) => setEntityPrintWeight(e.target.value)}
                  placeholder={defaultRequestKey(ENTITY_SUFFIXES.entityPrintWeight)}
                  className="monitored-entity-override"
                />
              </div>
              <div className="monitored-entity-row">
                <span className="monitored-entity-label">Cover image</span>
                <div className="monitored-entity-effective-line">
                  <code className="monitored-entity-effective">
                    {getRequestKey(entityCoverImage, ENTITY_SUFFIXES.entityCoverImage) || defaultRequestKey(ENTITY_SUFFIXES.entityCoverImage)}
                  </code>
                  {(getRequestKey(entityCoverImage, ENTITY_SUFFIXES.entityCoverImage) || defaultRequestKey(ENTITY_SUFFIXES.entityCoverImage) !== '—') && (
                    <span className="monitored-entity-current">
                      · Current value: {entityStatesLoading ? '…' : (entityStates[getRequestKey(entityCoverImage, ENTITY_SUFFIXES.entityCoverImage)] ?? '—')}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={entityCoverImage}
                  onChange={(e) => setEntityCoverImage(e.target.value)}
                  placeholder={defaultRequestKey(ENTITY_SUFFIXES.entityCoverImage)}
                  className="monitored-entity-override"
                />
              </div>
              <div className="monitored-entity-row">
                <span className="monitored-entity-label">Print start time</span>
                <div className="monitored-entity-effective-line">
                  <code className="monitored-entity-effective">
                    {getRequestKey(entityPrintStart, ENTITY_SUFFIXES.entityPrintStart) || defaultRequestKey(ENTITY_SUFFIXES.entityPrintStart)}
                  </code>
                  {(getRequestKey(entityPrintStart, ENTITY_SUFFIXES.entityPrintStart) || defaultRequestKey(ENTITY_SUFFIXES.entityPrintStart) !== '—') && (
                    <span className="monitored-entity-current">
                      · Current value: {entityStatesLoading ? '…' : (entityStates[getRequestKey(entityPrintStart, ENTITY_SUFFIXES.entityPrintStart)] ?? '—')}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={entityPrintStart}
                  onChange={(e) => setEntityPrintStart(e.target.value)}
                  placeholder={defaultRequestKey(ENTITY_SUFFIXES.entityPrintStart)}
                  className="monitored-entity-override"
                />
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
