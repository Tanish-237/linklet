import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * `useState` whose value lives in the React Query cache.
 *
 * Pages that used to `useEffect(fetch) -> setState` threw their data away on
 * unmount, so every visit started from a blank spinner and re-fetched. With
 * this, revisiting a page renders the cached value instantly (and quietly
 * refreshes it in the background once stale), while the page keeps its
 * familiar `setX(prev => ...)` updates — those write straight into the cache,
 * so optimistic edits survive navigating away and back too.
 *
 * Returns [data, setData, query]. `data` is `initialValue` until the first
 * fetch resolves; `query.isPending` is true only when there is nothing cached.
 */
export default function useCachedState({ queryKey, queryFn, initialValue, ...options }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey, queryFn, ...options });
  const hash = JSON.stringify(queryKey);

  const setData = useCallback(
    (updater) =>
      queryClient.setQueryData(queryKey, (old) =>
        typeof updater === "function" ? updater(old ?? initialValue) : updater
      ),
    // queryKey/initialValue are fresh literals each render; the hash is the identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, hash]
  );

  return [query.data ?? initialValue, setData, query];
}
