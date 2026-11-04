import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, fixtures, multipart, type TestApp } from './helpers.js';

let t: TestApp;
let spaceId: string;
let projectId: string;

beforeAll(async () => {
  t = await createTestApp({ maxUploadMb: 1 });
});
afterAll(() => t.close());
beforeEach(async () => {
  await t.reset();
  projectId = (
    await t.app.inject({ method: 'POST', url: '/api/v1/projects', payload: { name: 'P' } })
  ).json().data.id;
  spaceId = (
    await t.app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/spaces`,
      payload: { name: 'Living room' },
    })
  ).json().data.id;
});

const upload = (files: Parameters<typeof multipart>[0]) =>
  t.app.inject({ method: 'POST', url: `/api/v1/spaces/${spaceId}/media`, ...multipart(files) });

const storedFiles = async () => {
  const dir = path.join(t.storageDir, 'spaces', spaceId);
  return fs.readdir(dir).catch(() => [] as string[]);
};

describe('media uploads', () => {
  it('stores photos and videos with checksums and serves them back', async () => {
    const jpeg = fixtures.jpeg();
    const res = await upload([
      { filename: 'sofa.jpg', contentType: 'image/jpeg', data: jpeg },
      { filename: 'walkthrough.mp4', contentType: 'video/mp4', data: fixtures.mp4() },
    ]);
    expect(res.statusCode).toBe(201);
    const assets = res.json().data;
    expect(assets).toHaveLength(2);
    expect(assets[0]).toMatchObject({
      kind: 'image',
      originalFilename: 'sofa.jpg',
      sizeBytes: jpeg.length,
      sha256: createHash('sha256').update(jpeg).digest('hex'),
    });
    expect(assets[1].kind).toBe('video');
    expect(await storedFiles()).toHaveLength(2);

    const content = await t.app.inject(assets[0].url);
    expect(content.statusCode).toBe(200);
    expect(content.headers['content-type']).toBe('image/jpeg');
    expect(content.rawPayload.equals(jpeg)).toBe(true);

    const list = await t.app.inject(`/api/v1/spaces/${spaceId}/media`);
    expect(list.json().data).toHaveLength(2);
    const space = (await t.app.inject(`/api/v1/spaces/${spaceId}`)).json().data;
    expect(space.mediaCount).toBe(2);
  });

  it('supports HTTP range requests for video scrubbing', async () => {
    const asset = (
      await upload([{ filename: 'v.mp4', contentType: 'video/mp4', data: fixtures.mp4() }])
    ).json().data[0];
    const res = await t.app.inject({ url: asset.url, headers: { range: 'bytes=4-11' } });
    expect(res.statusCode).toBe(206);
    expect(res.headers['content-range']).toBe(`bytes 4-11/${asset.sizeBytes}`);
    expect(res.payload).toBe('ftypisom');

    const bad = await t.app.inject({ url: asset.url, headers: { range: 'bytes=99999-' } });
    expect(bad.statusCode).toBe(416);
  });

  it('rejects unsupported types', async () => {
    const res = await upload([
      { filename: 'doc.pdf', contentType: 'application/pdf', data: Buffer.from('%PDF-1.7') },
    ]);
    expect(res.statusCode).toBe(415);
    expect(res.json().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects files whose contents do not match the declared type and cleans up', async () => {
    const res = await upload([
      { filename: 'ok.jpg', contentType: 'image/jpeg', data: fixtures.jpeg() },
      { filename: 'fake.png', contentType: 'image/png', data: Buffer.from('not really a png') },
    ]);
    expect(res.statusCode).toBe(415);
    expect(await storedFiles()).toHaveLength(0);
    expect((await t.app.inject(`/api/v1/spaces/${spaceId}/media`)).json().data).toHaveLength(0);
  });

  it('enforces the upload size limit', async () => {
    const res = await upload([
      { filename: 'big.jpg', contentType: 'image/jpeg', data: fixtures.jpeg(1024 * 1024 + 10) },
    ]);
    expect(res.statusCode).toBe(413);
    expect(await storedFiles()).toHaveLength(0);
  });

  it('rejects non-multipart requests', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: `/api/v1/spaces/${spaceId}/media`,
      payload: { hello: 'world' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('deletes blobs when an asset, space or project is deleted', async () => {
    const [a] = (
      await upload([
        { filename: 'a.png', contentType: 'image/png', data: fixtures.png() },
        { filename: 'b.png', contentType: 'image/png', data: fixtures.png() },
      ])
    ).json().data;
    await t.app.inject({ method: 'DELETE', url: `/api/v1/media/${a.id}` });
    expect(await storedFiles()).toHaveLength(1);

    await t.app.inject({ method: 'DELETE', url: `/api/v1/projects/${projectId}` });
    expect(await storedFiles()).toHaveLength(0);
  });
});
