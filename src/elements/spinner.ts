import type UI from "../main"

export function spinnerElement(this: UI): { stop: () => void } {
  let i = 0;
  const id = setInterval(() => {
    process.stderr.write(`\r\x1B[2K${this.accentFg}${this.loaderFrames[i++ % 10]}${this.RST_FG}`);
  }, 80);

  return {
    stop: () => {
      clearInterval(id);
      process.stderr.write(`\r\x1B[2K`);
    }
  };
}
