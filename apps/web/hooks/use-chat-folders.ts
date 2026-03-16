"use client";

import { buildApiUrl } from "@/lib/app-config";
import type {
  ChatFolder,
  CreateChatFolderPayload,
  UpdateChatFolderPayload,
} from "@/lib/chat-folders";
import { normalizeChatFolder } from "@/lib/chat-folders";
import { customFetch } from "@/lib/fetcher";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface ListChatFoldersResponseDto {
  folders: ChatFolder[];
}

interface ChatFolderSingleResponseDto {
  folder: ChatFolder;
}

interface ReorderChatFoldersRequestDto {
  folderIds: string[];
}

export const CHAT_FOLDERS_QUERY_KEY = ["users", "chat-folders"] as const;

async function fetchChatFolders() {
  const response = await customFetch<ListChatFoldersResponseDto>(
    buildApiUrl("/users/chat-folders"),
  );

  return {
    folders: (response.folders ?? []).map((folder) => normalizeChatFolder(folder)),
  };
}

async function createChatFolder(payload: CreateChatFolderPayload) {
  const response = await customFetch<ChatFolderSingleResponseDto>(
    buildApiUrl("/users/chat-folders"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  return {
    folder: normalizeChatFolder(response.folder),
  };
}

async function updateChatFolder(folderId: string, payload: UpdateChatFolderPayload) {
  const encodedFolderId = encodeURIComponent(folderId);
  const response = await customFetch<ChatFolderSingleResponseDto>(
    buildApiUrl(`/users/chat-folders/${encodedFolderId}`),
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  return {
    folder: normalizeChatFolder(response.folder),
  };
}

async function deleteChatFolder(folderId: string) {
  const encodedFolderId = encodeURIComponent(folderId);
  const response = await customFetch<{ ok: boolean }>(
    buildApiUrl(`/users/chat-folders/${encodedFolderId}`),
    {
      method: "DELETE",
    },
  );

  if (!response?.ok) {
    throw new Error("Failed to delete chat folder");
  }

  return response;
}

async function reorderChatFolders(payload: ReorderChatFoldersRequestDto) {
  return await customFetch<{ ok: boolean }>(buildApiUrl("/users/chat-folders/reorder"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function useChatFolders() {
  return useQuery<ListChatFoldersResponseDto>({
    queryKey: CHAT_FOLDERS_QUERY_KEY,
    queryFn: fetchChatFolders,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateChatFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createChatFolder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CHAT_FOLDERS_QUERY_KEY });
    },
  });
}

export function useUpdateChatFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ folderId, payload }: { folderId: string; payload: UpdateChatFolderPayload }) =>
      updateChatFolder(folderId, payload),
    onMutate: async ({ folderId, payload }) => {
      await queryClient.cancelQueries({ queryKey: CHAT_FOLDERS_QUERY_KEY });
      const previous = queryClient.getQueryData<ListChatFoldersResponseDto>(
        CHAT_FOLDERS_QUERY_KEY,
      );

      queryClient.setQueryData<ListChatFoldersResponseDto>(
        CHAT_FOLDERS_QUERY_KEY,
        (current) => {
          if (!current) return current;
          return {
            folders: (current.folders ?? []).map((folder) =>
              folder.id === folderId
                ? {
                    ...folder,
                    ...payload,
                    includedChatIds:
                      payload.includedChatIds ?? folder.includedChatIds ?? [],
                    excludedChatIds:
                      payload.excludedChatIds ?? folder.excludedChatIds ?? [],
                    includedTypes: payload.includedTypes ?? folder.includedTypes ?? [],
                    excludedTypes: payload.excludedTypes ?? folder.excludedTypes ?? [],
                    updatedAt: Date.now(),
                  }
                : folder,
            ),
          };
        },
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CHAT_FOLDERS_QUERY_KEY, context.previous);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CHAT_FOLDERS_QUERY_KEY });
    },
  });
}

export function useDeleteChatFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteChatFolder,
    onMutate: async (folderId) => {
      await queryClient.cancelQueries({ queryKey: CHAT_FOLDERS_QUERY_KEY });
      const previous = queryClient.getQueryData<ListChatFoldersResponseDto>(
        CHAT_FOLDERS_QUERY_KEY,
      );

      queryClient.setQueryData<ListChatFoldersResponseDto>(
        CHAT_FOLDERS_QUERY_KEY,
        (current) => {
          if (!current) return current;
          return {
            folders: (current.folders ?? []).filter((folder) => folder.id !== folderId),
          };
        },
      );

      return { previous };
    },
    onError: (_error, _folderId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CHAT_FOLDERS_QUERY_KEY, context.previous);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CHAT_FOLDERS_QUERY_KEY });
    },
  });
}

export function useReorderChatFolders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderChatFolders,
    onMutate: async ({ folderIds }) => {
      await queryClient.cancelQueries({ queryKey: CHAT_FOLDERS_QUERY_KEY });
      const previous = queryClient.getQueryData<ListChatFoldersResponseDto>(
        CHAT_FOLDERS_QUERY_KEY,
      );

      queryClient.setQueryData<ListChatFoldersResponseDto>(
        CHAT_FOLDERS_QUERY_KEY,
        (current) => {
          if (!current) return current;

          const currentFolders = current.folders ?? [];
          const folderById = new Map(currentFolders.map((folder) => [folder.id, folder]));
          const nextFolders = folderIds
            .map((id, index) => {
              const folder = folderById.get(id);
              if (!folder) return null;
              return {
                ...folder,
                sortOrder: index,
                updatedAt: Date.now(),
              };
            })
            .filter((folder): folder is ChatFolder => Boolean(folder));

          const listedIds = new Set(nextFolders.map((folder) => folder.id));
          const rest = currentFolders.filter((folder) => !listedIds.has(folder.id));

          return {
            folders: [...nextFolders, ...rest],
          };
        },
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CHAT_FOLDERS_QUERY_KEY, context.previous);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CHAT_FOLDERS_QUERY_KEY });
    },
  });
}
