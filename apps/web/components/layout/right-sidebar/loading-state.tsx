"use client";

import { Skeleton } from "@repo/ui";

export function RightSidebarLoadingState() {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="border-b px-4 py-3">
        <Skeleton className="h-7 w-32" />
      </div>
      <div className="flex flex-col gap-2 px-4 py-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-52" />
      </div>
    </div>
  );
}
