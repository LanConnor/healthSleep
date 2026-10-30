/**
 * 健康数据统一的领域模型：Mock 与 HealthKit 两种数据源都归一到这套结构。
 */

/** 每日步数 */
export interface DailySteps {
  /** 日期，YYYY-MM-DD（本地时区） */
  date: string;
  /** 当日步数 */
  steps: number;
}

/** 每日静息心率 */
export interface RestingHeartRateDay {
  /** 日期，YYYY-MM-DD（本地时区） */
  date: string;
  /** 当日静息心率（bpm） */
  bpm: number;
}

/** 每晚睡眠 */
export interface SleepNight {
  /** 醒来日期，YYYY-MM-DD，作为这一晚的归属键 */
  night: string;
  /** 入睡时间，ISO 8601 */
  start: string;
  /** 醒来时间，ISO 8601 */
  end: string;
  /** 深睡时长（分钟） */
  deepMinutes: number;
  /** 核心睡眠时长（分钟） */
  coreMinutes: number;
  /** REM 睡眠时长（分钟） */
  remMinutes: number;
  /** 清醒时长（分钟） */
  awakeMinutes: number;
}

/** 一次运动训练 */
export interface Workout {
  /** 唯一标识 */
  id: string;
  /** 训练类型 key，如 running / cycling / strengthTraining */
  type: string;
  /** 开始时间，ISO 8601 */
  start: string;
  /** 结束时间，ISO 8601 */
  end: string;
  /** 时长（分钟） */
  durationMinutes: number;
  /** 距离（公里） */
  distanceKm?: number;
  /** 消耗（千卡） */
  energyKcal?: number;
}

/** 一次查询返回的健康数据快照 */
export interface HealthSnapshot {
  /** 数据生成时间，ISO 8601 */
  generatedAt: string;
  /** 数据来源 */
  source: 'mock' | 'healthkit';
  /** 每日步数，按日期升序 */
  dailySteps: DailySteps[];
  /** 每日静息心率，按日期升序 */
  restingHeartRate: RestingHeartRateDay[];
  /** 每晚睡眠，按醒来日期升序 */
  sleep: SleepNight[];
  /** 最近运动，按开始时间降序 */
  workouts: Workout[];
}

/** 数据源抽象：页面只依赖此接口，不关心数据来自 Mock 还是 HealthKit */
export interface HealthProvider {
  /** 数据来源标识 */
  readonly kind: 'mock' | 'healthkit';
  /** 读取最近 days 天的健康快照 */
  loadSnapshot(days: number): Promise<HealthSnapshot>;
}
