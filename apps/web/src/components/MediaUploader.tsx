import { ACCEPTED_MEDIA_MIME_TYPES } from '@namma/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type DragEvent } from 'react';
import { queryKeys, uploadMedia, type UploadProgress } from '../api/client';
import { formatBytes } from '../lib/format';
import { ErrorMessage } from './ui';

export function MediaUploader({ spaceId }: { spaceId: string }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [dragging, setDragging] = useState(false);

  const mutation = useMutation({
    mutationFn: (files: File[]) => uploadMedia(spaceId, files, setProgress),
    onSettled: () => {
      setProgress(null);
      void qc.invalidateQueries({ queryKey: queryKeys.media(spaceId) });
      void qc.invalidateQueries({ queryKey: queryKeys.space(spaceId) });
    },
  });

  const submit = (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length > 0) mutation.mutate(files);
    if (input.current) input.current.value = '';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!mutation.isPending) submit(e.dataTransfer.files);
  };

  const percent =
    progress && progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;

  return (
    <div>
      <div
        className={`dropzone${dragging ? ' dropzone-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {mutation.isPending ? (
          <div className="upload-progress">
            <div
              className="progress"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="progress-bar" style={{ width: `${percent}%` }} />
            </div>
            <span className="small muted">
              Uploading… {percent}%
              {progress && ` (${formatBytes(progress.loaded)} of ${formatBytes(progress.total)})`}
            </span>
          </div>
        ) : (
          <>
            <p>
              <strong>Drop photos or videos here</strong>
            </p>
            <p className="muted small">JPEG, PNG, WebP, HEIC, MP4, MOV or WebM</p>
            <button type="button" className="btn" onClick={() => input.current?.click()}>
              Choose files
            </button>
          </>
        )}
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept={ACCEPTED_MEDIA_MIME_TYPES.join(',')}
          onChange={(e) => submit(e.target.files)}
          data-testid="media-input"
        />
      </div>
      {mutation.isError && <ErrorMessage error={mutation.error} title="Upload failed" />}
    </div>
  );
}
