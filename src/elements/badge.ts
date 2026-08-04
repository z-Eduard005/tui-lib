import type UI from "../main"

export function startBadgeElement(this: UI, text: string, flag?: { value: boolean }) {
  this.stopBadge();
  this.badgeFlag = flag ?? null;

  const draw = () => {
    if (this.altScreen) return;
    const badge = `${this.accentBg}\x1B[97m ${text} \x1B[39m\x1B[49m`;
    const cols = this.cols();
    process.stdout.write(`\x1B7\x1B[1;${Math.max(1, cols - text.length - 1)}H${badge}\x1B8`);
  };
  draw();
  this.badgeInterval = setInterval(draw, 200);

  this.setupStdin();
  process.stdin.on("data", this.badgeKeyHandler);
}

export function stopBadgeElement(this: UI) {
  if (this.badgeInterval) {
    clearInterval(this.badgeInterval);
    this.badgeInterval = null;
  }
  try {
    process.stdin.removeListener("data", this.badgeKeyHandler);
    process.stdin.setRawMode(false);
  } catch { }
  this.badgeFlag = null;
}
