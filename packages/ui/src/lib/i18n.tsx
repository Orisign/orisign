"use client";

import * as React from "react";

type UIMessageValue = string | Record<string, UIMessageValue>;

type UII18nContextValue = {
  messages: Record<string, UIMessageValue>;
};

const UII18nContext = React.createContext<UII18nContextValue>({
  messages: {},
});

function resolveMessage(
  messages: Record<string, UIMessageValue>,
  path: string,
): string | null {
  const segments = path.split(".");
  let current: UIMessageValue | undefined = messages;

  for (const segment of segments) {
    if (!current || typeof current === "string") {
      return null;
    }

    current = current[segment];
  }

  return typeof current === "string" ? current : null;
}

function formatMessage(
  message: string,
  values?: Record<string, string | number>,
): string {
  if (!values) {
    return message;
  }

  return message.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key];
    return value == null ? `{${key}}` : String(value);
  });
}

export function UII18nProvider({
  messages,
  children,
}: {
  messages?: Record<string, UIMessageValue>;
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => ({
      messages: messages ?? {},
    }),
    [messages],
  );

  return <UII18nContext.Provider value={value}>{children}</UII18nContext.Provider>;
}

export function useUITranslations(namespace?: string) {
  const { messages } = React.useContext(UII18nContext);

  return React.useCallback(
    (key: string, values?: Record<string, string | number>) => {
      const path = namespace ? `${namespace}.${key}` : key;
      const message = resolveMessage(messages, path);

      if (!message) {
        return path;
      }

      return formatMessage(message, values);
    },
    [messages, namespace],
  );
}
