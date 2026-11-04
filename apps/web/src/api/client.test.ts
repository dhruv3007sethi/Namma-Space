import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './client';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('unwraps data envelopes and sends JSON bodies', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(201, { data: { id: 'p1', name: 'HQ' } }));
    vi.stubGlobal('fetch', fetchMock);

    const project = await api.createProject({ name: 'HQ' });
    expect(project).toEqual({ id: 'p1', name: 'HQ' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/projects');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'HQ' }));
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
  });

  it('throws ApiError with server error details', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(503, { error: { code: 'PROVIDER_NOT_CONFIGURED', message: 'No provider' } }),
        ),
    );
    const err = await api.startReconstruction('s1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 503,
      code: 'PROVIDER_NOT_CONFIGURED',
      message: 'No provider',
    });
  });

  it('maps network failures to NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(api.listProjects()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('builds POI search query strings without empty values', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await api.searchPois({ q: 'door', category: undefined, limit: 10 });
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/pois/search?q=door&limit=10');
  });
});
