import type UI from "../main"
import type { ListItem, ListOptions } from "../types"

export function listElement(
  this: UI,
  inputItems: (string | ListItem)[],
  layoutOptions?: ListOptions
): Promise<{ value: string; index: number; cancelled: boolean }> {
  const toItem = (i: string | ListItem): ListItem => typeof i === "string" ? { label: i } : i;
  const items: ListItem[] = inputItems.map(toItem);
  return new Promise((resolve) => {
    let selectedIndex = layoutOptions?.defaultValue !== undefined
      ? Math.min(Math.max(0, layoutOptions.defaultValue), Math.max(0, items.length - 1))
      : 0;
    if (selectedIndex < 0 || selectedIndex >= items.length) selectedIndex = 0;
    let scrollOffset = 0;
    let filter = "";
    const CURSOR_BG = this.accentBg;
    const MAX_VISIBLE = 10;
    let keyHandler: (key: string) => void = () => { };
    const getPool = () => filter ? items.filter(i => i.label.toLowerCase().includes(filter.toLowerCase())) : items;
    const searchable = items.length > 6;

    const draw = () => {
      const LIST_WIDTH = 50;
      const SEL_BG = this.accentBg;
      const SEL_FG = "\x1B[38;5;255m";
      const TEXT_AREA = LIST_WIDTH - 2 * this.PADDING;
      const listIndent = this.centerPad(LIST_WIDTH);
      const emptyLine = `${listIndent}${this.BG}${this.FG}${" ".repeat(LIST_WIDTH)}${this.RST}`;

      const pool = getPool();
      if (selectedIndex >= pool.length) selectedIndex = Math.max(0, pool.length - 1);

      const scrollNeeded = pool.length > MAX_VISIBLE;
      const searchVisible = searchable;

      const searchPrefix = "> ";
      const maxSearchWidth = LIST_WIDTH - 2 * this.PADDING - searchPrefix.length - 1;
      const displayFilter = filter.length > maxSearchWidth
        ? ".." + filter.slice(-(maxSearchWidth - 2))
        : filter;
      const searchRightFill = Math.max(0, LIST_WIDTH - this.PADDING - searchPrefix.length - displayFilter.length - 1);
      const searchLine = searchVisible
        ? `${listIndent}${this.BG}${this.FG}${" ".repeat(this.PADDING)}${this.dim(searchPrefix)}${displayFilter}${CURSOR_BG} ${this.BG}${this.FG}${" ".repeat(searchRightFill)}${this.RST}`
        : "";

      if (scrollNeeded) {
        if (selectedIndex < scrollOffset) scrollOffset = selectedIndex;
        if (selectedIndex >= scrollOffset + MAX_VISIBLE) scrollOffset = selectedIndex - MAX_VISIBLE + 1;
      }

      const visibleItems = scrollNeeded ? pool.slice(scrollOffset, scrollOffset + MAX_VISIBLE) : pool;

      const scrollbarChars: string[] = [];
      if (scrollNeeded) {
        const trackHeight = MAX_VISIBLE;
        const thumbSize = Math.max(1, Math.round((trackHeight / pool.length) * trackHeight));
        const maxScroll = pool.length - trackHeight;
        const ts = maxScroll > 0
          ? Math.round((scrollOffset / maxScroll) * (trackHeight - thumbSize))
          : 0;
        const te = Math.min(ts + thumbSize, trackHeight);
        for (let i = 0; i < trackHeight; i++) {
          scrollbarChars.push(i >= ts && i < te ? "\u2588" : "\u2502");
        }
      }

      const scrollBarWidth = scrollNeeded ? 2 : 0;

      const itemLines = visibleItems.flatMap((item, index) => {
        const actualIndex = scrollNeeded ? scrollOffset + index : index;
        const textWidth = TEXT_AREA - scrollBarWidth;
        const label = item.label;
        const wrapped = this.stripAnsi(label).length > textWidth ? this.wrap(label, textWidth) : [label];
        return wrapped.map((l, i) => {
          const isSelected = actualIndex === selectedIndex && i === 0;
          const bg = isSelected ? SEL_BG : this.BG;
          const fg = isSelected ? SEL_FG : this.FG;

          const plain = this.stripAnsi(l);
          const BADGE_STYLE = item.badgeColor === "green" ? "\x1B[32m\x1B[1m" : item.badgeColor === "yellow" ? "\x1B[33m\x1B[1m" : "\x1B[48;5;196m\x1B[38;5;255m";
          const displayBadge = item.badge || (item.blocked ? "locked" : undefined);
          const truncatedBadge = displayBadge && displayBadge.length > 7 ? displayBadge.slice(0, 7) + ".." : displayBadge;
          const badgeText = truncatedBadge && i === 0 ? ` ${BADGE_STYLE}${truncatedBadge}${bg}${fg}` : "";
          const rightFill = Math.max(0, LIST_WIDTH - this.PADDING - plain.length - scrollBarWidth - (truncatedBadge && i === 0 ? truncatedBadge.length + 1 : 0));
          const style = i === 0 ? "\x1B[1m" : "";
          const resetStyle = i === 0 ? "\x1B[22m" : "";

          let line = `${listIndent}${bg}${fg}${" ".repeat(this.PADDING)}${style}${l}\x1B[0m${bg}${fg}${resetStyle}${" ".repeat(rightFill)}${badgeText}`;
          if (scrollNeeded) {
            line += `${scrollbarChars[index] ?? "\u2502"} `;
          }
          line += this.RST;
          return line;
        });
      });

      const hint = "\u2191 \u2193 to move";
      const hintIndent = this.centerPad(hint.length);
      const listLines = [(searchVisible ? searchLine : emptyLine), ...itemLines, emptyLine, `${hintIndent}${this.dim(hint)}`];
      if (layoutOptions?.footerText) {
        const f = typeof layoutOptions.footerText === "string" ? layoutOptions.footerText : layoutOptions.footerText.label;
        const center = typeof layoutOptions.footerText === "string" ? true : (layoutOptions.footerText.center ?? true);
        const fi = center ? this.centerPad(f.length) : "";
        listLines.push(`${fi}${this.dim(f)}`);
      }
      return listLines.join("\n");
    };

    const { cleanup: origCleanup, rerender } = this.render(draw, (key) => keyHandler(key), layoutOptions);
    let cleanup = origCleanup;

    if (layoutOptions?.refresh) {
      const refreshInterval = async () => {
        const newItems = await layoutOptions.refresh!();
        const newNormalized = newItems.map(toItem);
        if (JSON.stringify(newNormalized) !== JSON.stringify(items)) {
          items.length = 0;
          items.push(...newNormalized);
          rerender();
        }
      };
      refreshInterval();
      const id = setInterval(refreshInterval, 3000);
      cleanup = () => { clearInterval(id); origCleanup(); };
    }

    if (layoutOptions?.resolveOn) {
      const resolvePoll = async () => {
        const resolveValue = await layoutOptions.resolveOn!();
        if (resolveValue) {
          cleanup();
          resolve({ value: resolveValue, index: -1, cancelled: false });
        }
      };
      resolvePoll();
      const resolveId = setInterval(resolvePoll, 3000);
      const origCleanup2 = cleanup;
      cleanup = () => { clearInterval(resolveId); origCleanup2(); };
    }

    keyHandler = (key) => {
      const pool = getPool();

      if (key === "\u001b") {
        cleanup();
        resolve({ value: "", index: selectedIndex, cancelled: true });
        return;
      }
      if (layoutOptions?.lockable && key === "\u000f") {
        const item = pool[selectedIndex];
        if (item) {
          if (item.blocked) {
            delete item.blocked;
            delete item.badge;
          } else {
            item.blocked = true;
          }
          rerender();
        }
        return;
      }
      if (key === "\r" || key === "\r\n") {
        if (pool.length === 0) return;
        if (layoutOptions?.lockable && pool[selectedIndex]?.blocked) return;
        cleanup();
        resolve({ value: pool[selectedIndex]!.value ?? pool[selectedIndex]!.label, index: selectedIndex, cancelled: false });
        return;
      }
      if (key === "\u001b[A") {
        selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : pool.length - 1;
        rerender();
        return;
      }
      if (key === "\u001b[B") {
        selectedIndex = selectedIndex < pool.length - 1 ? selectedIndex + 1 : 0;
        rerender();
        return;
      }
      if (searchable) {
        if (key.length === 1 && /[a-zA-Z0-9 ._-]/.test(key)) {
          filter += key;
          selectedIndex = 0;
          scrollOffset = 0;
          rerender();
          return;
        }
        if (key === "\x7f" || key === "\b") {
          if (filter.length > 0) {
            filter = filter.slice(0, -1);
            selectedIndex = 0;
            scrollOffset = 0;
            rerender();
          }
          return;
        }
      }
    };
  });
}
