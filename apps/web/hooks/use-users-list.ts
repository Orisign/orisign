"use client";

import type { UserResponseDto } from "@/api/generated";
import { buildApiUrl } from "@/lib/app-config";
import { customFetch } from "@/lib/fetcher";
import { useQuery } from "@tanstack/react-query";

interface ListUsersResponseDto {
  users: UserResponseDto[];
}

interface UseUsersListOptions {
  query: string;
  excludeIds?: string[];
  limit?: number;
  enabled?: boolean;
}

function getUsersListQueryKey({
  query,
  excludeIds = [],
  limit = 40,
}: UseUsersListOptions) {
  return ["users", "list", query, excludeIds.slice().sort(), limit] as const;
}

export function useUsersList(options: UseUsersListOptions) {
  const query = options.query.trim();
  const excludeIds = [...new Set(options.excludeIds ?? [])].filter(Boolean);
  const limit = options.limit ?? 40;
  const enabled = options.enabled ?? true;

  return useQuery<ListUsersResponseDto>({
    queryKey: getUsersListQueryKey({
      query,
      excludeIds,
      limit,
    }),
    queryFn: async () =>
      customFetch<ListUsersResponseDto>(buildApiUrl("/users/list"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          limit,
          offset: 0,
          excludeIds,
        }),
      }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
