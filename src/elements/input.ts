import type UI from "../main"
import type { InputOptions } from "../types"

export function inputElement(
  this: UI,
  layoutOptions?: InputOptions
): Promise<{ value: string; cancelled: boolean }> {
  const { defaultValue, maxLen, filter, validate, allowEmpty } = layoutOptions ?? {};
  return new Promise((resolve) => {
    let value = defaultValue ?? "";
    let cursorPos = value.length;
    let triedSubmit = false;
    let keyHandler: (key: string) => void = () => { };

    const MAX_LEN = maxLen ?? 50;
    const CURSOR_BG = this.accentBg;

    const sanitize = (text: string) => [...text].filter((c) => {
      const code = c.charCodeAt(0);
      return code >= 33 && code <= 126 && (!filter || filter.test(c));
    }).join("");

    const insert = (text: string) => {
      value = value.slice(0, cursorPos) + text + value.slice(cursorPos);
      cursorPos += text.length;
    };

    const getError = (): string | null => {
      if (!allowEmpty && value.length <= 3) return "Must be more than 3 symbols";
      if (validate) return validate(value);
      return null;
    };

    const draw = () => {
      const inputWidth = Math.min(MAX_LEN, this.cols() - 4);
      const indent = this.centerPad(inputWidth);
      const emptyLine = `${indent}${this.BG}${this.FG}${" ".repeat(inputWidth)}${this.RST}`;

      let offset = 0;
      if (cursorPos >= inputWidth) {
        offset = cursorPos - inputWidth + 1;
      }
      if (offset > 0 && offset + inputWidth > value.length) {
        offset = Math.max(0, value.length - inputWidth);
      }
      if (offset + inputWidth > value.length + 1 && value.length < MAX_LEN) {
        offset = Math.max(0, value.length + 1 - inputWidth);
      }

      let visible = "";
      for (let i = 0; i < inputWidth; i++) {
        const charIndex = offset + i;
        const isCursor = charIndex === cursorPos;

        if (charIndex < value.length) {
          visible += isCursor
            ? `${CURSOR_BG}\x1B[38;5;15m${value[charIndex]!}${this.BG}${this.FG}`
            : value[charIndex]!;
        } else {
          visible += isCursor
            ? `${CURSOR_BG} ${this.BG}${this.FG}`
            : `\x1B[2m_\x1B[22m`;
        }
      }

      const line = `${indent}${this.BG}${this.FG}${visible}${this.RST}`;

      const error = getError();
      const errorLine = triedSubmit && error
        ? `${indent}\x1B[38;5;196m* ${error}\x1B[39m`
        : null;

      const parts = [emptyLine, line, emptyLine];
      if (errorLine) parts.push(errorLine);
      return parts.join("\n");
    };

    const { cleanup, rerender } = this.render(draw, (key) => keyHandler(key), layoutOptions);

    keyHandler = (key) => {
      if (key === "\x16") {
        this.pasteFromClipboard().then(paste => {
          if (!paste) return;
          const sanitized = sanitize(paste);
          const available = MAX_LEN - value.length;
          const sliced = sanitized.slice(0, available);
          if (sliced.length > 0) {
            insert(sliced);
            rerender();
          }
        });
        return;
      }
      if (key === "\u001b") {
        cleanup();
        resolve({ value: "", cancelled: true });
        return;
      }
      if (key === "\r" || key === "\r\n") {
        if (getError()) {
          triedSubmit = true;
          rerender();
          return;
        }
        cleanup();
        resolve({ value, cancelled: false });
        return;
      }
      if (key === "\x7f" || key === "\b") {
        if (cursorPos > 0) {
          value = value.slice(0, cursorPos - 1) + value.slice(cursorPos);
          cursorPos--;
          rerender();
        }
        return;
      }
      if (key === "\u001b[D") {
        if (cursorPos > 0) {
          cursorPos--;
          rerender();
        }
        return;
      }
      if (key === "\u001b[C") {
        if (cursorPos < value.length) {
          cursorPos++;
          rerender();
        }
        return;
      }
      if (key.length > 1 && key.charCodeAt(0) !== 27) {
        const sanitized = sanitize(key);
        if (sanitized.length === 0) return;
        const available = MAX_LEN - value.length;
        const paste = sanitized.slice(0, available);
        if (paste.length > 0) {
          insert(paste);
          rerender();
        }
        return;
      }
      if (key.length === 1 && key.charCodeAt(0) >= 33 && value.length < MAX_LEN && (!filter || filter.test(key))) {
        insert(key);
        rerender();
        return;
      }
    };
  });
}
