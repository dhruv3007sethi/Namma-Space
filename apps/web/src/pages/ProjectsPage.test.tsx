import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient, routes } from '../App';

const now = new Date().toISOString();
const project = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Koramangala office',
  description: 'Two floors',
  spaceCount: 3,
  createdAt: now,
  updatedAt: now,
};
const capabilities = {
  version: '0.1.0',
  maxUploadBytes: 500 * 1024 * 1024,
  acceptedMimeTypes: ['image/jpeg'],
  reconstructionProviders: [
    { id: 'gs', label: 'Gaussian splatting reconstruction API', configured: false },
  ],
  visionProviders: [{ id: 'vision', label: 'AI vision object detection', configured: false }],
};

function mockApi(projects: unknown[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    if (url === '/health')
      return json(200, {
        status: 'ok',
        version: '0.1.0',
        uptimeSeconds: 1,
        checks: { database: 'ok', storage: 'ok' },
      });
    if (url === '/api/v1/capabilities') return json(200, { data: capabilities });
    if (url === '/api/v1/projects' && init?.method === 'POST') {
      return json(201, {
        data: {
          ...project,
          id: '22222222-2222-4222-8222-222222222222',
          name: 'New HQ',
          spaceCount: 0,
        },
      });
    }
    if (url === '/api/v1/projects') return json(200, { data: projects });
    if (url.startsWith('/api/v1/projects/22222222')) {
      return json(200, {
        data: url.endsWith('/spaces') ? [] : { ...project, name: 'New HQ', spaceCount: 0 },
      });
    }
    return json(404, { error: { code: 'NOT_FOUND', message: 'nope' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('ProjectsPage', () => {
  it('lists projects and shows integrations as not configured', async () => {
    mockApi([project]);
    renderAt('/');
    expect(await screen.findByText('Koramangala office')).toBeInTheDocument();
    expect(screen.getByText(/3 spaces/)).toBeInTheDocument();
    expect(await screen.findAllByText('Not configured')).toHaveLength(2);
    expect(await screen.findByText('API online')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    mockApi([]);
    renderAt('/');
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
  });

  it('creates a project and navigates to it', async () => {
    const fetchMock = mockApi([]);
    renderAt('/');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Name'), 'New HQ');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByRole('heading', { name: 'New HQ', level: 1 })).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post?.[1]?.body).toBe(JSON.stringify({ name: 'New HQ' }));
  });
});
