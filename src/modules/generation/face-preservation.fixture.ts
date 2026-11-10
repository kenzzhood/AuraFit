/**
 * Identity check for consenting adults on gpt-image-2.5-sunburst.
 * Microsoft's model table does not mark face preservation for 2.5 Sunburst.
 * Leave identityCheckedOnSunburst false until a person compares a real adult
 * photo with the try-on before the pilot. Do not use a child's photo.
 */
export const FACE_PRESERVATION_CHECK = {
  model: "gpt-image-2.5-sunburst",
  version: "2026-09-08",
  audience: "adult-with-consent",
  method: "Azure OpenAI images.edit, session photo plus the garment",
  identityCheckedOnSunburst: false,
  beforePilot:
    "The same adult must stay recognisable. Garment print and border must not drift. Kids stay on synthetic models and never enter this check.",
} as const;
