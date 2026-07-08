import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject
} from "react"

import { scrollIntoViewIfNeeded } from "../utils/scroll"

interface UsePaginationOptions<T> {
  items: readonly T[]
  pageSize: number
  initialPage: number
  scrollTargetRef?: RefObject<HTMLElement | null>
}

interface UsePaginationResult<T> {
  currentPage: number
  totalPages: number
  startIndex: number
  pageItems: T[]
  resetToFirstPage: () => void
  handlePageChange: (nextPage: number) => void
}

const calculateTotalPages = (itemCount: number, pageSize: number): number =>
  Math.max(1, Math.ceil(itemCount / pageSize))

const clampPage = (page: number, totalPages: number): number => {
  if (!Number.isInteger(page)) {
    return 1
  }
  return Math.min(Math.max(page, 1), totalPages)
}

export const usePagination = <T>({
  items,
  pageSize,
  initialPage,
  scrollTargetRef
}: UsePaginationOptions<T>): UsePaginationResult<T> => {
  const totalPages = calculateTotalPages(items.length, pageSize)
  const [rawPage, setRawPage] = useState(() =>
    clampPage(initialPage, totalPages)
  )
  const currentPage = clampPage(rawPage, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const pageItems = useMemo(
    () => items.slice(startIndex, startIndex + pageSize),
    [items, pageSize, startIndex]
  )

  useEffect(() => {
    if (rawPage !== currentPage) {
      setRawPage(currentPage)
    }
  }, [currentPage, rawPage])

  const scrollToPaginationTop = useCallback(() => {
    const target = scrollTargetRef?.current
    if (!target) {
      return
    }
    requestAnimationFrame(() => {
      scrollIntoViewIfNeeded(target, { block: "nearest" })
    })
  }, [scrollTargetRef])

  const resetToFirstPage = useCallback(() => {
    setRawPage(1)
  }, [])

  const handlePageChange = useCallback(
    (nextPage: number): void => {
      const clampedNextPage = clampPage(nextPage, totalPages)
      if (clampedNextPage === currentPage) {
        return
      }
      setRawPage(clampedNextPage)
      scrollToPaginationTop()
    },
    [currentPage, scrollToPaginationTop, totalPages]
  )

  return {
    currentPage,
    totalPages,
    startIndex,
    pageItems,
    resetToFirstPage,
    handlePageChange
  }
}
