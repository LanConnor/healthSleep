import type { DailySteps, HealthProvider, HealthSnapshot, RestingHeartRateDay, SleepNight, Workout } from './types';
import { addDays, toDateKey } from './date';

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

  /** 读取最近 days 天（含今天）的健康快照 */
  async loadSnapshot(days: number): Promise<HealthSnapshot> {
    const data = await this.loadExport();
    const startKey = toDateKey(addDays(new Date(), -(days - 1)));
    const inRange = (dateKey: string): boolean => dateKey >= startKey;

    return {
      generatedAt: data.generatedAt,
      source: 'mock',
      dailySteps: data.dailySteps.filter((item) => inRange(item.date)),
      restingHeartRate: data.restingHeartRate.filter((item) => inRange(item.date)),
      sleep: data.sleep.filter((item) => inRange(item.night)),
      workouts: data.workouts.filter((item) => inRange(toDateKey(new Date(item.start)))),
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
