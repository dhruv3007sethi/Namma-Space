import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../api/client';
import { formatBytes } from '../lib/format';
import { Badge } from './ui';

/** Shows which external AI services are wired up. Nothing here is simulated. */
export function IntegrationStatus() {
  const { data } = useQuery({ queryKey: queryKeys.capabilities, queryFn: api.capabilities });
  if (!data) return null;
  const rows = [
    ...data.reconstructionProviders.map((p) => ({ ...p, area: '3D reconstruction' })),
    ...data.visionProviders.map((p) => ({ ...p, area: 'Object detection' })),
  ];
  return (
    <section className="card" aria-labelledby="integrations-title">
      <h2 id="integrations-title">AI integrations</h2>
      <p className="muted small">
        Reconstruction and object detection use external services. Each one stays off until it is
        configured on the server. Uploads up to {formatBytes(data.maxUploadBytes)} are accepted.
      </p>
      <ul className="integration-list">
        {rows.map((r) => (
          <li key={`${r.area}-${r.id}`}>
            <div>
              <div>{r.label}</div>
              <div className="muted small">{r.area}</div>
            </div>
            <Badge tone={r.configured ? 'ok' : 'neutral'}>
              {r.configured ? 'Configured' : 'Not configured'}
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
