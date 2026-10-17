/**
 * Hard cap on how many product reference images we feed into the image-edit
 * call. Lives here (not in jobs/generation) so azure/images can import it
 * without a jobs/generation ↔ azure/images cycle.
 *
 * Total inputs per call = 1 user photo + 12 product refs = 13, safely under
 * the gpt-image-1 limit of 16 input images. More refs = slower upload and a
 * slower model response, so keep the payload tight.
 */
export const MAX_PRODUCT_IMAGE_REFS = 12;
