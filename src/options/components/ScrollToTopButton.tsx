import { useEffect, useState, type ReactElement, type RefObject } from "react"

interface ScrollToTopButtonProps {
  targetRef: RefObject<HTMLElement | null>
  threshold?: number
}

export const ScrollToTopButton = ({
  targetRef,
  threshold = 240
}: ScrollToTopButtonProps): ReactElement | null => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleScroll = (): void => {
      setIsVisible(window.scrollY > threshold)
    }

    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [threshold])

  if (!isVisible) {
    return null
  }

  return (
    <button
      type="button"
      onClick={() =>
        targetRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        })
      }
      className="fixed bottom-6 right-6 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      aria-label="一覧の先頭へスクロール"
      title="一番上へ">
      ↑
    </button>
  )
}
