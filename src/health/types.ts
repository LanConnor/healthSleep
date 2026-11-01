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

/** 单项数据类型的读取状态 */
export type MetricStatus = 'ok' | 'empty' | 'error';

/** 单个数据类型的读取结果（用于"更多指标"与诊断面板） */
export interface MetricReading {
  /** 插件数据类型 key，如 steps / heartRateVariability */
  dataType: string;
  /** 中文名称 */
  label: string;
  /** 是否为看板核心指标（步数/静息心率/睡眠/运动） */
  core?: boolean;
  status: MetricStatus;
  /** 数值（最近一天或最近一条样本） */
  value?: number;
  /** 插件返回的单位 */
  unit?: string;
  /** 展示文本，如“8,025 步” / “--” / “读取失败” */
  display: string;
  /** 状态说明：错误信息、样本统计等 */
  detail?: string;
}

/** 一次数据读取的完整诊断信息 */
export interface HealthDiagnostics {
  /** 最终采用的数据源 */
  provider: 'mock' | 'healthkit' | 'demo';
  /** HealthKit 是否可用（Mock 数据源不适用） */
  available?: boolean;
  availabilityReason?: string;
  /** 授权请求结果 */
  authorization?: {
    status: 'ok' | 'error';
    readAuthorized?: string[];
    readDenied?: string[];
    error?: string;
  };
  /** 各数据类型的读取结果 */
  readings: MetricReading[];
  /** 其他备注（回退原因、平台限制等） */
  notes?: string[];
  generatedAt: string;
}

/** 一次查询返回的健康数据快照 */
export interface HealthSnapshot {
  /** 数据生成时间，ISO 8601 */
  generatedAt: string;
  /** 数据来源：mock=浏览器预览，healthkit=真机，demo=HealthKit 不可用时回退的演示数据 */
  source: 'mock' | 'healthkit' | 'demo';
  /** source 为 demo 时的回退原因（用于界面提示） */
  demoReason?: string;
  /** 每日步数，按日期升序 */
  dailySteps: DailySteps[];
  /** 每日静息心率，按日期升序 */
  restingHeartRate: RestingHeartRateDay[];
  /** 每晚睡眠，按醒来日期升序 */
  sleep: SleepNight[];
  /** 最近运动，按开始时间降序 */
  workouts: Workout[];
  /** 本次读取的诊断信息（页面底部展示） */
  diagnostics?: HealthDiagnostics;
}

/** 数据源抽象：页面只依赖此接口，不关心数据来自 Mock 还是 HealthKit */
export interface HealthProvider {
  /** 数据来源标识 */
  readonly kind: 'mock' | 'healthkit' | 'demo';
  /** 读取最近 days 天的健康快照 */
  loadSnapshot(days: number): Promise<HealthSnapshot>;
  /** 最近一次读取的诊断信息（读取失败时也可用，供回退场景展示） */
  getDiagnostics?(): HealthDiagnostics | undefined;
}
