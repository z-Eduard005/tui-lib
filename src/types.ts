export type LayoutOptions = {
  title?: string
  desc?: string
  backText?: string | null
  action?: { label: string; run: () => void | Promise<void> }
  action2?: { label: string; run: () => void | Promise<void> }
}

export type InputOptions = LayoutOptions & {
  defaultValue?: string
  maxLen?: number
  filter?: RegExp
  validate?: (value: string) => string | null
  allowEmpty?: boolean
}

export type ListOptions = LayoutOptions & {
  refresh?: () => Promise<(string | ListItem)[]>
  resolveOn?: () => Promise<string | null | undefined>
  defaultValue?: number
  lockable?: boolean
  footerText?: string | { label: string; center?: boolean }
}

export type ListItem = {
  label: string
  value?: string
  badge?: string
  badgeColor?: "red" | "green" | "yellow"
  blocked?: boolean
}

export type Color = "blue" | "red" | "green" | "yellow" | "cyan" | "magenta" | "gray"

export type LogType = "info" | "success" | "warning" | "error" | Color | "accent"

export type Render = (
  draw: () => string,
  handleKey: (key: string) => void,
  layoutOptions?: LayoutOptions
) => {
  cleanup: () => void
  rerender: () => void
}
