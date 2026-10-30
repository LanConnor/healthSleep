import type { HealthSample } from '@capgo/capacitor-health';
import type { HealthProvider, HealthSnapshot, SleepNight } from './types';
import { addDays, toDateKey } from './date';

/**
 * HealthKit 数据源（真机）。
 * 依赖 @capgo/capacitor-health 原生插件；浏览器环境不会走到这里（见 index.ts 的平台判断）。
 * 真机联调时若样本归并策略与实际数据不符，调整本文件内的映射逻辑即可，页面无需改动。
 */
export class HealthKitProvider implements HealthProvider {
  readonly kind = 'healthkit' as const;

  /** 读取最近 days 天的健康快照 */
  async loadSnapshot(days: number): Promise<HealthSnapshot> {
    const { Health } = await import('@capgo/capacitor-health');

    const rangeEnd = new Date();
    const rangeStart = addDays(rangeEnd, -(days - 1));
    rangeStart.setHours(0, 0, 0, 0);
    const startDate = rangeStart.toISOString();
    const endDate = rangeEnd.toISOString();

    const availability = await Health.isAvailable();
    if (!availability.available) {
      throw new Error(`当前设备不支持 HealthKit：${availability.reason ?? '未知原因'}`);
    }

    // 读权限只能在首次调用时弹窗申请一次；iOS 不会回传精确的授权明细，
    // 某个数据类型查不到数据时，按“未授权或暂无数据”处理即可。
    await Health.requestAuthorization({
      read: ['steps', 'restingHeartRate', 'sleep', 'workouts'],
    });

    const [stepsAgg, restingAgg, sleepSamples, workoutResult] = await Promise.all([
      Health.queryAggregated({ dataType: 'steps', startDate, endDate, bucket: 'day', aggregation: 'sum' }),
      Health.queryAggregated({ dataType: 'restingHeartRate', startDate, endDate, bucket: 'day', aggregation: 'average' }),
      Health.readSamples({ dataType: 'sleep', startDate, endDate, limit: 500, ascending: true }),
      Health.queryWorkouts({ startDate, endDate, limit: 50, ascending: false }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      source: 'healthkit',
      dailySteps: stepsAgg.samples.map((sample) => ({
        date: toDateKey(new Date(sample.startDate)),
        steps: Math.round(sample.value),
      })),
      restingHeartRate: restingAgg.samples.map((sample) => ({
        date: toDateKey(new Date(sample.startDate)),
        bpm: Math.round(sample.value),
      })),
      sleep: toSleepNights(sleepSamples.samples),
      workouts: workoutResult.workouts.map((workout) => ({
        id: workout.platformId ?? `${workout.workoutType}-${workout.startDate}`,
        type: workout.workoutType,
        start: workout.startDate,
        end: workout.endDate,
        durationMinutes: Math.round(workout.duration / 60),
        distanceKm: workout.totalDistance != null ? Math.round(workout.totalDistance / 100) / 10 : undefined,
        energyKcal: workout.totalEnergyBurned != null ? Math.round(workout.totalEnergyBurned) : undefined,
      })),
    };
  }
}

/**
 * 把 HealthKit 睡眠样本按“醒来日期”归并成每晚的睡眠结构。
 * HealthKit 一晚可能返回多条样本（inBed / asleep / 分期数据），这里按样本自带的
 * stages 累加各阶段分钟数；没有分期数据时，把样本时长计入核心睡眠。
 */
function toSleepNights(samples: HealthSample[]): SleepNight[] {
  const nights = new Map<string, SleepNight>();

  for (const sample of samples) {
    const nightKey = toDateKey(new Date(sample.endDate));
    const entry = nights.get(nightKey) ?? {
      night: nightKey,
      start: sample.startDate,
      end: sample.endDate,
      deepMinutes: 0,
      coreMinutes: 0,
      remMinutes: 0,
      awakeMinutes: 0,
    };

    if (new Date(sample.startDate) < new Date(entry.start)) {
      entry.start = sample.startDate;
    }
    if (new Date(sample.endDate) > new Date(entry.end)) {
      entry.end = sample.endDate;
    }

    if (sample.stages && sample.stages.length > 0) {
      for (const stage of sample.stages) {
        const minutes = Math.round(stage.durationMinutes);
        if (stage.stage === 'deep') {
          entry.deepMinutes += minutes;
        } else if (stage.stage === 'rem') {
          entry.remMinutes += minutes;
        } else if (stage.stage === 'awake') {
          entry.awakeMinutes += minutes;
        } else if (stage.stage === 'light' || stage.stage === 'asleep') {
          entry.coreMinutes += minutes;
        }
      }
    } else {
      // sleep 数据类型的默认单位是分钟
      entry.coreMinutes += Math.round(sample.value);
    }

    nights.set(nightKey, entry);
  }

  return [...nights.values()].sort((a, b) => a.night.localeCompare(b.night));
}
