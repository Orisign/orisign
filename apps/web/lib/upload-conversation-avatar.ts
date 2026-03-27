"use client";

import { buildApiUrl } from "@/lib/app-config";
import { getCookie } from "@/lib/cookies";

export interface UploadedConversationAvatar {
  key: string;
  url: string;
  expiresAt: number;
}

interface UploadConversationAvatarResponse {
  ok: boolean;
  avatar: UploadedConversationAvatar | null;
}

export async function uploadConversationAvatar(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<UploadedConversationAvatar> {
  const endpoint = buildApiUrl("/conversations/avatar");
  const token = getCookie("accessToken");

  return await new Promise<UploadedConversationAvatar>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    formData.append("file", file, file.name);

    xhr.open("POST", endpoint, true);
    xhr.withCredentials = true;

    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(
        Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))),
      );
    };

    xhr.onerror = () => {
      reject(new Error("Conversation avatar upload failed"));
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error("Conversation avatar upload request failed"));
        return;
      }

      try {
        const response = JSON.parse(xhr.responseText) as UploadConversationAvatarResponse;

        if (!response.ok || !response.avatar?.key) {
          reject(new Error("Conversation avatar upload returned invalid payload"));
          return;
        }

        onProgress?.(100);
        resolve(response.avatar);
      } catch (error) {
        reject(
          error instanceof Error ? error : new Error("Failed to parse avatar upload response"),
        );
      }
    };

    xhr.send(formData);
  });
}
