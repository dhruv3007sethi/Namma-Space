import { SPACE_TYPES, type SpaceType } from '@namma/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, queryKeys } from '../api/client';
import { EmptyState, ErrorMessage, PageHeader, Spinner } from '../components/ui';
import { formatRelativeTime, humanize } from '../lib/format';

export function ProjectPage() {
  const { projectId = '' } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const project = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => api.getProject(projectId),
  });
  const spaces = useQuery({
    queryKey: queryKeys.spaces(projectId),
    queryFn: () => api.listSpaces(projectId),
  });

  const [name, setName] = useState('');
  const [spaceType, setSpaceType] = useState<SpaceType>('room');
  const [floorLevel, setFloorLevel] = useState('');

  const createSpace = useMutation({
    mutationFn: () =>
      api.createSpace(projectId, {
        name,
        spaceType,
        floorLevel: floorLevel.trim() === '' ? null : Number(floorLevel),
      }),
    onSuccess: (space) => {
      void qc.invalidateQueries({ queryKey: queryKeys.spaces(projectId) });
      void qc.invalidateQueries({ queryKey: queryKeys.projects });
      navigate(`/spaces/${space.id}`);
    },
  });

  const deleteProject = useMutation({
    mutationFn: () => api.deleteProject(projectId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.projects });
      navigate('/');
    },
  });

  if (project.isPending) return <Spinner />;
  if (project.isError) return <ErrorMessage error={project.error} title="Could not load project" />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) createSpace.mutate();
  };

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/">Projects</Link>}
        title={project.data.name}
        subtitle={project.data.description}
        actions={
          <button
            type="button"
            className="btn btn-danger"
            disabled={deleteProject.isPending}
            onClick={() => {
              if (
                window.confirm(`Delete "${project.data.name}" and all of its spaces and captures?`)
              ) {
                deleteProject.mutate();
              }
            }}
          >
            Delete project
          </button>
        }
      />
      {deleteProject.isError && <ErrorMessage error={deleteProject.error} />}
      <div className="grid-2">
        <section aria-label="Spaces">
          {spaces.isPending && <Spinner />}
          {spaces.isError && <ErrorMessage error={spaces.error} />}
          {spaces.data?.length === 0 && (
            <EmptyState title="No spaces yet">
              Add a room or floor, then upload captures of it.
            </EmptyState>
          )}
          {spaces.data && spaces.data.length > 0 && (
            <ul className="card-list">
              {spaces.data.map((s) => (
                <li key={s.id}>
                  <Link to={`/spaces/${s.id}`} className="card card-link">
                    <h2>{s.name}</h2>
                    <p className="small muted">
                      {humanize(s.spaceType)}
                      {s.floorLevel !== null && ` · floor ${s.floorLevel}`} · {s.mediaCount}{' '}
                      {s.mediaCount === 1 ? 'capture' : 'captures'} · created{' '}
                      {formatRelativeTime(s.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <form className="card form" onSubmit={onSubmit} aria-label="Create space">
          <h2>New space</h2>
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Conference room"
              maxLength={120}
              required
            />
          </label>
          <label>
            Type
            <select value={spaceType} onChange={(e) => setSpaceType(e.target.value as SpaceType)}>
              {SPACE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>
              Floor level <span className="muted small">(optional)</span>
            </span>
            <input
              type="number"
              step={1}
              value={floorLevel}
              onChange={(e) => setFloorLevel(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!name.trim() || createSpace.isPending}
          >
            {createSpace.isPending ? 'Creating…' : 'Add space'}
          </button>
          {createSpace.isError && (
            <ErrorMessage error={createSpace.error} title="Could not create space" />
          )}
        </form>
      </div>
    </>
  );
}
