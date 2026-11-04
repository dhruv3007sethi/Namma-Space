import type { MediaAsset } from '@namma/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, mediaUrl, queryKeys } from '../api/client';
import { formatBytes, formatRelativeTime } from '../lib/format';
import { EmptyState } from './ui';

export function MediaGallery({ spaceId, media }: { spaceId: string; media: MediaAsset[] }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: api.deleteMedia,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.media(spaceId) });
      void qc.invalidateQueries({ queryKey: queryKeys.space(spaceId) });
    },
  });

  if (media.length === 0) {
    return (
      <EmptyState title="No captures yet">
        Walk the room slowly and take overlapping photos from several heights, or record a steady
        video.
      </EmptyState>
    );
  }

  return (
    <ul className="gallery">
      {media.map((m) => (
        <li key={m.id} className="gallery-item">
          <a href={mediaUrl(m)} target="_blank" rel="noreferrer" className="gallery-thumb">
            {m.kind === 'image' ? (
              <img src={mediaUrl(m)} alt={m.originalFilename} loading="lazy" />
            ) : (
              <video src={mediaUrl(m)} preload="metadata" muted />
            )}
          </a>
          <div className="gallery-meta">
            <span className="truncate" title={m.originalFilename}>
              {m.originalFilename}
            </span>
            <span className="muted small">
              {m.kind} · {formatBytes(m.sizeBytes)} · {formatRelativeTime(m.createdAt)}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            aria-label={`Delete ${m.originalFilename}`}
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm(`Delete ${m.originalFilename}?`)) remove.mutate(m.id);
            }}
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
