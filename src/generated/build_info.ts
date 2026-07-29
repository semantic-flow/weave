// Checked in with null values: source runs cannot know which commit built
// them. Release binary builds stamp real values via
// `scripts/build-binaries.ts --commit <sha> --built <iso8601>` and restore
// this file's original bytes afterward, so the stamp is never committed.
export interface WeaveBuildInfo {
  commit: string | null;
  built: string | null;
}

export const WEAVE_BUILD_INFO: WeaveBuildInfo = {
  commit: null,
  built: null,
};
