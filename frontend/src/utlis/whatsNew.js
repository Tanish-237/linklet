export const RELEASE_VERSION = "v2.1.0";
export const STORAGE_KEY = "linklet_last_seen_version";

export const isReleaseSeen = (version = RELEASE_VERSION) => {
  try {
    const lastSeen = localStorage.getItem(STORAGE_KEY);
    if (lastSeen === version) return true;
    const legacy = localStorage.getItem(`linklet_whats_new_seen_${version}`);
    if (legacy === "true") return true;
  } catch {
    // localStorage may be restricted or unavailable
  }
  return false;
};

export const markReleaseSeen = (version = RELEASE_VERSION) => {
  try {
    localStorage.setItem(STORAGE_KEY, version);
    localStorage.setItem(`linklet_whats_new_seen_${version}`, "true");
  } catch {
    // ignore
  }
};
