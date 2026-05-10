const zhCnUtcDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

export function toIsoDateString(value: string | number | Date): string {
  return new Date(value).toISOString()
}

export function formatZhCnUtcDate(value: string | number | Date): string {
  return zhCnUtcDateFormatter.format(new Date(value))
}
