import {
  API_PREFIX,
  type ApiErrorBody,
  type Capabilities,
  type CreatePoiInput,
  type CreateProjectInput,
  type CreateSpaceInput,
  type Health,
  type MediaAsset,
  type PointOfInterest,
  type PoiSearchQuery,
  type Project,
  type ReconstructionJob,
  type Space,
  type UpdatePoiInput,
  type UpdateProjectInput,
  type UpdateSpaceInput,
} from '@namma/shared';

/** Base URL of the API. Empty means same-origin (Vite dev proxy or reverse proxy). */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  override name = 'ApiError';
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return new ApiError(res.status, body.error.code, body.error.message, body.error.details);
  } catch {
    return new ApiError(res.status, 'INTERNAL_ERROR', `Request failed with status ${res.status}`);
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !(init.body instanceof FormData)) {
    headers.set('content-type', 'application/json');
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the Namma Space API');
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const unwrap = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);
const json = (body: unknown) => JSON.stringify(body);

export const mediaUrl = (asset: Pick<MediaAsset, 'url'>) => `${API_BASE_URL}${asset.url}`;

export interface UploadProgress {
  loaded: number;
  total: number;
}

/** Uploads files with progress reporting (fetch lacks upload progress events). */
export function uploadMedia(
  spaceId: string,
  files: File[],
  onProgress?: (p: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<MediaAsset[]> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    for (const f of files) form.append('files', f, f.name);

    xhr.open('POST', `${API_BASE_URL}${API_PREFIX}/spaces/${spaceId}/media`);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.({ loaded: e.loaded, total: e.total });
    };
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK_ERROR', 'Upload failed: network error'));
    xhr.onabort = () => reject(new ApiError(0, 'ABORTED', 'Upload cancelled'));
    xhr.onload = () => {
      const body = xhr.response as { data: MediaAsset[] } | ApiErrorBody | null;
      if (xhr.status >= 200 && xhr.status < 300 && body && 'data' in body) {
        resolve(body.data);
      } else if (body && 'error' in body) {
        reject(new ApiError(xhr.status, body.error.code, body.error.message, body.error.details));
      } else {
        reject(new ApiError(xhr.status, 'INTERNAL_ERROR', `Upload failed (${xhr.status})`));
      }
    };
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(form);
  });
}

export const api = {
  health: () => request<Health>('/health'),
  capabilities: () => unwrap(request<{ data: Capabilities }>(`${API_PREFIX}/capabilities`)),

  listProjects: () => unwrap(request<{ data: Project[] }>(`${API_PREFIX}/projects`)),
  getProject: (id: string) => unwrap(request<{ data: Project }>(`${API_PREFIX}/projects/${id}`)),
  createProject: (input: CreateProjectInput) =>
    unwrap(
      request<{ data: Project }>(`${API_PREFIX}/projects`, { method: 'POST', body: json(input) }),
    ),
  updateProject: (id: string, input: UpdateProjectInput) =>
    unwrap(
      request<{ data: Project }>(`${API_PREFIX}/projects/${id}`, {
        method: 'PATCH',
        body: json(input),
      }),
    ),
  deleteProject: (id: string) =>
    request<void>(`${API_PREFIX}/projects/${id}`, { method: 'DELETE' }),

  listSpaces: (projectId: string) =>
    unwrap(request<{ data: Space[] }>(`${API_PREFIX}/projects/${projectId}/spaces`)),
  getSpace: (id: string) => unwrap(request<{ data: Space }>(`${API_PREFIX}/spaces/${id}`)),
  createSpace: (projectId: string, input: CreateSpaceInput) =>
    unwrap(
      request<{ data: Space }>(`${API_PREFIX}/projects/${projectId}/spaces`, {
        method: 'POST',
        body: json(input),
      }),
    ),
  updateSpace: (id: string, input: UpdateSpaceInput) =>
    unwrap(
      request<{ data: Space }>(`${API_PREFIX}/spaces/${id}`, {
        method: 'PATCH',
        body: json(input),
      }),
    ),
  deleteSpace: (id: string) => request<void>(`${API_PREFIX}/spaces/${id}`, { method: 'DELETE' }),

  listMedia: (spaceId: string) =>
    unwrap(request<{ data: MediaAsset[] }>(`${API_PREFIX}/spaces/${spaceId}/media`)),
  deleteMedia: (id: string) => request<void>(`${API_PREFIX}/media/${id}`, { method: 'DELETE' }),

  listPois: (spaceId: string) =>
    unwrap(request<{ data: PointOfInterest[] }>(`${API_PREFIX}/spaces/${spaceId}/pois`)),
  createPoi: (spaceId: string, input: CreatePoiInput) =>
    unwrap(
      request<{ data: PointOfInterest }>(`${API_PREFIX}/spaces/${spaceId}/pois`, {
        method: 'POST',
        body: json(input),
      }),
    ),
  updatePoi: (id: string, input: UpdatePoiInput) =>
    unwrap(
      request<{ data: PointOfInterest }>(`${API_PREFIX}/pois/${id}`, {
        method: 'PATCH',
        body: json(input),
      }),
    ),
  deletePoi: (id: string) => request<void>(`${API_PREFIX}/pois/${id}`, { method: 'DELETE' }),
  searchPois: (query: PoiSearchQuery) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== '') params.set(k, String(v));
    }
    return unwrap(request<{ data: PointOfInterest[] }>(`${API_PREFIX}/pois/search?${params}`));
  },

  listReconstructions: (spaceId: string) =>
    unwrap(
      request<{ data: ReconstructionJob[] }>(`${API_PREFIX}/spaces/${spaceId}/reconstructions`),
    ),
  startReconstruction: (spaceId: string) =>
    unwrap(
      request<{ data: ReconstructionJob }>(`${API_PREFIX}/spaces/${spaceId}/reconstructions`, {
        method: 'POST',
        body: json({}),
      }),
    ),
};

export const queryKeys = {
  capabilities: ['capabilities'] as const,
  health: ['health'] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  spaces: (projectId: string) => ['projects', projectId, 'spaces'] as const,
  space: (id: string) => ['spaces', id] as const,
  media: (spaceId: string) => ['spaces', spaceId, 'media'] as const,
  pois: (spaceId: string) => ['spaces', spaceId, 'pois'] as const,
  reconstructions: (spaceId: string) => ['spaces', spaceId, 'reconstructions'] as const,
  poiSearch: (q: PoiSearchQuery) => ['pois', 'search', q] as const,
};
