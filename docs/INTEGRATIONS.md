# External AI integrations

Namma Space relies on external services for 3D reconstruction and object detection. Phase 1
defines the contracts, but **no adapters are bundled**. Until one is registered:

- `GET /api/v1/capabilities` lists every known integration with `configured: false`.
- `POST /api/v1/spaces/:id/reconstructions` returns `503 PROVIDER_NOT_CONFIGURED`, and no job
  row is created.
- The web app disables "Generate 3D model" and explains why.

## Adding a reconstruction provider

1. Implement `ReconstructionProvider` from `apps/api/src/providers/types.ts`:

   ```ts
   export class ExampleReconstructionProvider implements ReconstructionProvider {
     readonly id = 'gaussian-splatting-api';
     readonly label = 'Gaussian splatting reconstruction API';

     constructor(private readonly apiKey: string) {}

     async submit({ jobId, media }: ReconstructionSubmission) {
       // Upload each capture: `await m.open()` returns a Node Readable stream.
       // Then create the remote job and return the provider's job id.
       return { externalJobId: '...' };
     }

     async getStatus(externalJobId: string) {
       // Map the remote state onto queued | processing | succeeded | failed | cancelled.
       return { status: 'processing' as const };
     }
   }
   ```

2. Add the provider's credentials to the zod schema in `apps/api/src/config.ts` and to
   `.env.example`.
3. In `apps/api/src/server.ts`, register the provider in the registry, but only when its
   credentials are present:

   ```ts
   providers: {
     reconstruction: config.exampleApiKey ? [new ExampleReconstructionProvider(config.exampleApiKey)] : [],
     vision: [],
   },
   ```

4. Add integration tests. `apps/api/test/reconstructions.test.ts` shows how to drive the job
   flow with a test double, and the adapter itself should be tested against recorded HTTP
   fixtures.

`GET /api/v1/reconstructions/:id` refreshes in-flight jobs from `getStatus`. Phase 2 will add
importing the output model into storage, plus a background poller or webhook receiver.

## Adding a vision provider

Implement `VisionProvider.detectObjects(image, mimeType)`, which returns labelled, normalised
bounding boxes with a confidence for each. Turning detections into 3D POIs
(`source: 'ai_detected'`) requires camera poses from reconstruction, so that work is scheduled
after the reconstruction pipeline (see the roadmap).
