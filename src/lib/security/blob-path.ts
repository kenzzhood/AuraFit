/**
 * Wardrobe blob paths must belong to the authenticated Clerk user.
 * Upload layout: aurafit/<clerkUserId>/<kind>/...
 * Stored form may be "<container>:aurafit/<clerkUserId>/..." or plain path.
 */

export function assertUserBlobPath(blobPath: string, clerkUserId: string): void {
  const normalized = blobPath.trim();
  if (!normalized) {
    throw new Error("blobPath is required");
  }

  const withoutContainer = normalized.includes(":")
    ? normalized.slice(normalized.indexOf(":") + 1)
    : normalized;

  const expectedPrefix = `aurafit/${clerkUserId}/`;
  if (!withoutContainer.startsWith(expectedPrefix)) {
    throw new Error("blobPath does not belong to this user");
  }

  if (withoutContainer.includes("..")) {
    throw new Error("Invalid blobPath");
  }
}
