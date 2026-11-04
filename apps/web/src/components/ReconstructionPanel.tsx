import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, queryKeys } from '../api/client';
import { formatRelativeTime, humanize } from '../lib/format';
import { Badge, ErrorMessage } from './ui';

const TONE = {
  queued: 'neutral',
  processing: 'warn',
  succeeded: 'ok',
  failed: 'error',
  cancelled: 'neutral',
} as const;

export function ReconstructionPanel({
  spaceId,
  mediaCount,
}: {
  spaceId: string;
  mediaCount: number;
}) {
  const qc = useQueryClient();
  const caps = useQuery({ queryKey: queryKeys.capabilities, queryFn: api.capabilities });
  const jobs = useQuery({
    queryKey: queryKeys.reconstructions(spaceId),
    queryFn: () => api.listReconstructions(spaceId),
  });
  const start = useMutation({
    mutationFn: () => api.startReconstruction(spaceId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.reconstructions(spaceId) }),
  });

  const configured = caps.data?.reconstructionProviders.some((p) => p.configured) ?? false;

  return (
    <section className="card">
      <h2>3D reconstruction</h2>
      {!configured ? (
        <p className="muted small">
          No reconstruction provider is configured on the server yet, so 3D models can't be
          generated. Uploaded captures are kept and can be processed once a provider is connected.
        </p>
      ) : mediaCount === 0 ? (
        <p className="muted small">Upload photos or a video of the room first.</p>
      ) : null}
      <button
        type="button"
        className="btn btn-primary"
        disabled={!configured || mediaCount === 0 || start.isPending}
        onClick={() => start.mutate()}
      >
        {start.isPending ? 'Submitting…' : 'Generate 3D model'}
      </button>
      {start.isError && <ErrorMessage error={start.error} title="Could not start reconstruction" />}
      {jobs.data && jobs.data.length > 0 && (
        <ul className="job-list">
          {jobs.data.map((j) => (
            <li key={j.id}>
              <Badge tone={TONE[j.status]}>{humanize(j.status)}</Badge>
              <span className="small">{j.provider}</span>
              <span className="muted small">{formatRelativeTime(j.createdAt)}</span>
              {j.errorMessage && <span className="small error-text">{j.errorMessage}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
