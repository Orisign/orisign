"use client";

import { escapeHtml, parseTwemojiText, TWEMOJI_CLASSNAME } from "@/lib/twemoji";
import { cn, EmojiPicker } from "@repo/ui";
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
  focusToken?: string | number | null;
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
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
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

  let placed = false;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const length = getNodeTextLength(node);

    if (remaining > length) {
      remaining -= length;
      continue;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      range.setStart(node, remaining);
      range.collapse(true);
      placed = true;
      break;
    }

    const parent = node.parentNode;
    if (!parent) break;

    const index = Array.prototype.indexOf.call(parent.childNodes, node) as number;
    range.setStart(parent, remaining === 0 ? index : index + 1);
    range.collapse(true);
    placed = true;
    break;
  }

  if (!placed) {
    range.selectNodeContents(root);
    range.collapse(false);
  }

  selection.removeAllRanges();
  selection.addRange(range);
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
      focusToken,
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

    const renderValue = React.useCallback((nextValue: string, caretOffset?: number | null) => {
      const editable = editableRef.current;
      if (!editable) return;

      const html = parseTwemojiText(escapeHtml(nextValue));
      if (editable.innerHTML !== html) {
        editable.innerHTML = html;
      }

      if (caretOffset != null) {
        setCaretOffset(editable, Math.min(caretOffset, nextValue.length));
        lastSelectionRef.current = {
          start: Math.min(caretOffset, nextValue.length),
          end: Math.min(caretOffset, nextValue.length),
        };
      }

      setIsEmpty(nextValue.length === 0);
      lastRenderedValueRef.current = nextValue;
      updateInputHeight();
    }, [updateInputHeight]);

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

    const hasLeftSlot = showEmojiPicker;
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
            if (event.key === "Enter" && !event.shiftKey) {
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
        <input
          ref={ref}
          type="hidden"
          name={name}
          value={value}
          readOnly
          autoComplete={autoComplete}
        />
      </div>
    );
  },
);

EmojiInput.displayName = "EmojiInput";
