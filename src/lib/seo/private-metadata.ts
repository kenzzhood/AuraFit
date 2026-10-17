import type { Metadata } from "next";

/** Private app surfaces — do not index. */
export const privateRobotsMetadata: Metadata = {
  robots: { index: false, follow: false },
};
