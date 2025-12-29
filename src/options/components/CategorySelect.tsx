type CategoryOption = {
  id: string
  name: string
}

type CategorySelectProps = {
  value: string
  options: CategoryOption[]
  onChange: (value: string) => void
  disabled?: boolean
  size?: "sm" | "md"
  className?: string
}

export const CategorySelect = ({
  value,
  options,
  onChange,
  disabled = false,
  size = "md",
  className
}: CategorySelectProps) => {
  const baseClass = "border border-slate-200 rounded-md px-2 py-1 truncate"
  const sizeClass = size === "sm" ? "text-xs" : "text-sm"
  const classes = `${baseClass} ${sizeClass}${className ? ` ${className}` : ""}`

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className={classes}>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  )
}
