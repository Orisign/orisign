"use client";

interface ChatMessageDayDividerProps {
  label: string;
}

export function ChatMessageDayDivider({
  label,
}: ChatMessageDayDividerProps) {
  return (
    <div className="flex justify-center py-3">
      <div className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-semibold text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
