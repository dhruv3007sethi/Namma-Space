import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, queryKeys } from '../api/client';
import { IntegrationStatus } from '../components/IntegrationStatus';
import { EmptyState, ErrorMessage, PageHeader, Spinner } from '../components/ui';
import { formatRelativeTime } from '../lib/format';

export function ProjectsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const projects = useQuery({ queryKey: queryKeys.projects, queryFn: api.listProjects });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const create = useMutation({
    mutationFn: () => api.createProject({ name, ...(description.trim() && { description }) }),
    onSuccess: (project) => {
      void qc.invalidateQueries({ queryKey: queryKeys.projects });
      navigate(`/projects/${project.id}`);
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate();
  };

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Each project groups the rooms, floors and buildings you capture."
      />
      <div className="grid-2">
        <section aria-label="Project list">
          {projects.isPending && <Spinner />}
          {projects.isError && (
            <ErrorMessage error={projects.error} title="Could not load projects" />
          )}
          {projects.data?.length === 0 && (
            <EmptyState title="No projects yet">
              Create your first project to start capturing spaces.
            </EmptyState>
          )}
          {projects.data && projects.data.length > 0 && (
            <ul className="card-list">
              {projects.data.map((p) => (
                <li key={p.id}>
                  <Link to={`/projects/${p.id}`} className="card card-link">
                    <h2>{p.name}</h2>
                    {p.description && <p className="muted">{p.description}</p>}
                    <p className="small muted">
                      {p.spaceCount} {p.spaceCount === 1 ? 'space' : 'spaces'} · updated{' '}
                      {formatRelativeTime(p.updatedAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="stack">
          <form className="card form" onSubmit={onSubmit} aria-label="Create project">
            <h2>New project</h2>
            <label>
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Koramangala office"
                maxLength={120}
                required
              />
            </label>
            <label>
              <span>
                Description <span className="muted small">(optional)</span>
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={2000}
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim() || create.isPending}
            >
              {create.isPending ? 'Creating…' : 'Create project'}
            </button>
            {create.isError && (
              <ErrorMessage error={create.error} title="Could not create project" />
            )}
          </form>
          <IntegrationStatus />
        </aside>
      </div>
    </>
  );
}
