import { useCallback, useEffect, useState } from "react";
import { asCreator, isSearchResponse, type SearchCreator, type SearchResponse } from "../lib/contract";
import type { BrandSearchState } from "../lib/useBrandSearch";

export interface SavedCreator {
  creator: SearchCreator;
  savedAt: string;
  stage: number;
  draft?: string;
}

interface Workspace {
  result: SearchResponse | null;
  searchedAt: string | null;
  saved: SavedCreator[];
  pendingStages: Record<string, number>;
}

const empty = (): Workspace => ({ result: null, searchedAt: null, saved: [], pendingStages: {} });
const unsavedWorkspaces = new Map<string, Workspace>();
const storageFailure = "Changes are available in this tab, but could not be saved in this browser. Keep this tab open to retain your work.";

function validStages(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, stage]) => Number.isInteger(stage) && stage > 0 && stage <= 3));
}

// A saved snapshot cannot continue a deeper check after the page closes.
function snapshot(creator: SearchCreator): SearchCreator {
  return creator.depthStatus === "checking" ? { ...creator, depthStatus: "partial" } : creator;
}

function restore(key: string, brand: string): { workspace: Workspace; warning: string | null } {
  const unsaved = unsavedWorkspaces.get(key);
  if (unsaved) return { workspace: unsaved, warning: storageFailure };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      let pendingStages = {};
      try { pendingStages = validStages(JSON.parse(localStorage.getItem(`unpaid.pipeline.brands.${brand}`) ?? "{}")); } catch { /* No usable older stages. */ }
      return { workspace: { ...empty(), pendingStages }, warning: null };
    }
    const value = JSON.parse(raw) as Partial<Workspace> | null;
    if (!value || !Array.isArray(value.saved)) throw new Error("Invalid workspace");
    const result = isSearchResponse(value.result) && value.result.brand.trim().toLowerCase() === brand.trim().toLowerCase()
      ? { ...value.result, rankedCreators: value.result.rankedCreators.filter(row => asCreator(row)).map(snapshot) } : null;
    return {
      workspace: {
        result,
        pendingStages: validStages(value.pendingStages),
        searchedAt: typeof value.searchedAt === "string" && Number.isFinite(Date.parse(value.searchedAt)) ? value.searchedAt : null,
        saved: value.saved.filter(row => row && asCreator(row.creator)).map(row => ({
          creator: snapshot(row.creator),
          savedAt: typeof row.savedAt === "string" ? row.savedAt : "",
          stage: Number.isInteger(row.stage) && row.stage >= 0 && row.stage <= 3 ? row.stage : 0,
          draft: typeof row.draft === "string" ? row.draft : undefined,
        })),
      },
      warning: null,
    };
  } catch {
    return { workspace: empty(), warning: "This browser's saved workspace could not be read. Run a search to start again." };
  }
}

/** Mount with a brand key so state and in-flight search work are isolated per brand. */
export function useWorkspace(brand: string) {
  const key = `unpaid.workspace.brands.${encodeURIComponent(brand.trim().toLowerCase())}`;
  const [initial] = useState(() => restore(key, brand));
  const [workspace, setWorkspace] = useState(initial.workspace);
  const [storageWarning, setStorageWarning] = useState(initial.warning);
  const [searching, setSearching] = useState(!initial.workspace.result);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (workspace === initial.workspace) return;
    try {
      localStorage.setItem(key, JSON.stringify(workspace));
      unsavedWorkspaces.delete(key);
      setStorageWarning(null);
    } catch {
      unsavedWorkspaces.set(key, workspace);
      setStorageWarning(storageFailure);
    }
  }, [workspace, key, initial]);

  const receiveSearch = useCallback((state: BrandSearchState) => {
    if (state.status === "loading") return;
    if (state.status === "error") {
      setSearchError(state.message);
      setSearching(false);
      return;
    }
    const now = new Date().toISOString();
    setWorkspace(previous => {
      const pendingStages = { ...previous.pendingStages };
      const migrated: SavedCreator[] = [];
      for (const creator of state.data.rankedCreators) {
        if (!asCreator(creator) || !pendingStages[creator.creatorKey]) continue;
        if (!previous.saved.some(row => row.creator.creatorKey === creator.creatorKey)) {
          migrated.push({ creator: snapshot(creator), savedAt: now, stage: pendingStages[creator.creatorKey] });
        }
        delete pendingStages[creator.creatorKey];
      }
      return { ...previous, result: state.data, searchedAt: now, pendingStages, saved: migrated.length ? [...previous.saved, ...migrated] : previous.saved };
    });
    if (state.deeper.finished >= state.deeper.total) setSearching(false);
  }, []);

  function search() {
    setSearchError(null);
    setRun(previous => previous + 1);
    setSearching(true);
  }

  function save(creator: SearchCreator) {
    setWorkspace(previous => previous.saved.some(row => row.creator.creatorKey === creator.creatorKey) ? previous : {
      ...previous,
      saved: [...previous.saved, { creator: snapshot(creator), savedAt: new Date().toISOString(), stage: 0 }],
    });
  }

  function update(id: string, changes: Partial<Pick<SavedCreator, "stage" | "draft">>) {
    setWorkspace(previous => ({ ...previous, saved: previous.saved.map(row => row.creator.creatorKey === id ? { ...row, ...changes } : row) }));
  }

  function remove(id: string) {
    setWorkspace(previous => ({ ...previous, saved: previous.saved.filter(row => row.creator.creatorKey !== id) }));
  }

  return { ...workspace, storageWarning, searching, searchError, run, receiveSearch, search, save, update, remove };
}
