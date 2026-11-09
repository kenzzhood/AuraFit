export async function register() {
  const { imageRetirementWarning } = await import("@/modules/generation");
  const warning = imageRetirementWarning(new Date());
  if (warning) console.warn(warning);
}
