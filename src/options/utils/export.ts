type ExportFormat = "csv" | "tsv"
type ExportDownloadOptions = {
  content: string
  format: ExportFormat
  withBom: boolean
  filenamePrefix: string
}

type DelimitedTextInput = {
  header: string[]
  rows: string[][]
  delimiter: string
}

export const buildDelimitedText = ({
  header,
  rows,
  delimiter
}: DelimitedTextInput) => {
  const lines = [header, ...rows].map((cols) =>
    cols.map((value) => escapeField(value, delimiter)).join(delimiter)
  )
  return lines.join("\n")
}

export const buildExportFilename = (prefix: string, format: ExportFormat) => {
  const now = new Date()
  const pad2 = (value: number) => value.toString().padStart(2, "0")
  const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(
    now.getDate()
  )}${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`
  return `${prefix}-${stamp}.${format}`
}

export const downloadDelimitedFile = ({
  content,
  format,
  withBom,
  filenamePrefix
}: ExportDownloadOptions) => {
  const payload = withBom && format === "csv" ? `\uFEFF${content}` : content
  const blob = new Blob([payload], {
    type: "text/plain;charset=utf-8"
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = buildExportFilename(filenamePrefix, format)
  anchor.click()
  URL.revokeObjectURL(url)
}

const escapeField = (value: string, delimiter: string) => {
  const text = value ?? ""
  if (
    text.includes(delimiter) ||
    text.includes("\n") ||
    text.includes("\r") ||
    text.includes('"')
  ) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}
