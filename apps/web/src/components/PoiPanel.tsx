import { POI_CATEGORIES, type PointOfInterest, type PoiCategory, type Vec3 } from '@namma/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api, queryKeys } from '../api/client';
import { humanize } from '../lib/format';
import { ErrorMessage } from './ui';

interface Props {
  spaceId: string;
  pois: PointOfInterest[];
  selectedPoiId: string | null;
  onSelect: (id: string | null) => void;
  draftPosition: Vec3 | null;
  onDraftPositionChange: (p: Vec3 | null) => void;
  pickMode: boolean;
  onPickModeChange: (on: boolean) => void;
}

const num = (v: string) => (v.trim() === '' ? NaN : Number(v));

export function PoiPanel({
  spaceId,
  pois,
  selectedPoiId,
  onSelect,
  draftPosition,
  onDraftPositionChange,
  pickMode,
  onPickModeChange,
}: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PoiCategory>('furniture');
  const [description, setDescription] = useState('');
  const position = draftPosition ?? { x: 0, y: 0, z: 0 };

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.pois(spaceId) });
    void qc.invalidateQueries({ queryKey: ['pois', 'search'] });
  };

  const create = useMutation({
    mutationFn: () =>
      api.createPoi(spaceId, {
        name,
        category,
        position,
        ...(description.trim() && { description }),
      }),
    onSuccess: (poi) => {
      setName('');
      setDescription('');
      onDraftPositionChange(null);
      onPickModeChange(false);
      onSelect(poi.id);
      invalidate();
    },
  });

  const remove = useMutation({ mutationFn: api.deletePoi, onSuccess: invalidate });

  const setAxis = (axis: keyof Vec3, value: string) =>
    onDraftPositionChange({ ...position, [axis]: num(value) });

  const valid =
    name.trim().length > 0 && [position.x, position.y, position.z].every(Number.isFinite);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) create.mutate();
  };

  return (
    <div className="poi-panel">
      <form className="form" onSubmit={onSubmit} aria-label="Add point of interest">
        <h3>Add point of interest</h3>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
        </label>
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value as PoiCategory)}>
            {POI_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {humanize(c)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            Description <span className="muted small">(optional)</span>
          </span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
          />
        </label>
        <fieldset className="vec3">
          <legend>Position (metres)</legend>
          {(['x', 'y', 'z'] as const).map((axis) => (
            <label key={axis}>
              {axis}
              <input
                type="number"
                step="0.01"
                value={Number.isFinite(position[axis]) ? position[axis] : ''}
                onChange={(e) => setAxis(axis, e.target.value)}
              />
            </label>
          ))}
        </fieldset>
        <div className="row">
          <button
            type="button"
            className={`btn${pickMode ? ' btn-active' : ''}`}
            onClick={() => onPickModeChange(!pickMode)}
            aria-pressed={pickMode}
          >
            {pickMode ? 'Picking on floor…' : 'Pick on floor'}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!valid || create.isPending}>
            {create.isPending ? 'Saving…' : 'Add point'}
          </button>
        </div>
        {create.isError && <ErrorMessage error={create.error} title="Could not add point" />}
      </form>

      <h3>Points in this space ({pois.length})</h3>
      {pois.length === 0 ? (
        <p className="muted small">
          No points yet. Add doors, exits and landmarks to make them searchable.
        </p>
      ) : (
        <ul className="poi-list">
          {pois.map((p) => (
            <li key={p.id} className={p.id === selectedPoiId ? 'selected' : undefined}>
              <button type="button" className="poi-list-main" onClick={() => onSelect(p.id)}>
                <span>{p.name}</span>
                <span className="muted small">
                  {humanize(p.category)} · ({p.position.x}, {p.position.y}, {p.position.z})
                </span>
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                aria-label={`Delete ${p.name}`}
                onClick={() => {
                  if (window.confirm(`Delete ${p.name}?`)) remove.mutate(p.id);
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
