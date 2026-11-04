import type { Vec3 } from '@namma/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, lazy, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, queryKeys } from '../api/client';
import { MediaGallery } from '../components/MediaGallery';
import { MediaUploader } from '../components/MediaUploader';
import { PoiPanel } from '../components/PoiPanel';
import { ReconstructionPanel } from '../components/ReconstructionPanel';
import { ErrorMessage, PageHeader, Spinner } from '../components/ui';
import { humanize } from '../lib/format';

const SpaceViewer = lazy(() => import('../components/SpaceViewer'));

const TABS = ['viewer', 'captures'] as const;
type Tab = (typeof TABS)[number];

export function SpacePage() {
  const { spaceId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'captures' ? 'captures' : 'viewer';
  const qc = useQueryClient();
  const navigate = useNavigate();

  const space = useQuery({
    queryKey: queryKeys.space(spaceId),
    queryFn: () => api.getSpace(spaceId),
  });
  const projectId = space.data?.projectId;
  const project = useQuery({
    queryKey: queryKeys.project(projectId ?? ''),
    queryFn: () => api.getProject(projectId!),
    enabled: !!projectId,
  });
  const media = useQuery({
    queryKey: queryKeys.media(spaceId),
    queryFn: () => api.listMedia(spaceId),
  });
  const pois = useQuery({
    queryKey: queryKeys.pois(spaceId),
    queryFn: () => api.listPois(spaceId),
  });

  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(params.get('poi'));
  const [draft, setDraft] = useState<Vec3 | null>(null);
  const [pickMode, setPickMode] = useState(false);

  const deleteSpace = useMutation({
    mutationFn: () => api.deleteSpace(spaceId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects'] });
      navigate(projectId ? `/projects/${projectId}` : '/');
    },
  });

  if (space.isPending) return <Spinner />;
  if (space.isError) return <ErrorMessage error={space.error} title="Could not load space" />;
  const s = space.data;

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link to="/">Projects</Link>
            <span aria-hidden> / </span>
            <Link to={`/projects/${s.projectId}`}>{project.data?.name ?? 'Project'}</Link>
          </>
        }
        title={s.name}
        subtitle={`${humanize(s.spaceType)}${s.floorLevel !== null ? ` · floor ${s.floorLevel}` : ''} · ${s.mediaCount} ${s.mediaCount === 1 ? 'capture' : 'captures'}`}
        actions={
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              if (window.confirm(`Delete "${s.name}" and its captures?`)) deleteSpace.mutate();
            }}
          >
            Delete space
          </button>
        }
      />
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            className={`tab${tab === t ? ' tab-active' : ''}`}
            onClick={() => setParams(t === 'viewer' ? {} : { tab: t }, { replace: true })}
          >
            {t === 'viewer' ? '3D view & points' : `Captures (${s.mediaCount})`}
          </button>
        ))}
      </div>

      {tab === 'viewer' ? (
        <div className="viewer-layout">
          <Suspense
            fallback={
              <div className="viewer viewer-loading">
                <Spinner label="Loading 3D view…" />
              </div>
            }
          >
            <SpaceViewer
              pois={pois.data ?? []}
              selectedPoiId={selectedPoiId}
              onSelectPoi={setSelectedPoiId}
              pickMode={pickMode}
              draftPosition={draft}
              onPickFloor={(p) => {
                setDraft(p);
                setPickMode(false);
              }}
            />
          </Suspense>
          <aside className="card">
            {pois.isError ? (
              <ErrorMessage error={pois.error} />
            ) : (
              <PoiPanel
                spaceId={spaceId}
                pois={pois.data ?? []}
                selectedPoiId={selectedPoiId}
                onSelect={setSelectedPoiId}
                draftPosition={draft}
                onDraftPositionChange={setDraft}
                pickMode={pickMode}
                onPickModeChange={setPickMode}
              />
            )}
          </aside>
        </div>
      ) : (
        <div className="grid-2">
          <section className="stack">
            <MediaUploader spaceId={spaceId} />
            {media.isPending && <Spinner />}
            {media.isError && <ErrorMessage error={media.error} />}
            {media.data && <MediaGallery spaceId={spaceId} media={media.data} />}
          </section>
          <ReconstructionPanel spaceId={spaceId} mediaCount={s.mediaCount} />
        </div>
      )}
    </>
  );
}
