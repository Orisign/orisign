import twemoji from "twemoji";

type TwemojiParseOptions = NonNullable<Parameters<typeof twemoji.parse>[1]>;

export const APPLE_EMOJI_CDN_BASE =
  "https://cdn.jsdelivr.net/gh/zhdsmy/apple-emoji@ios-18.4/png/160";

export const TWEMOJI_CLASSNAME = "twemoji";
const TWEMOJI_EXCLUDE_SELECTOR =
  "input,textarea,select,option,script,style,[data-no-twemoji],[contenteditable=''],[contenteditable='true'],[contenteditable='plaintext-only']";
const EMOJI_SCAN_PATTERN = /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u;

function toAppleEmojiAssetName(icon: string) {
  const normalized = icon
    .toLowerCase()
    .replaceAll("-fe0f", "")
    .replaceAll("-", "_");

  return `emoji_u${normalized}.png`;
}

export const TWEMOJI_PARSE_OPTIONS: TwemojiParseOptions = {
  callback: (icon) => `${APPLE_EMOJI_CDN_BASE}/${toAppleEmojiAssetName(icon)}`,
  className: TWEMOJI_CLASSNAME,
  attributes: () => ({
    draggable: "false",
    decoding: "async",
  }),
} as const;

export function parseTwemojiInElement(root: HTMLElement) {
  const doc = root.ownerDocument;
  const textNodes: Text[] = [];

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      const value = node.nodeValue;

      if (!parent || !value || !EMOJI_SCAN_PATTERN.test(value)) {
        return NodeFilter.FILTER_REJECT;
      }

      if (parent.closest(TWEMOJI_EXCLUDE_SELECTOR)) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  for (const textNode of textNodes) {
    const text = textNode.nodeValue ?? "";
    const escapedText = escapeHtml(text);
    const parsedText = parseTwemojiText(escapedText);

    if (parsedText === escapedText) {
      continue;
    }

    const container = doc.createElement("span");
    container.innerHTML = parsedText;

    const fragment = doc.createDocumentFragment();
    while (container.firstChild) {
      fragment.appendChild(container.firstChild);
    }

    textNode.replaceWith(fragment);
  }
}

export function parseTwemojiText(text: string) {
  return twemoji.parse(text, TWEMOJI_PARSE_OPTIONS);
}

export function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
