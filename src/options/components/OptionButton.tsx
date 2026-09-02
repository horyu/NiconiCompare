import type { ButtonHTMLAttributes, ReactElement } from "react"

type OptionButtonVariant = "default" | "danger" | "primary"
type OptionButtonSize = "compact" | "sm" | "md" | "lg" | "toolbar"

interface OptionButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className"
> {
  align?: "start"
  variant?: OptionButtonVariant
  size?: OptionButtonSize
}

const variantClasses: Record<OptionButtonVariant, string> = {
  default:
    "border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 hover:dark:bg-slate-800",
  danger:
    "border border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-200 hover:dark:bg-rose-950/40",
  primary:
    "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 hover:dark:bg-slate-100"
}

const sizeClasses: Record<OptionButtonSize, string> = {
  compact: "px-2 py-1 text-xs",
  sm: "px-3 py-1 text-xs",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-2 text-sm",
  toolbar: "inline-flex h-8 items-center px-3 text-sm"
}

export const OptionButton = ({
  align,
  size = "md",
  type = "button",
  variant = "default",
  ...props
}: OptionButtonProps): ReactElement => {
  const classes = [
    "rounded-md disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    align === "start" && "self-start"
  ]
    .filter(Boolean)
    .join(" ")

  if (type === "submit") {
    return <button {...props} type="submit" className={classes} />
  }
  if (type === "reset") {
    return <button {...props} type="reset" className={classes} />
  }
  return <button {...props} type="button" className={classes} />
}
