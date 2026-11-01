import type {
  DailySteps,
  HealthDiagnostics,
  HealthProvider,
  HealthSnapshot,
  MetricReading,
  RestingHeartRateDay,
  SleepNight,
  Workout,
} from './types';
import { addDays, toDateKey } from './date';
import { EXTRA_METRICS } from './metrics';

/** public/mock/health-export.json 的顶层结构 */
interface MockExport {
  generatedAt: string;
  dailySteps: DailySteps[];
  restingHeartRate: RestingHeartRateDay[];
  sleep: SleepNight[];
  workouts: Workout[];
}

/**
 * 浏览器预览用的 Mock 数据源：读取 public/mock/health-export.json。
 * 数据由 tools/generate-mock.mjs 生成，也可以换成按同样结构整理的真实导出的健康数据。
 */
export class MockHealthProvider implements HealthProvider {
  readonly kind = 'mock' as const;

  /** 缓存请求，避免重复 fetch */
  private cachedExport: Promise<MockExport> | null = null;
  private lastDiagnostics?: HealthDiagnostics;

  getDiagnostics(): HealthDiagnostics | undefined {
    return this.lastDiagnostics;
  }

  /** 读取最近 days 天（含今天）的健康快照 */
  async loadSnapshot(days: number): Promise<HealthSnapshot> {
    const data = await this.loadExport();
    const startKey = toDateKey(addDays(new Date(), -(days - 1)));
    const inRange = (dateKey: string): boolean => dateKey >= startKey;

    const dailySteps = data.dailySteps.filter((item) => inRange(item.date));
    const restingHeartRate = data.restingHeartRate.filter((item) => inRange(item.date));
    const sleep = data.sleep.filter((item) => inRange(item.night));
    const workouts = data.workouts.filter((item) => inRange(toDateKey(new Date(item.start))));

    const latestSteps = dailySteps.at(-1);
    const latestHr = restingHeartRate.at(-1);
    const lastNight = sleep.at(-1);
    const sleepMinutes = lastNight ? lastNight.deepMinutes + lastNight.coreMinutes + lastNight.remMinutes : 0;

    const readings: MetricReading[] = [
      {
        dataType: 'steps',
        label: '步数',
        core: true,
        status: latestSteps ? 'ok' : 'empty',
        value: latestSteps?.steps,
        unit: 'count',
        display: latestSteps ? `${latestSteps.steps.toLocaleString('zh-CN')} 步` : '--',
        detail: `Mock 文件，近 ${days} 天 ${dailySteps.length} 天有数据`,
      },
      {
        dataType: 'restingHeartRate',
        label: '静息心率',
        core: true,
        status: latestHr ? 'ok' : 'empty',
        value: latestHr?.bpm,
        unit: 'bpm',
        display: latestHr ? `${latestHr.bpm} bpm` : '--',
        detail: `Mock 文件，近 ${days} 天 ${restingHeartRate.length} 天有数据`,
      },
      {
        dataType: 'sleep',
        label: '睡眠',
        core: true,
        status: lastNight ? 'ok' : 'empty',
        value: lastNight ? lastNight.deepMinutes + lastNight.coreMinutes + lastNight.remMinutes : undefined,
        unit: 'minute',
        display: lastNight ? `${Math.floor(sleepMinutes / 60)} 小时 ${Math.round(sleepMinutes % 60)} 分` : '--',
        detail: `Mock 文件，近 ${days} 天 ${sleep.length} 晚有数据`,
      },
      {
        dataType: 'workouts',
        label: '运动',
        core: true,
        status: workouts.length > 0 ? 'ok' : 'empty',
        display: workouts.length > 0 ? `${workouts.length} 次` : '--',
        detail: `Mock 文件，近 ${days} 天共 ${workouts.length} 次运动`,
      },
      ...EXTRA_METRICS.map(
        (config): MetricReading => ({
          dataType: config.dataType,
          label: config.label,
          status: 'empty',
          display: '--',
          detail: 'Mock 数据不包含该类型',
        }),
      ),
    ];

    const diagnostics: HealthDiagnostics = {
      provider: 'mock',
      available: true,
      readings,
      notes: ['使用内置 Mock 数据文件，不涉及 HealthKit 授权'],
      generatedAt: data.generatedAt,
    };
    this.lastDiagnostics = diagnostics;

    return {
      generatedAt: data.generatedAt,
      source: 'mock',
      dailySteps,
      restingHeartRate,
      sleep,
      workouts,
      diagnostics,
    };
  }

  /** 加载并缓存 Mock JSON */
  private loadExport(): Promise<MockExport> {
    if (!this.cachedExport) {
      this.cachedExport = fetch(`${import.meta.env.BASE_URL}mock/health-export.json`).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Mock 数据加载失败（HTTP ${response.status}）`);
        }
        return (await response.json()) as MockExport;
      });
    }
    return this.cachedExport;
  }
}
