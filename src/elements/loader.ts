import type UI from "../main"

export function loaderElement(this: UI, text?: string): { stop: () => void } {
  let frame = 0;
  const W = 30;
  const bounce: string[][] = [];
  for (let i = 0; i <= W - 2; i++) {
    const l = " ".repeat(i);
    const r = " ".repeat(W - i - 2);
    bounce.push([l + `${this.accentFg}██${this.RST_FG}` + r, l + `${this.accentFg}██${this.RST_FG}` + r]);
  }
  for (let i = W - 3; i > 0; i--) {
    const l = " ".repeat(i);
    const r = " ".repeat(W - i - 2);
    bounce.push([l + `${this.accentFg}██${this.RST_FG}` + r, l + `${this.accentFg}██${this.RST_FG}` + r]);
  }

  const totalW = W + 2;

  const draw = () => {
    const indent = this.centerPad(totalW);
    const [r1, r2] = bounce[frame % bounce.length]!;
    const box = [
      "╔" + "═".repeat(W) + "╗",
      "║" + " ".repeat(W) + "║",
      "║" + r1 + "║",
      "║" + r2 + "║",
      "║" + " ".repeat(W) + "║",
      "╚" + "═".repeat(W) + "╝",
    ].map(l => indent + l).join("\n");
    if (text) {
      return `${indent}\x1B[1m${text}\x1B[22m\n\n${box}`;
    }
    return box;
  };

  const { cleanup, rerender } = this.render(draw, () => { }, { backText: null });

  const id = setInterval(() => {
    frame++;
    rerender();
  }, 40);

  this.loaderInterval = id;

  return {
    stop: () => {
      clearInterval(id);
      this.loaderInterval = null;
      cleanup();
      this.restoreMainScreen();
    }
  };
}
