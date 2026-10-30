/** 训练类型 key 到中文名称的映射（覆盖常见类型，未知类型兜底为“训练”） */
const WORKOUT_LABELS: Record<string, string> = {
  running: '跑步',
  runningTreadmill: '跑步机',
  walking: '步行',
  cycling: '骑行',
  bikingStationary: '动感单车',
  swimming: '游泳',
  swimmingPool: '泳池游泳',
  swimmingOpenWater: '公开水域游泳',
  strengthTraining: '力量训练',
  traditionalStrengthTraining: '力量训练',
  functionalStrengthTraining: '功能性训练',
  hiking: '徒步',
  yoga: '瑜伽',
  pilates: '普拉提',
  highIntensityIntervalTraining: '高强度间歇',
  rowing: '划船',
  rowingMachine: '划船机',
  elliptical: '椭圆机',
  stairClimbing: '爬楼',
  jumpRope: '跳绳',
  basketball: '篮球',
  soccer: '足球',
  badminton: '羽毛球',
  tableTennis: '乒乓球',
  tennis: '网球',
  dancing: '舞蹈',
};

/** 获取训练类型的中文名称 */
export function workoutLabel(type: string): string {
  return WORKOUT_LABELS[type] ?? '训练';
}

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** ISO 时间 → “10月29日 周三” */
export function formatDateCn(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAY_NAMES[date.getDay()]}`;
}

/** 日期键（YYYY-MM-DD）→ “10/29” */
export function formatShortDate(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}/${Number(day)}`;
}

/** ISO 时间 → “07:32” */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`;
}

/** 分钟数 → “7 小时 12 分” / “45 分钟” */
export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return hours > 0 ? `${hours} 小时 ${minutes} 分` : `${minutes} 分钟`;
}

/** 数字加千分位 */
export function formatSteps(steps: number): string {
  return steps.toLocaleString('zh-CN');
}
