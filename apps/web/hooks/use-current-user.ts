"use client";

import {
  type GetUserResponseDto,
  usersControllerMe,
  useUsersControllerMe,
} from "@/api/generated";
import type { UseQueryOptions } from "@tanstack/react-query";

type UseCurrentUserOptions = {
  query?: UseQueryOptions<GetUserResponseDto, unknown, GetUserResponseDto>;
  request?: RequestInit;
};

export function useCurrentUser(options?: UseCurrentUserOptions) {
  const query = useUsersControllerMe<GetUserResponseDto>(options);
  const data = query.data as GetUserResponseDto | undefined;

  return {
    ...query,
    data,
    user: data?.user ?? null,
  };
}

export async function fetchCurrentUser(options?: RequestInit) {
  const response = await usersControllerMe(options);
  return response.user ?? null;
}
