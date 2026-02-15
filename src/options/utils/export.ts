import { formatCompactTimestamp } from "./date"

type ExportFormat = "csv" | "tsv"
interface ExportDownloadOptions {
  content: string
  format: ExportFormat
  withBom: boolean
  filenamePrefix: string
  categoryName?: string
}

interface DelimitedTextInput {
  header: string[]
  rows: string[][]
  delimiter: string
}

export const buildDelimitedText = ({
  header,
  rows,
  delimiter
}: DelimitedTextInput): string => {
  const lines = [header, ...rows].map((cols) =>
    cols.map((value) => escapeField(value, delimiter)).join(delimiter)
  )
  return lines.join("\n")
}

export const buildExportFilename = (
  prefix: string,
  format: ExportFormat,
  categoryName?: string
): string => {
  const stamp = formatCompactTimestamp(new Date())
  const categorySuffix =
    categoryName !== undefined
      ? `-${sanitizeFilenameSegment(categoryName)}`
      : ""
  return `${prefix}${categorySuffix}-${stamp}.${format}`
}

export const downloadDelimitedFile = ({
  content,
  format,
  withBom,
  filenamePrefix,
  categoryName
}: ExportDownloadOptions): void => {
  const payload = withBom && format === "csv" ? `\uFEFF${content}` : content
  const blob = new Blob([payload], {
    type: "text/plain;charset=utf-8"
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = buildExportFilename(filenamePrefix, format, categoryName)
  anchor.click()
  URL.revokeObjectURL(url)
}

const escapeField = (value: string, delimiter: string): string => {
  const text = value ?? ""
  if (
    text.includes(delimiter) ||
    text.includes("\n") ||
    text.includes("\r") ||
    text.includes('"')
  ) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

const sanitizeFilenameSegment = (value: string): string =>
  value.replaceAll(/[\\/:*?"<>|]/g, "")
