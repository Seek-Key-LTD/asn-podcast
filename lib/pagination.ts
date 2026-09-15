/**
 * 分页的唯一真相源。
 *
 * 之前 totalPages 在两处各算一遍（`components/podcast/list.tsx` 和
 * `components/episodes/list.tsx`），服务端和客户端可能算出不同结果。
 * 改成服务端算一次、当 prop 往下传，客户端不再碰这个公式。
 */

export interface PageClamp {
  page: number
  totalPages: number
}

export function clampPage(currentPage: number, total: number, pageSize: number): PageClamp {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)))
  const page = Math.min(Math.max(1, Math.floor(currentPage) || 1), totalPages)
  return { page, totalPages }
}

/** 第 1 页映射到 `/`，其余到 `/page/n`。 */
export function pageHref(page: number): string {
  return page <= 1 ? '/' : `/page/${page}`
}
