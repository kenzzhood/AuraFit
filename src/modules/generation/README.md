# generation

Typed contract: `index.ts`.

The image model is one value, `AURAFIT_IMAGE_MODEL`. The default is `gpt-image-2.5-sunburst`, version `2026-09-08`. It retires on `2027-09-08`. That string is the Microsoft Foundry deployment name. Calls use `AZURE_OPENAI_ENDPOINT` or `AZURE_OPENAI_IMAGE_ENDPOINT` and the matching key. Direct OpenAI is not used.

`gpt-image-2.6-sunburst` is the planned swap once Azure lists it.

Consenting adults with a photo take the personal Azure edit path (`faceEdit: true`). Children with a photo are blocked. Children without a photo use FLUX.2 klein. Night jobs render the six core adult models first and pause while the store is open.

`face-preservation.fixture.ts` records that identity consistency on 2.5 Sunburst is still unchecked. Do that before the pilot.

Configuration is `readGenerationConfig`. Tests are `generation.test.ts`.
