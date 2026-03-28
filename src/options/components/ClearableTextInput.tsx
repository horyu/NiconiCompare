import type { InputHTMLAttributes, ReactElement } from "react"

interface ClearableTextInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> {
  value: string
  onValueChange: (value: string) => void
  clearLabel: string
}

export const ClearableTextInput = ({
  value,
  onValueChange,
  clearLabel,
  className,
  ...props
}: ClearableTextInputProps): ReactElement => {
  const inputClassName = [
    "border border-slate-200 rounded-md px-2 py-1 w-full bg-white text-slate-900",
    "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
    value.length > 0 ? "pr-8" : "",
    className
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div className="relative">
      <input
        {...props}
        type="text"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={inputClassName}
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onValueChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 bg-white px-1 text-base leading-none z-10 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          aria-label={clearLabel}>
          ×
        </button>
      )}
    </div>
  )
}
