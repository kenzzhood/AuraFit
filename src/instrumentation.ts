export async function register() {
  const { imageRetirementWarning } = await import("@/modules/generation");
  const warning = imageRetirementWarning(new Date());
  if (warning) console.warn(warning);
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { openDatabase, readStyles } = await import("@/db/client");
  const { availabilityText } = await import("@/modules/shared/types");
  const { getWorld } = await import("@/modules/runtime/world");
  const rows = await readStyles(await openDatabase());
  const world = getWorld();
  for (const row of rows) {
    const look = world.looks.find((item) => item.id === row.id);
    if (!look) continue;
    if (row.availability !== "available" && row.availability !== "likely" && row.availability !== "ask_staff") {
      continue;
    }
    look.availability = row.availability;
    look.availabilityText = availabilityText(row.availability);
  }
}
