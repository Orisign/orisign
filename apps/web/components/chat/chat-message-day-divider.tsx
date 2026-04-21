"use client";

interface ChatMessageDayDividerProps {
  label: string;
}

export function ChatMessageDayDivider({ label }: ChatMessageDayDividerProps) {
  return (
    <div className="sticky top-0 z-10 flex justify-center py-3">
      <div className="rounded-full border border-border/60 bg-background/95 px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur-sm">
        {label}
      </div>
    </div>
  );
}
