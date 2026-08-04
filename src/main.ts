import { execSync } from "child_process";
import { listElement } from "./elements/list";
import { inputElement } from "./elements/input";
import { spinnerElement } from "./elements/spinner";
import { loaderElement } from "./elements/loader";
import { startBadgeElement, stopBadgeElement } from "./elements/badge";
import type { Color, LogType, Render } from "./types";

export type { Color, InputOptions, LayoutOptions, ListItem, ListOptions, LogType, Render } from "./types";

export default class UI {
  private accent: number;

  static readonly Colors: Record<Color, number> = {
    blue: 27,
    red: 196,
    green: 40,
    yellow: 226,
    cyan: 51,
    magenta: 200,
    gray: 245,
  };

  altScreen = false;
  loaderInterval: NodeJS.Timeout | null = null;
  readonly PADDING = 1;
  readonly BG = "\x1B[48;5;235m";
  readonly FG = "\x1B[38;5;255m";
  readonly RST = "\x1B[39m\x1B[49m";
  readonly RST_FG = "\x1B[39m";
  readonly loaderFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

  list = listElement;
  input = inputElement;
  spinner = spinnerElement;
  loader = loaderElement;
  startBadge = startBadgeElement;
  stopBadge = stopBadgeElement;

  constructor(title: string, color: Color = "blue") {
    process.stdout.write(`\x1b]0;${title}\x07`);
    this.accent = UI.Colors[color];
  }

  get accentFg(): string {
    return `\x1B[38;5;${this.accent}m`;
  }

  get accentBg(): string {
    return `\x1B[48;5;${this.accent}m`;
  }

  cols(): number {
    return process.stdout.columns || 80;
  }

  async pasteFromClipboard() {
    if (process.platform !== "win32") return "";
    return execSync(`powershell -NoProfile -NonInteractive -Command "Get-Clipboard"`).toString();
  };

  textColor(str: string, type: LogType) {
    return `\x1b[3${type === "success" ? 2 : type === "warning" ? 3 : type === "error" ? 1 : 4}m\x1b[1m${str}\x1b[0m`;
  };

  wrap(text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    for (const segment of text.split("\n")) {
      const plain = this.stripAnsi(segment);
      if (plain.length <= maxWidth) {
        lines.push(segment);
      } else {
        let visualLen = 0;
        let line = "";
        for (let i = 0; i < segment.length; i++) {
          if (segment[i] === '\x1B') {
            const end = segment.indexOf('m', i);
            line += segment.slice(i, (end !== -1 ? end : i) + 1);
            if (end !== -1) i = end;
            continue;
          }
          line += segment[i]!;
          visualLen++;
          if (visualLen >= maxWidth) {
            lines.push(line);
            line = "";
            visualLen = 0;
          }
        }
        if (line) lines.push(line);
      }
    }
    return lines;
  }

  stripAnsi(str: string): string {
    return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
  }

  centerPad(width: number): string {
    return " ".repeat(Math.max(0, Math.floor((this.cols() - width) / 2)));
  }

  dim(str: string): string {
    return `\x1B[2m${str}\x1B[22m`;
  }

  setupStdin() {
    try { process.stdin.setRawMode(true); } catch { }
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
  }

  createAltScreen() {
    if (!this.altScreen) {
      process.stdout.write("\x1B[?25l\x1B[?1049h");
      this.altScreen = true;
    }
  }

  restoreMainScreen() {
    if (this.loaderInterval) {
      clearInterval(this.loaderInterval);
      this.loaderInterval = null;
    }
    if (this.altScreen) {
      try {
        process.stdout.removeAllListeners("resize");
        process.stdin.removeAllListeners("data");
        process.stdin.setRawMode(false);
        process.stdout.write("\x1B[?1049l\x1B[?25h");
      } catch { }
      this.altScreen = false;
    }
  }

  render: Render = (draw, handleKey, { title, desc, backText, action } = {}) => {
    const TITLE_WIDTH = 50;
    const stdin = process.stdin;

    this.setupStdin();
    this.createAltScreen();

    const renderFrame = () => {
      const c = this.cols();
      const r = process.stdout.rows || 24;

      if (c < 82 || r < 24) {
        const msg = `Terminal too small — need 82x24, have ${c}x${r}`;
        const pad = Math.max(0, Math.floor((r - 1) / 2));
        process.stdout.write("\x1B[2J\x1B[H");
        process.stdout.write("\n".repeat(pad));
        process.stdout.write(this.centerPad(msg.length));
        process.stdout.write("\x1B[41m\x1B[97m" + msg + "\x1B[39m\x1B[49m\n");
        return;
      }

      const backLine = this.dim(`← ${backText || "Back"} (Esc)`);

      const contentLines: string[] = [];

      if (title) {
        const lines = title.includes("\n") ? title.split("\n") : this.wrap(title, TITLE_WIDTH);
        if (title.includes("\n")) {
          const blockWidth = Math.max(...lines.map(l => l.length));
          const indent = this.centerPad(blockWidth);
          lines.forEach((l) => {
            contentLines.push(`${indent}${l}`);
          });
        } else {
          lines.forEach((l, i) => {
            const indent = this.centerPad(TITLE_WIDTH);
            contentLines.push(i === 0 ? `${indent}\x1B[1m${l}\x1B[22m` : `${indent}${l}`);
          });
        }
      }
      if (desc) {
        const lines = this.wrap(desc, TITLE_WIDTH);
        lines.forEach((l) => {
          const indent = this.centerPad(TITLE_WIDTH);
          contentLines.push(`${indent}\x1B[2m${l}\x1B[22m`);
        });
      }
      if (title || desc) contentLines.push("");

      const rawList = draw();
      if (rawList) {
        contentLines.push(...rawList.split("\n"));
      }

      const termHeight = process.stdout.rows || 24;
      const hasBack = backText !== null;
      const topPadding = Math.max(0, Math.floor((termHeight - (hasBack ? 1 : 0) - contentLines.length) / 2));

      let frame = "\x1B[?2026h\x1B[2J\x1B[H";
      if (hasBack) {
        frame += backLine;
        if (action) {
          const actionText = `${action.label} (Ctrl+O)`;
          frame += `\x1B[${c - actionText.length + 1}G\x1B[2m${actionText}\x1B[22m`;
        }
        frame += "\n";
      }
      frame += "\n".repeat(topPadding);
      frame += contentLines.join("\n");
      frame += "\n\n\x1B[?2026l";
      process.stdout.write(frame);
    };

    renderFrame();

    const onData = async (key: string) => {
      if (key === "\u000f" && action) {
        stdin.removeListener("data", onData);
        process.stdout.removeListener("resize", renderFrame);
        await action.run();
        renderFrame();
        handleKey(key);
        process.stdout.on("resize", renderFrame);
        stdin.on("data", onData);
        return;
      }
      handleKey(key);
    };

    process.stdout.on("resize", renderFrame);
    stdin.on("data", onData);

    const cleanup = () => {
      process.stdout.removeListener("resize", renderFrame);
      stdin.removeListener("data", onData);
    };

    return { cleanup, rerender: renderFrame };
  }

  badgeInterval: NodeJS.Timeout | null = null;
  badgeFlag: { value: boolean } | null = null;
  readonly badgeKeyHandler = (key: string) => {
    if (key === "\u000f" && this.badgeFlag) this.badgeFlag.value = true;
  };
}
