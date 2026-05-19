import type { PlannedFile } from "../planned_file.ts";

export type PublicationProfile = "none" | "githubPages";
export type PublicationProfileRequest = PublicationProfile | "auto";

export function resolvePublicationProfile(
  meshBase: string,
  requestProfile: PublicationProfileRequest | undefined,
): PublicationProfile | undefined {
  if (requestProfile === undefined) {
    return undefined;
  }
  if (requestProfile === "auto") {
    return isGitHubPagesMeshBase(meshBase) ? "githubPages" : "none";
  }
  return requestProfile;
}

export function planPublicationPresetFiles(
  publicationProfile: PublicationProfile | undefined,
): readonly PlannedFile[] {
  switch (publicationProfile) {
    case undefined:
    case "none":
      return [];
    case "githubPages":
      return [{ path: ".nojekyll", contents: "" }];
  }
}

export function renderPublicationProfileTurtleTerm(
  publicationProfile: PublicationProfile,
): string {
  switch (publicationProfile) {
    case "none":
      return "sfcfg:publicationProfile_none";
    case "githubPages":
      return "sfcfg:publicationProfile_githubPages";
  }
}

function isGitHubPagesMeshBase(meshBase: string): boolean {
  const url = new URL(meshBase);
  return url.hostname === "github.io" || url.hostname.endsWith(".github.io");
}
