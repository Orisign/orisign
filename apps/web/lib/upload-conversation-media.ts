"use client";

import { buildApiUrl } from "@/lib/app-config";
import { getCookie } from "@/lib/cookies";
import { customFetch } from "@/lib/fetcher";

export interface UploadedConversationMedia {
  key: string;
  url: string;
  expiresAt: number;
}

interface UploadConversationMediaResponse {
  ok: boolean;
  media: UploadedConversationMedia | null;
}

export async function uploadConversationMedia(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<UploadedConversationMedia> {
  const endpoint = buildApiUrl("/conversations/media");
  const token = getCookie("accessToken");

  return await new Promise<UploadedConversationMedia>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    formData.append("file", file);

    xhr.open("POST", endpoint, true);
    xhr.withCredentials = true;

    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const progress = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
      onProgress?.(progress);
    };

    xhr.onerror = () => {
      reject(new Error("Media upload failed"));
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error("Media upload request failed"));
        return;
      }

      try {
        const response = JSON.parse(xhr.responseText) as UploadConversationMediaResponse;

        if (!response.ok || !response.media?.key) {
          reject(new Error("Media upload returned invalid payload"));
          return;
        }

        onProgress?.(100);
        resolve(response.media);
      } catch (error) {
        reject(
          error instanceof Error ? error : new Error("Failed to parse upload response"),
        );
      }
    };

    xhr.send(formData);
  });
}

export async function deleteConversationMedia(key: string) {
  return await customFetch<{ ok: boolean }>(buildApiUrl("/conversations/media/delete"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ key }),
  });
}
