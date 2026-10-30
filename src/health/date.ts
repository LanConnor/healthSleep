/** 把 Date 转成 YYYY-MM-DD 的本地日期键（避免 toISOString 的时区偏移问题） */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 返回 base 偏移 delta 天后的新 Date */
export function addDays(base: Date, delta: number): Date {
  const result = new Date(base);
  result.setDate(result.getDate() + delta);
  return result;
}
