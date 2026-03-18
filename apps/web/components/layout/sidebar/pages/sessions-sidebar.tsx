"use client";

import {
  type SessionResponseDto,
  useAuthControllerList,
  useAuthControllerRevokeSession,
} from "@/api/generated";
import { SECTION_BUTTON_CLASSNAME } from "@/components/shared/shared.constants";
import {
  SidebarPage,
  SidebarPageContent,
  SidebarPageHeader,
  SidebarPageSeparator,
  SidebarPageTitle,
} from "@/components/ui/sidebar-page";
import { useAuth } from "@/hooks/use-auth";
import { useSidebar } from "@/hooks/use-sidebar";
import { Button, Skeleton, SkeletonGroup, cn, toast } from "@repo/ui";
import {
  ArrowLeft,
  Globe,
  Laptop,
  RefreshCw,
  Smartphone,
  Tablet,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

function normalizeSessionTimestamp(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value > 1_000_000_000_000 ? value : value * 1000;
}

function getSessionDeviceType(userAgent: string) {
  const normalized = userAgent.toLowerCase();

  if (/ipad|tablet/.test(normalized)) {
    return "tablet" as const;
  }

  if (/android|iphone|mobile|ios/.test(normalized)) {
    return "mobile" as const;
  }

  if (/windows|macintosh|linux|x11/.test(normalized)) {
    return "desktop" as const;
  }

  return "browser" as const;
}

function sortSessions(sessions: SessionResponseDto[]) {
  return [...sessions].sort((left, right) => {
    if (left.current !== right.current) {
      return left.current ? -1 : 1;
    }

    const leftSeen = normalizeSessionTimestamp(left.lastSeenAt) ?? 0;
    const rightSeen = normalizeSessionTimestamp(right.lastSeenAt) ?? 0;
    return rightSeen - leftSeen;
  });
}

export const SessionsSidebar = () => {
  const t = useTranslations("sessionsSidebar");
  const locale = useLocale();
  const { pop } = useSidebar();
  const { deviceId } = useAuth();
  const { mutateAsync: listSessions } = useAuthControllerList();
  const { mutateAsync: revokeSession } = useAuthControllerRevokeSession();

  const [sessions, setSessions] = useState<SessionResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadedOnce, setIsLoadedOnce] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(
    null,
  );
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const formatSessionTimestamp = useCallback(
    (value: number | undefined) => {
      const timestamp = normalizeSessionTimestamp(value);
      if (!timestamp) {
        return "—";
      }

      return dateTimeFormatter.format(new Date(timestamp));
    },
    [dateTimeFormatter],
  );

  const loadSessions = useCallback(async () => {
    if (!deviceId) return;

    setIsLoading(true);

    try {
      const response = await listSessions({
        data: {
          deviceId,
        },
      });

      setSessions(sortSessions(response.sessions ?? []));
    } catch {
      toast({
        title: t("states.loadError"),
        type: "error",
      });
    } finally {
      setIsLoading(false);
      setIsLoadedOnce(true);
    }
  }, [deviceId, listSessions, t]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const currentSession = useMemo(
    () => sessions.find((session) => session.current) ?? null,
    [sessions],
  );
  const otherSessions = useMemo(
    () => sessions.filter((session) => !session.current),
    [sessions],
  );

  const resolveSessionDeviceIcon = useCallback((session: SessionResponseDto) => {
    const sessionType = getSessionDeviceType(session.userAgent ?? "");

    if (sessionType === "mobile") {
      return <Smartphone className="size-4 text-muted-foreground" />;
    }
    if (sessionType === "tablet") {
      return <Tablet className="size-4 text-muted-foreground" />;
    }
    if (sessionType === "desktop") {
      return <Laptop className="size-4 text-muted-foreground" />;
    }

    return <Globe className="size-4 text-muted-foreground" />;
  }, []);

  const resolveSessionDeviceLabel = useCallback(
    (session: SessionResponseDto) => {
      const sessionType = getSessionDeviceType(session.userAgent ?? "");
      return t(`labels.${sessionType}`);
    },
    [t],
  );

  const handleRevokeSession = useCallback(
    async (sessionId: string) => {
      if (!sessionId) return;

      setRevokingSessionId(sessionId);

      try {
        await revokeSession({
          data: {
            id: sessionId,
          },
        });

        setSessions((prev) =>
          sortSessions(prev.filter((session) => session.id !== sessionId)),
        );
        toast({
          title: t("states.revokeSuccess"),
          type: "success",
        });
      } catch {
        toast({
          title: t("states.revokeError"),
          type: "error",
        });
      } finally {
        setRevokingSessionId(null);
      }
    },
    [revokeSession, t],
  );

  const handleRevokeOtherSessions = useCallback(async () => {
    if (otherSessions.length === 0) return;

    setIsRevokingAll(true);
    let hasErrors = false;

    try {
      for (const session of otherSessions) {
        try {
          await revokeSession({
            data: {
              id: session.id,
            },
          });
        } catch {
          hasErrors = true;
        }
      }

      await loadSessions();

      toast({
        title: hasErrors ? t("states.revokeAllError") : t("states.revokeAllSuccess"),
        type: hasErrors ? "error" : "success",
      });
    } finally {
      setIsRevokingAll(false);
    }
  }, [loadSessions, otherSessions, revokeSession, t]);

  const isBusy =
    isLoading || isRevokingAll || revokingSessionId !== null || !deviceId;

  return (
    <SidebarPage>
      <SidebarPageHeader className="justify-start gap-3">
        <Button
          onClick={pop}
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={t("actions.backAriaLabel")}
        >
          <ArrowLeft strokeWidth={3} className="size-6" />
        </Button>
        <SidebarPageTitle>{t("title")}</SidebarPageTitle>
      </SidebarPageHeader>

      <SidebarPageContent className="gap-2">
        <p className="px-1 text-sm text-muted-foreground">{t("subtitle")}</p>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => void loadSessions()}
            disabled={isBusy}
          >
            <RefreshCw className={cn("size-4", isLoading ? "animate-spin" : "")} />
            {t("actions.refresh")}
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="rounded-full"
            onClick={() => void handleRevokeOtherSessions()}
            disabled={isBusy || otherSessions.length === 0}
          >
            <X className="size-4" />
            {t("actions.terminateAllOthers")}
          </Button>
        </div>
      </SidebarPageContent>

      <SidebarPageSeparator />

      <SidebarPageContent className="gap-3 pb-6">
        {isLoading && !isLoadedOnce ? (
          <SkeletonGroup durationMs={2000} className="flex w-full flex-col gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  SECTION_BUTTON_CLASSNAME,
                  "cursor-default rounded-md py-3 space-y-2",
                )}
              >
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-3.5 w-3/5" />
              </div>
            ))}
          </SkeletonGroup>
        ) : null}

        {currentSession ? (
          <div className="space-y-2">
            <p className="px-1 text-lg font-semibold text-primary">
              {t("currentSession")}
            </p>

            <div
              className={cn(
                SECTION_BUTTON_CLASSNAME,
                "cursor-default rounded-md py-3",
              )}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-accent p-2">
                    {resolveSessionDeviceIcon(currentSession)}
                  </div>

                  <div className="min-w-0">
                    <p className="break-words [overflow-wrap:anywhere] font-semibold leading-snug">
                      {resolveSessionDeviceLabel(currentSession)}
                    </p>
                    <p className="break-words [overflow-wrap:anywhere] text-sm text-muted-foreground leading-snug">
                      {currentSession.userAgent || t("unknownClient")}
                    </p>
                    <p className="break-words [overflow-wrap:anywhere] text-xs text-muted-foreground leading-snug">
                      {t("meta.ip", { value: currentSession.ip || "—" })}
                    </p>
                    <p className="break-words [overflow-wrap:anywhere] text-xs text-muted-foreground leading-snug">
                      {t("meta.lastSeen", {
                        value: formatSessionTimestamp(currentSession.lastSeenAt),
                      })}
                    </p>
                    <p className="break-words [overflow-wrap:anywhere] text-xs text-muted-foreground leading-snug">
                      {t("meta.createdAt", {
                        value: formatSessionTimestamp(currentSession.createdAt),
                      })}
                    </p>
                  </div>
                </div>

                <span className="shrink-0 rounded-full bg-primary/15 px-2 py-1 text-xs font-semibold text-primary">
                  {t("actions.current")}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="px-1 text-lg font-semibold text-primary">
            {t("otherSessions")}
          </p>

          {otherSessions.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">{t("empty")}</p>
          ) : null}

          {otherSessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                SECTION_BUTTON_CLASSNAME,
                "cursor-default rounded-md py-3",
              )}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-accent p-2">
                    {resolveSessionDeviceIcon(session)}
                  </div>

                  <div className="min-w-0">
                    <p className="break-words [overflow-wrap:anywhere] font-semibold leading-snug">
                      {resolveSessionDeviceLabel(session)}
                    </p>
                    <p className="break-words [overflow-wrap:anywhere] text-sm text-muted-foreground leading-snug">
                      {session.userAgent || t("unknownClient")}
                    </p>
                    <p className="break-words [overflow-wrap:anywhere] text-xs text-muted-foreground leading-snug">
                      {t("meta.ip", { value: session.ip || "—" })}
                    </p>
                    <p className="break-words [overflow-wrap:anywhere] text-xs text-muted-foreground leading-snug">
                      {t("meta.lastSeen", {
                        value: formatSessionTimestamp(session.lastSeenAt),
                      })}
                    </p>
                    <p className="break-words [overflow-wrap:anywhere] text-xs text-muted-foreground leading-snug">
                      {t("meta.createdAt", {
                        value: formatSessionTimestamp(session.createdAt),
                      })}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 rounded-full"
                  disabled={isBusy}
                  onClick={() => void handleRevokeSession(session.id)}
                >
                  {revokingSessionId === session.id
                    ? t("actions.terminating")
                    : t("actions.terminate")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SidebarPageContent>
    </SidebarPage>
  );
};
