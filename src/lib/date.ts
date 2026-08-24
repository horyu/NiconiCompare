export const pad2 = (value: number): string => value.toString().padStart(2, "0")

export const formatCompactTimestamp = (date: Date): string =>
  `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}${pad2(
    date.getHours()
  )}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`

export const formatPaddedDateTime = (date: Date): string =>
  `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} ${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`

export const formatDateInput = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

export const parseDateStart = (value: string): number | undefined => {
  if (value.length === 0) return undefined
  const timestamp = new Date(`${value}T00:00:00`).getTime()
  return Number.isNaN(timestamp) ? undefined : timestamp
}
