import { getMediaLabel, resolveStorageFileUrl } from "@/lib/chat";

function triggerDownloadFromBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

export async function downloadMediaByUrl(url: string, fileName: string) {
  const response = await fetch(url, {
    method: "GET",
    credentials: "omit",
  });

  if (!response.ok) {
    throw new Error("Media download failed");
  }

  const blob = await response.blob();
  triggerDownloadFromBlob(blob, fileName);
}

export async function downloadMediaByKey(mediaKey: string) {
  const resolvedUrl = resolveStorageFileUrl(mediaKey);
  if (!resolvedUrl) {
    throw new Error("Media URL not resolved");
  }

  await downloadMediaByUrl(resolvedUrl, getMediaLabel(mediaKey) || "media");
}
