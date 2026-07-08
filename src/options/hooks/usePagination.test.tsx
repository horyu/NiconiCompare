import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { usePagination } from "./usePagination"

describe("usePagination", () => {
  it("初期ページが範囲外なら最終ページへ補正すること", () => {
    const { result } = renderHook(() =>
      usePagination({
        items: [1, 2, 3],
        pageSize: 2,
        initialPage: 5
      })
    )

    expect(result.current.currentPage).toBe(2)
    expect(result.current.pageItems).toEqual([3])
  })

  it("件数減少で現在ページが範囲外になったら最終有効ページを表示すること", () => {
    const { result, rerender } = renderHook(
      ({ items }) =>
        usePagination({
          items,
          pageSize: 2,
          initialPage: 3
        }),
      {
        initialProps: {
          items: [1, 2, 3, 4, 5]
        }
      }
    )

    expect(result.current.currentPage).toBe(3)
    expect(result.current.pageItems).toEqual([5])

    rerender({ items: [1, 2, 3] })

    expect(result.current.currentPage).toBe(2)
    expect(result.current.pageItems).toEqual([3])
  })

  it("空一覧時は1ページ目になること", () => {
    const { result } = renderHook(() =>
      usePagination({
        items: [],
        pageSize: 20,
        initialPage: 10
      })
    )

    expect(result.current.currentPage).toBe(1)
    expect(result.current.totalPages).toBe(1)
    expect(result.current.pageItems).toEqual([])
  })

  it("ページ変更時に範囲補正し、上部ページネーションへスクロールすること", () => {
    const requestAnimationFrameMock = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0)
        return 1
      })
    const scrollIntoViewMock = vi.fn()
    const target = {
      getBoundingClientRect: () => ({
        bottom: 1020,
        height: 20,
        left: 0,
        right: 100,
        top: 1000,
        width: 100,
        x: 0,
        y: 1000,
        toJSON: () => ({})
      }),
      scrollIntoView: scrollIntoViewMock
    } as unknown as HTMLElement
    const scrollTargetRef = { current: target }
    const { result } = renderHook(() =>
      usePagination({
        items: [1, 2, 3, 4, 5],
        pageSize: 2,
        initialPage: 1,
        scrollTargetRef
      })
    )

    act(() => {
      result.current.handlePageChange(99)
    })

    expect(result.current.currentPage).toBe(3)
    expect(result.current.pageItems).toEqual([5])
    expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1)
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: "nearest" })

    requestAnimationFrameMock.mockRestore()
  })
})
