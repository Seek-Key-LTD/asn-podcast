import type { UpcomingSeason } from '@/lib/db'
import { formatZhCnUtcDate } from '@/lib/date'

const SEASON_CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

/**
 * 「第二季 · 立冬 2026年11月7日」或「第二季 · 日期待定」。
 *
 * 货架卡片、系列专页、RSS 频道的「即将上线」说明都从这一处派生，
 * 免得三处各自拼中文季号、哪天改了格式要对三个文件。
 */
export function describeUpcomingSeason(s: UpcomingSeason): string {
  return `第${SEASON_CN[s.season] ?? s.season}季 · ${
    s.premieres_at
      ? `${s.note ? `${s.note} ` : ''}${formatZhCnUtcDate(s.premieres_at)}`
      : '日期待定'
  }`
}
