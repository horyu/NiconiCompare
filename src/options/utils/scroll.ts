export const scrollIntoViewIfNeeded = (
  target: HTMLElement | null,
  options?: ScrollIntoViewOptions
) => {
  if (!target) {
    return
  }
  const rect = target.getBoundingClientRect()
  const viewportHeight = window.innerHeight || 0
  if (rect.top >= 0 && rect.bottom <= viewportHeight) {
    return
  }
  target.scrollIntoView(options)
}
