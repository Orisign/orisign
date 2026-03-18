"use client";

import { escapeHtml, parseTwemojiText, TWEMOJI_CLASSNAME } from "@/lib/twemoji";
import {
  applyQuoteFormatting,
  clearFormattingFromSelection,
  insertMarkdownLink,
  insertTextAtSelection,
  type TextSelectionRange,
  wrapSelectionWithMarkers,
} from "@/lib/chat-message-format";
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmojiPicker,
  Input,
} from "@repo/ui";
import { ContextMenu as ContextMenuPrimitive } from "radix-ui";
import * as React from "react";

interface EmojiInputProps
  extends Omit<
    React.ComponentProps<"div">,
    "onChange" | "onInput" | "value" | "defaultValue"
  > {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLDivElement>;
  placeholder?: string;
  name?: string;
  autoComplete?: string;
  autoCorrect?: string;
  autoCapitalize?: string;
  spellCheck?: boolean;
  disabled?: boolean;
  showEmojiPicker?: boolean;
  autoGrow?: boolean;
  maxHeight?: number;
  onSubmit?: () => void;
  submitOnEnter?: boolean;
  focusToken?: string | number | null;
  rightSlot?: React.ReactNode;
}

const MIN_INPUT_HEIGHT = 44;
type SelectionOffsets = {
  start: number;
  end: number;
};

function getNodeTextLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.nodeValue ?? "").length;
  }

  if (node instanceof HTMLImageElement && node.classList.contains(TWEMOJI_CLASSNAME)) {
    return (node.getAttribute("alt") ?? "").length;
  }

  if (node instanceof HTMLBRElement) {
    return 1;
  }

  let length = 0;
  for (const child of Array.from(node.childNodes)) {
    length += getNodeTextLength(child);
  }

  return length;
}

function readPlainText(root: Node): string {
  if (root.nodeType === Node.TEXT_NODE) {
    return root.nodeValue ?? "";
  }

  if (root instanceof HTMLImageElement && root.classList.contains(TWEMOJI_CLASSNAME)) {
    return root.getAttribute("alt") ?? "";
  }

  if (root instanceof HTMLBRElement) {
    return "\n";
  }

  let text = "";
  for (const child of Array.from(root.childNodes)) {
    text += readPlainText(child);
  }

  return text;
}

function getRangeOffset(root: HTMLElement, container: Node, offset: number) {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(container, offset);

  const fragment = range.cloneContents();
  return getNodeTextLength(fragment);
}

function getSelectionOffsets(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return null;
  }

  return {
    start: getRangeOffset(root, range.startContainer, range.startOffset),
    end: getRangeOffset(root, range.endContainer, range.endOffset),
  };
}

function getCollapsedSelectionOffsets(root: HTMLElement): SelectionOffsets | null {
  const caretOffset = getCaretOffset(root);
  if (caretOffset == null) {
    return null;
  }

  return {
    start: caretOffset,
    end: caretOffset,
  };
}

function getPreviousGraphemeOffset(value: string, offset: number) {
  if (offset <= 0) {
    return 0;
  }

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let previousOffset = 0;

    for (const { index } of segmenter.segment(value)) {
      if (index >= offset) {
        break;
      }

      previousOffset = index;
    }

    return previousOffset;
  }

  return Array.from(value.slice(0, offset)).slice(0, -1).join("").length;
}

function getCaretOffset(root: HTMLElement): number | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!range.collapsed || !root.contains(range.endContainer)) {
    return null;
  }

  const prefixRange = range.cloneRange();
  prefixRange.selectNodeContents(root);
  prefixRange.setEnd(range.endContainer, range.endOffset);

  const fragment = prefixRange.cloneContents();
  return getNodeTextLength(fragment);
}

function setCaretOffset(root: HTMLElement, targetOffset: number) {
  setSelectionOffsets(root, targetOffset, targetOffset);
}

function resolveOffsetPosition(root: HTMLElement, targetOffset: number) {
  let remaining = Math.max(targetOffset, 0);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL, {
    acceptNode: (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return NodeFilter.FILTER_ACCEPT;
      }
      if (node instanceof HTMLImageElement && node.classList.contains(TWEMOJI_CLASSNAME)) {
        return NodeFilter.FILTER_ACCEPT;
      }
      if (node instanceof HTMLBRElement) {
        return NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_SKIP;
    },
  });

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const length = getNodeTextLength(node);

    if (remaining > length) {
      remaining -= length;
      continue;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return {
        node,
        offset: remaining,
      };
    }

    const parent = node.parentNode;
    if (!parent) {
      break;
    }

    const index = Array.prototype.indexOf.call(parent.childNodes, node) as number;
    return {
      node: parent,
      offset: remaining === 0 ? index : index + 1,
    };
  }

  return null;
}

function setSelectionOffsets(
  root: HTMLElement,
  selectionStart: number,
  selectionEnd: number,
) {
  const selection = window.getSelection();
  if (!selection) return;

  const maxOffset = getNodeTextLength(root);
  const safeStart = Math.max(0, Math.min(maxOffset, selectionStart));
  const safeEnd = Math.max(0, Math.min(maxOffset, selectionEnd));
  const normalizedStart = Math.min(safeStart, safeEnd);
  const normalizedEnd = Math.max(safeStart, safeEnd);
  const range = document.createRange();
  const startPosition = resolveOffsetPosition(root, normalizedStart);
  const endPosition = resolveOffsetPosition(root, normalizedEnd);

  if (!startPosition || !endPosition) {
    range.selectNodeContents(root);
    range.collapse(true);
  } else {
    range.setStart(startPosition.node, startPosition.offset);
    range.setEnd(endPosition.node, endPosition.offset);
  }

  selection.removeAllRanges();
  selection.addRange(range);
}

const ChatInputContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      className={cn(
        "z-50 min-w-56 overflow-visible rounded-lg border border-border/70 bg-popover px-1.5 py-1 text-popover-foreground shadow-xl origin-[--radix-context-menu-content-transform-origin] [will-change:transform,opacity] data-[state=open]:animate-[dropdown-in_180ms_cubic-bezier(.22,.8,.2,1)] data-[state=closed]:animate-[dropdown-out_140ms_cubic-bezier(.4,0,.2,1)]",
        className,
      )}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
));
ChatInputContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName;

const ChatInputContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center justify-between gap-4 rounded-md px-3 py-2 text-[15px] leading-none outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-45 focus:bg-accent focus:text-accent-foreground",
      className,
    )}
    {...props}
  >
    {children}
  </ContextMenuPrimitive.Item>
));
ChatInputContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName;

const ChatInputContextMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center justify-between gap-4 rounded-md px-3 py-2 text-[15px] leading-none outline-none transition-colors data-[state=open]:bg-accent data-[state=open]:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
      className,
    )}
    {...props}
  >
    {children}
    <span className="text-xs opacity-70">›</span>
  </ContextMenuPrimitive.SubTrigger>
));
ChatInputContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName;

const ChatInputContextMenuSubContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.SubContent
      ref={ref}
      sideOffset={6}
      alignOffset={-4}
      collisionPadding={10}
      className={cn(
        "z-50 min-w-56 overflow-hidden rounded-lg border border-border/70 bg-popover px-1.5 py-1 text-popover-foreground shadow-xl origin-[--radix-context-menu-content-transform-origin] [will-change:transform,opacity] data-[state=open]:animate-[dropdown-sub-in_180ms_cubic-bezier(.22,.8,.2,1)] data-[state=closed]:animate-[dropdown-sub-out_140ms_cubic-bezier(.4,0,.2,1)]",
        className,
      )}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
));
ChatInputContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName;

const ChatInputContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border/65", className)}
    {...props}
  />
));
ChatInputContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName;

function ChatInputContextMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("text-sm text-muted-foreground/90", className)}
      {...props}
    />
  );
}

function renderFormattedInputHtml(value: string) {
  let html = escapeHtml(value);
  const htmlTokens: string[] = [];
  const markerClass = "text-muted-foreground/60";

  const createToken = (segmentHtml: string) => {
    const tokenId = htmlTokens.push(segmentHtml) - 1;
    return `__EMOJI_INPUT_FMT_TOKEN_${tokenId}__`;
  };

  const applyTokenReplace = (
    regex: RegExp,
    formatter: (...groups: string[]) => string,
  ) => {
    html = html.replace(regex, (fullMatch, ...groups) => {
      const renderedSegment = formatter(
        fullMatch,
        ...(groups.slice(0, Math.max(groups.length - 2, 0)) as string[]),
      );
      return createToken(renderedSegment);
    });
  };

  applyTokenReplace(/\[([^\]\n]{1,320})\]\((https?:\/\/[^\s)]+)\)/g, (_full, label, url) =>
    `<span class="${markerClass}">[</span><span class="underline decoration-current underline-offset-2">${label}</span><span class="${markerClass}">](${url})</span>`);
  applyTokenReplace(/\*\*([\s\S]+?)\*\*/g, (_full, content) =>
    `<span class="${markerClass}">**</span><strong class="font-semibold">${content}</strong><span class="${markerClass}">**</span>`);
  applyTokenReplace(/__([\s\S]+?)__/g, (_full, content) =>
    `<span class="${markerClass}">__</span><em class="italic">${content}</em><span class="${markerClass}">__</span>`);
  applyTokenReplace(/\+\+([\s\S]+?)\+\+/g, (_full, content) =>
    `<span class="${markerClass}">++</span><span class="underline decoration-current underline-offset-2">${content}</span><span class="${markerClass}">++</span>`);
  applyTokenReplace(/~~([\s\S]+?)~~/g, (_full, content) =>
    `<span class="${markerClass}">~~</span><span class="line-through">${content}</span><span class="${markerClass}">~~</span>`);
  applyTokenReplace(/`([^`\n]+)`/g, (_full, content) =>
    `<span class="${markerClass}">\`</span><code class="rounded-sm bg-foreground/10 px-1 py-0.5 font-mono text-[0.92em]">${content}</code><span class="${markerClass}">\`</span>`);
  applyTokenReplace(/\|\|([\s\S]+?)\|\|/g, (_full, content) =>
    `<span class="${markerClass}">||</span><span class="rounded-sm bg-foreground/85 px-1 py-0.5 text-foreground">${content}</span><span class="${markerClass}">||</span>`);

  const quoteLines = html.split("\n").map((line) => {
    if (!line.trimStart().startsWith("&gt; ")) {
      return line;
    }

    const leadingWhitespace = line.match(/^\s*/)?.[0] ?? "";
    const quotedText = line.slice(leadingWhitespace.length + 5);
    return `${leadingWhitespace}<span class="${markerClass}">&gt; </span><span class="border-l-2 border-primary/70 bg-foreground/10 px-1.5 py-0.5">${quotedText}</span>`;
  });

  html = quoteLines.join("\n");

  return html.replace(/__EMOJI_INPUT_FMT_TOKEN_(\d+)__/g, (_match, id) => {
    const index = Number(id);
    if (!Number.isInteger(index) || index < 0 || index >= htmlTokens.length) {
      return "";
    }

    return htmlTokens[index] ?? "";
  });
}

export const EmojiInput = React.forwardRef<HTMLInputElement, EmojiInputProps>(
  (
    {
      value = "",
      onChange,
      onBlur,
      placeholder,
      className,
      name,
      autoComplete,
      autoCorrect,
      autoCapitalize,
      spellCheck = false,
      disabled,
      showEmojiPicker = false,
      autoGrow = false,
      maxHeight = 176,
      onSubmit,
      submitOnEnter = true,
      focusToken,
      rightSlot,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    const editableRef = React.useRef<HTMLDivElement>(null);
    const [isEmpty, setIsEmpty] = React.useState(value.length === 0);
    const [inputHeight, setInputHeight] = React.useState(MIN_INPUT_HEIGHT);
    const isComposingRef = React.useRef(false);
    const lastRenderedValueRef = React.useRef(value);
    const lastSelectionRef = React.useRef<SelectionOffsets>({
      start: value.length,
      end: value.length,
    });
    const pendingLinkSelectionRef = React.useRef<TextSelectionRange | null>(null);
    const [isLinkDialogOpen, setIsLinkDialogOpen] = React.useState(false);
    const [linkDialogValue, setLinkDialogValue] = React.useState("");

    const updateInputHeight = React.useCallback(() => {
      const editable = editableRef.current;
      if (!editable || !autoGrow) return;

      const nextHeight = Math.min(
        Math.max(Math.ceil(editable.scrollHeight), MIN_INPUT_HEIGHT),
        maxHeight,
      );

      setInputHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight,
      );
    }, [autoGrow, maxHeight]);

    const renderValue = React.useCallback(
      (
        nextValue: string,
        selection?: number | SelectionOffsets | null,
      ) => {
        const editable = editableRef.current;
        if (!editable) return;

        const html = parseTwemojiText(renderFormattedInputHtml(nextValue));
        if (editable.innerHTML !== html) {
          editable.innerHTML = html;
        }

        if (typeof selection === "number") {
          const normalizedOffset = Math.min(
            Math.max(selection, 0),
            nextValue.length,
          );
          setCaretOffset(editable, normalizedOffset);
          lastSelectionRef.current = {
            start: normalizedOffset,
            end: normalizedOffset,
          };
        } else if (selection) {
          const normalizedSelection = {
            start: Math.min(Math.max(selection.start, 0), nextValue.length),
            end: Math.min(Math.max(selection.end, 0), nextValue.length),
          };
          setSelectionOffsets(
            editable,
            normalizedSelection.start,
            normalizedSelection.end,
          );
          lastSelectionRef.current = normalizedSelection;
        }

        setIsEmpty(nextValue.length === 0);
        lastRenderedValueRef.current = nextValue;
        updateInputHeight();
      },
      [updateInputHeight],
    );

    React.useLayoutEffect(() => {
      const editable = editableRef.current;
      if (!editable) return;

      const domValue = readPlainText(editable).replaceAll("\n", "");
      if (domValue === value && lastRenderedValueRef.current === value) {
        return;
      }

      const caretOffset =
        document.activeElement === editable ? getCaretOffset(editable) : null;
      renderValue(value, caretOffset);
    }, [renderValue, value]);

    React.useLayoutEffect(() => {
      if (!autoGrow) {
        setInputHeight(MIN_INPUT_HEIGHT);
        return;
      }

      updateInputHeight();
    }, [autoGrow, updateInputHeight, value]);

    React.useEffect(() => {
      if (!autoGrow) return;

      const handleResize = () => {
        updateInputHeight();
      };

      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, [autoGrow, updateInputHeight]);

    React.useEffect(() => {
      if (focusToken == null) return;

      const editable = editableRef.current;
      if (!editable || disabled) return;

      requestAnimationFrame(() => {
        editable.focus();
        const currentValue = readPlainText(editable).replaceAll("\n", "");
        const nextOffset = currentValue.length;
        setCaretOffset(editable, nextOffset);
        lastSelectionRef.current = {
          start: nextOffset,
          end: nextOffset,
        };
      });
    }, [disabled, focusToken]);

    const saveSelection = React.useCallback(() => {
      const editable = editableRef.current;
      if (!editable) return;

      const selection =
        getSelectionOffsets(editable) ?? getCollapsedSelectionOffsets(editable);

      if (!selection) return;

      lastSelectionRef.current = {
        start: Math.min(selection.start, value.length),
        end: Math.min(selection.end, value.length),
      };
    }, [value.length]);

    const syncFromDom = React.useCallback(() => {
      const editable = editableRef.current;
      if (!editable) return;

      const caretOffset = getCaretOffset(editable);
      const nextValue = readPlainText(editable).replaceAll("\n", "");
      renderValue(nextValue, caretOffset);
      onChange?.(nextValue);
    }, [onChange, renderValue]);

    const handleInput = React.useCallback(() => {
      if (isComposingRef.current) return;
      syncFromDom();
    }, [syncFromDom]);

    const handlePaste = React.useCallback(
      (event: React.ClipboardEvent<HTMLDivElement>) => {
        event.preventDefault();
        const pasted = event.clipboardData.getData("text/plain").replace(/\r?\n/g, " ");
        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0) {
          return;
        }

        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(pasted);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);

        syncFromDom();
      },
      [syncFromDom],
    );

    const insertEmojiAtCaret = React.useCallback(
      (emoji: string) => {
        const editable = editableRef.current;
        if (!editable || disabled) return;

        editable.focus();
        const currentValue = readPlainText(editable).replaceAll("\n", "");
        const selection =
          getSelectionOffsets(editable) ??
          getCollapsedSelectionOffsets(editable) ??
          lastSelectionRef.current;
        const selectionStart = Math.min(selection.start, currentValue.length);
        const selectionEnd = Math.min(selection.end, currentValue.length);
        const nextValue =
          currentValue.slice(0, selectionStart) +
          emoji +
          currentValue.slice(selectionEnd);
        const nextCaretOffset = selectionStart + emoji.length;

        renderValue(nextValue, nextCaretOffset);
        onChange?.(nextValue);
      },
      [disabled, onChange, renderValue],
    );

    const deleteLastInputElement = React.useCallback(() => {
      const editable = editableRef.current;
      if (!editable || disabled) return;

      editable.focus();
      const currentValue = readPlainText(editable).replaceAll("\n", "");
      if (currentValue.length === 0) {
        return;
      }

      const selectionOffsets = getSelectionOffsets(editable);
      const selection = selectionOffsets ?? lastSelectionRef.current;
      const selectionStart = Math.min(selection.start, currentValue.length);
      const selectionEnd = Math.min(selection.end, currentValue.length);

      let nextValue = currentValue;
      let nextCaretOffset = selectionStart;

      if (selectionStart !== selectionEnd) {
        nextValue =
          currentValue.slice(0, selectionStart) + currentValue.slice(selectionEnd);
      } else {
        const previousOffset = getPreviousGraphemeOffset(currentValue, selectionStart);
        nextValue =
          currentValue.slice(0, previousOffset) + currentValue.slice(selectionStart);
        nextCaretOffset = previousOffset;
      }

      renderValue(nextValue, nextCaretOffset);
      onChange?.(nextValue);
    }, [disabled, onChange, renderValue]);

    const getEditableSelection = React.useCallback((): TextSelectionRange => {
      const editable = editableRef.current;
      if (!editable) {
        return lastSelectionRef.current;
      }

      const selection =
        getSelectionOffsets(editable) ??
        getCollapsedSelectionOffsets(editable) ??
        lastSelectionRef.current;

      return {
        start: Math.max(0, Math.min(selection.start, value.length)),
        end: Math.max(0, Math.min(selection.end, value.length)),
      };
    }, [value.length]);

    const applyFormattedValue = React.useCallback(
      (nextText: string, nextSelection: TextSelectionRange) => {
        const editable = editableRef.current;
        if (!editable) return;

        editable.focus();
        renderValue(nextText, nextSelection);
        onChange?.(nextText);
      },
      [onChange, renderValue],
    );

    const runDocumentCommand = React.useCallback(
      (command: string) => {
        const editable = editableRef.current;
        if (!editable || disabled) {
          return;
        }

        editable.focus();
        document.execCommand(command);
        syncFromDom();
      },
      [disabled, syncFromDom],
    );

    const applyMarkerFormatting = React.useCallback(
      (marker: string) => {
        if (disabled) return;
        const selection = getEditableSelection();
        const result = wrapSelectionWithMarkers(value, selection, marker);
        applyFormattedValue(result.nextText, result.nextSelection);
      },
      [applyFormattedValue, disabled, getEditableSelection, value],
    );

    const applyQuoteAction = React.useCallback(() => {
      if (disabled) return;
      const selection = getEditableSelection();
      const result = applyQuoteFormatting(value, selection);
      applyFormattedValue(result.nextText, result.nextSelection);
    }, [applyFormattedValue, disabled, getEditableSelection, value]);

    const applyClearFormattingAction = React.useCallback(() => {
      if (disabled) return;
      const selection = getEditableSelection();
      const result = clearFormattingFromSelection(value, selection);
      applyFormattedValue(result.nextText, result.nextSelection);
    }, [applyFormattedValue, disabled, getEditableSelection, value]);

    const applyAddLinkAction = React.useCallback(() => {
      if (disabled) return;
      const selection = getEditableSelection();
      const selectedText = value.slice(selection.start, selection.end).trim();
      const defaultUrl = selectedText.startsWith("http://") ||
        selectedText.startsWith("https://")
        ? selectedText
        : "https://";

      pendingLinkSelectionRef.current = selection;
      setLinkDialogValue(defaultUrl);
      setIsLinkDialogOpen(true);
    }, [disabled, getEditableSelection, value]);

    const closeLinkDialog = React.useCallback(() => {
      pendingLinkSelectionRef.current = null;
      setIsLinkDialogOpen(false);
      setLinkDialogValue("");
    }, []);

    const confirmAddLinkAction = React.useCallback(() => {
      if (disabled) return;

      const selection = pendingLinkSelectionRef.current ?? getEditableSelection();
      const rawUrl = linkDialogValue.trim();
      if (!rawUrl) {
        return;
      }

      const nextUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      const result = insertMarkdownLink(value, selection, nextUrl);
      if (result.nextText === value) {
        return;
      }

      applyFormattedValue(result.nextText, result.nextSelection);
      closeLinkDialog();
    }, [
      applyFormattedValue,
      closeLinkDialog,
      disabled,
      getEditableSelection,
      linkDialogValue,
      value,
    ]);

    const insertCurrentDateAction = React.useCallback(() => {
      if (disabled) return;
      const selection = getEditableSelection();
      const now = new Date();
      const formattedDate = new Intl.DateTimeFormat(undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(now);
      const result = insertTextAtSelection(value, selection, formattedDate);
      applyFormattedValue(result.nextText, result.nextSelection);
    }, [applyFormattedValue, disabled, getEditableSelection, value]);

    const deleteSelectionAction = React.useCallback(() => {
      if (disabled) return;
      const selection = getEditableSelection();
      if (selection.start === selection.end) {
        return;
      }

      const result = insertTextAtSelection(value, selection, "");
      applyFormattedValue(result.nextText, result.nextSelection);
    }, [applyFormattedValue, disabled, getEditableSelection, value]);

    const selectAllAction = React.useCallback(() => {
      const editable = editableRef.current;
      if (!editable || disabled) {
        return;
      }

      editable.focus();
      setSelectionOffsets(editable, 0, value.length);
      lastSelectionRef.current = {
        start: 0,
        end: value.length,
      };
    }, [disabled, value.length]);

    const pasteFromClipboardAction = React.useCallback(async () => {
      if (disabled) return;

      const editable = editableRef.current;
      if (!editable) return;

      try {
        if (navigator.clipboard?.readText) {
          const textFromClipboard = await navigator.clipboard.readText();
          const selection = getEditableSelection();
          const result = insertTextAtSelection(
            value,
            selection,
            textFromClipboard.replace(/\r?\n/g, " "),
          );
          applyFormattedValue(result.nextText, result.nextSelection);
          return;
        }
      } catch {
        // Fallback below.
      }

      runDocumentCommand("paste");
    }, [
      applyFormattedValue,
      disabled,
      getEditableSelection,
      runDocumentCommand,
      value,
    ]);

    const handleFormattingShortcut = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        const hasModifier = event.ctrlKey || event.metaKey;
        if (!hasModifier) return false;

        const key = event.key.toLowerCase();
        const hasShift = event.shiftKey;

        if (key === "b") {
          event.preventDefault();
          applyMarkerFormatting("**");
          return true;
        }

        if (key === "i") {
          event.preventDefault();
          applyMarkerFormatting("__");
          return true;
        }

        if (key === "u") {
          event.preventDefault();
          applyMarkerFormatting("++");
          return true;
        }

        if (key === "x" && hasShift) {
          event.preventDefault();
          applyMarkerFormatting("~~");
          return true;
        }

        if ((key === "." || event.key === ">") && hasShift) {
          event.preventDefault();
          applyQuoteAction();
          return true;
        }

        if (key === "m" && hasShift) {
          event.preventDefault();
          applyMarkerFormatting("`");
          return true;
        }

        if (key === "p" && hasShift) {
          event.preventDefault();
          applyMarkerFormatting("||");
          return true;
        }

        if (key === "k") {
          event.preventDefault();
          applyAddLinkAction();
          return true;
        }

        if (key === "n" && hasShift) {
          event.preventDefault();
          applyClearFormattingAction();
          return true;
        }

        if (key === "d" && hasShift) {
          event.preventDefault();
          insertCurrentDateAction();
          return true;
        }

        return false;
      },
      [
        applyAddLinkAction,
        applyClearFormattingAction,
        applyMarkerFormatting,
        applyQuoteAction,
        insertCurrentDateAction,
      ],
    );

    const hasLeftSlot = showEmojiPicker;
    const hasRightSlot = Boolean(rightSlot);
    const showPlaceholder = isEmpty && Boolean(placeholder);
    const isMultiline = autoGrow && inputHeight > MIN_INPUT_HEIGHT + 2;

    return (
      <div
        className={cn(
          "relative w-full rounded-xl border-2 border-border/60 bg-secondary/80 px-4 text-[15px] text-foreground transition-[height,border-color,box-shadow] duration-140 ease-[cubic-bezier(.2,.8,.2,1)]",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
        style={{
          height: autoGrow ? inputHeight : MIN_INPUT_HEIGHT,
          minHeight: MIN_INPUT_HEIGHT,
        }}
        data-no-twemoji
      >
        {hasLeftSlot ? (
          <span
            className={cn(
              "absolute left-2 z-10 flex items-center text-muted-foreground transition-[top,transform] duration-140 ease-[cubic-bezier(.2,.8,.2,1)]",
              isMultiline ? "top-2.5" : "top-1/2 -translate-y-1/2",
            )}
          >
            <EmojiPicker
              onSelect={insertEmojiAtCaret}
              onDeleteLast={deleteLastInputElement}
            />
          </span>
        ) : null}
        {showPlaceholder ? (
          <span
            className={cn(
              "pointer-events-none absolute top-[10px] z-0 leading-6 text-muted-foreground transition-opacity duration-150",
              hasLeftSlot ? "left-12" : "left-4",
            )}
          >
            {placeholder}
          </span>
        ) : null}
        {hasRightSlot ? (
          <span
            className={cn(
              "absolute right-2 z-10 flex items-center text-muted-foreground transition-[top,transform] duration-140 ease-[cubic-bezier(.2,.8,.2,1)]",
              isMultiline ? "top-2.5" : "top-1/2 -translate-y-1/2",
            )}
          >
            {rightSlot}
          </span>
        ) : null}
        <ContextMenuPrimitive.Root>
          <ContextMenuPrimitive.Trigger asChild>
            <div
              {...props}
              ref={editableRef}
              role="textbox"
              aria-multiline={false}
              aria-disabled={disabled}
              contentEditable={!disabled}
              suppressContentEditableWarning
              className={cn(
                "w-full py-[10px] leading-6 outline-none [&::-webkit-scrollbar]:hidden",
                autoGrow
                  ? "overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                  : "h-full overflow-x-auto whitespace-pre",
                hasLeftSlot && "pl-8",
                hasRightSlot && "pr-12",
              )}
              style={{
                maxHeight: autoGrow ? maxHeight - 4 : undefined,
              }}
              onBlur={onBlur}
              onFocus={saveSelection}
              onInput={handleInput}
              onKeyUp={saveSelection}
              onMouseUp={saveSelection}
              onSelect={saveSelection}
              onPaste={handlePaste}
              onKeyDown={(event) => {
                if (handleFormattingShortcut(event)) {
                  return;
                }

                if (submitOnEnter && event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSubmit?.();
                }

                onKeyDown?.(event);

                if (event.defaultPrevented) {
                  return;
                }
              }}
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onCompositionEnd={() => {
                isComposingRef.current = false;
                syncFromDom();
              }}
              autoCorrect={autoCorrect}
              autoCapitalize={autoCapitalize}
              spellCheck={spellCheck}
            />
          </ContextMenuPrimitive.Trigger>

          <ChatInputContextMenuContent collisionPadding={10}>
            <ChatInputContextMenuItem
              disabled={disabled}
              onSelect={() => runDocumentCommand("undo")}
            >
              <span>Отменить</span>
              <ChatInputContextMenuShortcut>Ctrl+Z</ChatInputContextMenuShortcut>
            </ChatInputContextMenuItem>
            <ChatInputContextMenuItem
              disabled={disabled}
              onSelect={() => runDocumentCommand("redo")}
            >
              <span>Повторить</span>
              <ChatInputContextMenuShortcut>Ctrl+Y</ChatInputContextMenuShortcut>
            </ChatInputContextMenuItem>

            <ChatInputContextMenuSeparator />

            <ChatInputContextMenuItem
              disabled={disabled}
              onSelect={() => runDocumentCommand("cut")}
            >
              <span>Вырезать</span>
              <ChatInputContextMenuShortcut>Ctrl+X</ChatInputContextMenuShortcut>
            </ChatInputContextMenuItem>
            <ChatInputContextMenuItem
              disabled={disabled}
              onSelect={() => runDocumentCommand("copy")}
            >
              <span>Копировать</span>
              <ChatInputContextMenuShortcut>Ctrl+C</ChatInputContextMenuShortcut>
            </ChatInputContextMenuItem>
            <ChatInputContextMenuItem
              disabled={disabled}
              onSelect={() => void pasteFromClipboardAction()}
            >
              <span>Вставить</span>
              <ChatInputContextMenuShortcut>Ctrl+V</ChatInputContextMenuShortcut>
            </ChatInputContextMenuItem>
            <ChatInputContextMenuItem
              disabled={disabled}
              onSelect={deleteSelectionAction}
            >
              <span>Удалить</span>
            </ChatInputContextMenuItem>

            <ChatInputContextMenuSeparator />

            <ContextMenuPrimitive.Sub>
              <ChatInputContextMenuSubTrigger>
                <span>Форматирование</span>
              </ChatInputContextMenuSubTrigger>
              <ChatInputContextMenuSubContent>
                <ChatInputContextMenuItem
                  disabled={disabled}
                  onSelect={() => applyMarkerFormatting("**")}
                >
                  <span>Жирный</span>
                  <ChatInputContextMenuShortcut>Ctrl+B</ChatInputContextMenuShortcut>
                </ChatInputContextMenuItem>
                <ChatInputContextMenuItem
                  disabled={disabled}
                  onSelect={() => applyMarkerFormatting("__")}
                >
                  <span>Курсив</span>
                  <ChatInputContextMenuShortcut>Ctrl+I</ChatInputContextMenuShortcut>
                </ChatInputContextMenuItem>
                <ChatInputContextMenuItem
                  disabled={disabled}
                  onSelect={() => applyMarkerFormatting("++")}
                >
                  <span>Подчёркнутый</span>
                  <ChatInputContextMenuShortcut>Ctrl+U</ChatInputContextMenuShortcut>
                </ChatInputContextMenuItem>
                <ChatInputContextMenuItem
                  disabled={disabled}
                  onSelect={() => applyMarkerFormatting("~~")}
                >
                  <span>Зачёркнутый</span>
                  <ChatInputContextMenuShortcut>Ctrl+Shift+X</ChatInputContextMenuShortcut>
                </ChatInputContextMenuItem>
                <ChatInputContextMenuItem disabled={disabled} onSelect={applyQuoteAction}>
                  <span>Цитата</span>
                  <ChatInputContextMenuShortcut>Ctrl+Shift+.</ChatInputContextMenuShortcut>
                </ChatInputContextMenuItem>
                <ChatInputContextMenuItem
                  disabled={disabled}
                  onSelect={() => applyMarkerFormatting("`")}
                >
                  <span>Моноширинный</span>
                  <ChatInputContextMenuShortcut>Ctrl+Shift+M</ChatInputContextMenuShortcut>
                </ChatInputContextMenuItem>
                <ChatInputContextMenuItem
                  disabled={disabled}
                  onSelect={() => applyMarkerFormatting("||")}
                >
                  <span>Скрытый</span>
                  <ChatInputContextMenuShortcut>Ctrl+Shift+P</ChatInputContextMenuShortcut>
                </ChatInputContextMenuItem>

                <ChatInputContextMenuSeparator />

                <ChatInputContextMenuItem disabled={disabled} onSelect={applyAddLinkAction}>
                  <span>Добавить ссылку</span>
                  <ChatInputContextMenuShortcut>Ctrl+K</ChatInputContextMenuShortcut>
                </ChatInputContextMenuItem>
                <ChatInputContextMenuItem
                  disabled={disabled}
                  onSelect={insertCurrentDateAction}
                >
                  <span>Дата</span>
                  <ChatInputContextMenuShortcut>Ctrl+Shift+D</ChatInputContextMenuShortcut>
                </ChatInputContextMenuItem>
                <ChatInputContextMenuItem
                  disabled={disabled}
                  onSelect={applyClearFormattingAction}
                >
                  <span>Без форматирования</span>
                  <ChatInputContextMenuShortcut>Ctrl+Shift+N</ChatInputContextMenuShortcut>
                </ChatInputContextMenuItem>
              </ChatInputContextMenuSubContent>
            </ContextMenuPrimitive.Sub>

            <ChatInputContextMenuSeparator />

            <ChatInputContextMenuItem disabled={disabled} onSelect={selectAllAction}>
              <span>Выбрать всё</span>
              <ChatInputContextMenuShortcut>Ctrl+A</ChatInputContextMenuShortcut>
            </ChatInputContextMenuItem>
          </ChatInputContextMenuContent>
        </ContextMenuPrimitive.Root>
        <input
          ref={ref}
          type="hidden"
          name={name}
          value={value}
          readOnly
          autoComplete={autoComplete}
        />
        <Dialog
          open={isLinkDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeLinkDialog();
              return;
            }

            setIsLinkDialogOpen(true);
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Добавить ссылку</DialogTitle>
              <DialogDescription>
                Вставь URL, и он будет применён к текущему выделению.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={linkDialogValue}
              onChange={(event) => setLinkDialogValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  confirmAddLinkAction();
                }
              }}
              placeholder="https://"
              autoFocus
            />
            <DialogFooter className="mt-2">
              <Button type="button" variant="ghost" onClick={closeLinkDialog}>
                Отмена
              </Button>
              <Button
                type="button"
                onClick={confirmAddLinkAction}
                disabled={!linkDialogValue.trim()}
              >
                Добавить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  },
);

EmojiInput.displayName = "EmojiInput";
