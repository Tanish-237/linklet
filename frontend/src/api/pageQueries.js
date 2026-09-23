import { queryOptions, infiniteQueryOptions } from "@tanstack/react-query";
import { apiClient } from "./apiClient";
import { getCollections } from "./collection.api";
import { getQuestions, getQuestionMetadata, getTagCloud, getForumStats } from "./question.api";
import { queryClient } from "../utlis/queryClient";
import { userAcademicDefaults } from "../utlis/academics";
import useAuthStore from "../store/useAuthStore";

/**
 * Query definitions for the app-shell pages, shared by the pages themselves
 * and by the nav's hover prefetch — both must build the exact same key, or
 * the prefetched data lands in a cache entry the page never reads.
 */

export const savedBookmarksQuery = (userId, username) =>
  queryOptions({
    queryKey: ["saved", "bookmarks", userId, username || "me"],
    queryFn: async () =>
      (await apiClient.get(username ? `/profile/${username}/bookmarks` : "/profile/me/bookmarks")).data.data || [],
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
  });

export const savedCollectionsQuery = (userId) =>
  queryOptions({
    queryKey: ["saved", "collections", userId],
    queryFn: async () => (await getCollections()) || [],
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
  });

export const RESOURCE_PAGE_SIZE = 12;
export const DEFAULT_RESOURCE_FILTERS = {
  debouncedTerm: "",
  selectedCategory: "all",
  selectedSort: "most_downloaded",
  showMyResourcesOnly: false,
  department: "",
  semester: "",
  subject: "",
};

// The Resource Hub opens on the student's own branch + semester.
export const defaultResourceFilters = (user) => ({ ...DEFAULT_RESOURCE_FILTERS, ...userAcademicDefaults(user) });

export const resourceLibraryQuery = (userId, filters) =>
  infiniteQueryOptions({
    queryKey: ["resources", "library", userId, filters],
    queryFn: async ({ pageParam }) =>
      (
        await apiClient.get("/resources/library", {
          params: {
            search: filters.debouncedTerm || undefined,
            category: filters.selectedCategory !== "all" ? filters.selectedCategory : undefined,
            sort: filters.selectedSort,
            page: pageParam,
            limit: RESOURCE_PAGE_SIZE,
            onlyMe: filters.showMyResourcesOnly || undefined,
            department: filters.department || undefined,
            semester: filters.semester || undefined,
            subject: filters.subject || undefined,
          },
        })
      ).data,
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination?.hasNextPage ? last.pagination.page + 1 : undefined),
    staleTime: 60 * 1000,
  });

// Subjects that have resources, most-used first, within the branch and/or
// semester when given (filter search and upload suggestions).
export const resourceSubjectsQuery = (department, semester) =>
  queryOptions({
    queryKey: ["resources", "subjects", department || "", semester || ""],
    queryFn: async () =>
      (
        await apiClient.get("/resources/subjects", {
          params: { department: department || undefined, semester: semester || undefined },
        })
      ).data.data || [],
    staleTime: 5 * 60 * 1000,
  });

export const forumMetaQuery = () =>
  queryOptions({
    queryKey: ["forum", "meta"],
    queryFn: async () => {
      const [metadata, tags, stats] = await Promise.all([getQuestionMetadata(), getTagCloud(), getForumStats()]);
      return {
        categories: metadata.categories || [],
        suggestedTags: metadata.suggestedTags || [],
        tagCloud: tags || [],
        categoryStats: stats || [],
      };
    },
    // Categories and tag counts barely move; no need to re-ask every visit.
    staleTime: 10 * 60 * 1000,
  });

export const DEFAULT_FORUM_FILTERS = {
  debouncedSearch: "",
  sort: "all",
  status: "",
  selectedCategory: "",
  selectedTag: "",
  mineOnly: false,
};

export const forumQuestionsQuery = (userId, filters) =>
  infiniteQueryOptions({
    queryKey: ["forum", "questions", userId, filters],
    queryFn: ({ pageParam }) => {
      const params = {
        search: filters.debouncedSearch,
        filter: filters.sort,
        status: filters.status,
        category: filters.selectedCategory,
        tag: filters.selectedTag,
        limit: 15,
      };
      if (pageParam) params.cursor = pageParam;
      if (filters.mineOnly && userId) params.userId = userId;
      return getQuestions(params);
    },
    initialPageParam: null,
    getNextPageParam: (last) => (last.hasMore && last.nextCursor ? last.nextCursor : undefined),
    staleTime: 60 * 1000,
  });

/**
 * Start loading a page's data before it's opened (nav hover/focus). Anything
 * already cached and fresh is skipped, so this costs nothing on repeat hovers.
 */
export const prefetchPageData = (path, userId) => {
  if (!userId) return;
  const ignore = () => {};
  switch (path) {
    case "/saved":
      queryClient.prefetchQuery(savedBookmarksQuery(userId)).catch(ignore);
      queryClient.prefetchQuery(savedCollectionsQuery(userId)).catch(ignore);
      break;
    case "/resource-hub":
      queryClient
        .prefetchInfiniteQuery(resourceLibraryQuery(userId, defaultResourceFilters(useAuthStore.getState().user)))
        .catch(ignore);
      queryClient.prefetchQuery(savedBookmarksQuery(userId)).catch(ignore);
      break;
    case "/help":
      queryClient.prefetchQuery(forumMetaQuery()).catch(ignore);
      queryClient.prefetchInfiniteQuery(forumQuestionsQuery(userId, DEFAULT_FORUM_FILTERS)).catch(ignore);
      break;
    default:
  }
};
