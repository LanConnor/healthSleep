import type {
  HealthDataType,
  HealthPlugin,
  HealthSample,
  QueryAggregatedResult,
  QueryWorkoutsResult,
  ReadSamplesResult,
} from '@capgo/capacitor-health';
import type { HealthDiagnostics, HealthProvider, HealthSnapshot, MetricReading, SleepNight } from './types';
import { addDays, toDateKey } from './date';
import { EXTRA_METRICS, formatMetricValue, type MetricConfig } from './metrics';

/**
 * 请求读取的数据类型：@capgo/capacitor-health 支持的全部健康与运动数据。
 * 授权弹窗只出现一次；后续单项读取失败不影响其他类型（诊断面板会逐项列出）。
 */
const READ_TYPES: HealthDataType[] = [
  'steps',
  'distance',
  'calories',
  'heartRate',
  'weight',
  'sleep',
  'respiratoryRate',
  'oxygenSaturation',
  'restingHeartRate',
  'heartRateVariability',
  'vo2Max',
  'bloodPressure',
  'bloodGlucose',
  'bodyTemperature',
  'height',
  'flightsClimbed',
  'exerciseTime',
  'distanceCycling',
  'bodyFat',
  'basalBodyTemperature',
  'appleSleepingWristTemperature',
  'basalCalories',
  'totalCalories',
  'mindfulness',
  'appleStandHour',
  'dietaryWater',
  'dietaryEnergyConsumed',
  'workouts',
];

type Outcome<T> = { ok: true; result: T } | { ok: false; error: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function attempt<T>(run: () => Promise<T>): Promise<Outcome<T>> {
  try {
    return { ok: true, result: await run() };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

interface Range {
  days: number;
  startDate: string;
  endDate: string;
  /** 身体成分等低频数据用近一年范围取最近一条 */
  latestStartDate: string;
}

/** 读取单个扩展指标：错误只记录到诊断，不中断整体读取 */
async function readMetric(health: HealthPlugin, config: MetricConfig, range: Range): Promise<MetricReading> {
  const base = { dataType: config.dataType as string, label: config.label };
  try {
    if (config.mode === 'bloodPressure') {
      const result = await health.readSamples({
        dataType: config.dataType,
        startDate: range.latestStartDate,
        endDate: range.endDate,
        limit: 1,
        ascending: false,
      });
      const sample = result.samples[0];
      if (!sample) {
        return { ...base, status: 'empty', display: '--', detail: '近一年无记录' };
      }
      const display =
        sample.systolic != null && sample.diastolic != null
          ? `${Math.round(sample.systolic)}/${Math.round(sample.diastolic)} mmHg`
          : formatMetricValue(sample.value, sample.unit);
      return { ...base, status: 'ok', value: sample.value, unit: sample.unit, display, detail: '取最近一条血压样本' };
    }

    if (config.mode === 'latest') {
      const result = await health.readSamples({
        dataType: config.dataType,
        startDate: range.latestStartDate,
        endDate: range.endDate,
        limit: 1,
        ascending: false,
      });
      const sample = result.samples[0];
      if (!sample) {
        return { ...base, status: 'empty', display: '--', detail: '近一年无记录' };
      }
      return {
        ...base,
        status: 'ok',
        value: sample.value,
        unit: sample.unit,
        display: formatMetricValue(sample.value, sample.unit),
        detail: '取最近一条样本',
      };
    }

    const result = await health.queryAggregated({
      dataType: config.dataType,
      startDate: range.startDate,
      endDate: range.endDate,
      bucket: 'day',
      aggregation: config.mode,
    });
    const latest = result.samples.at(-1);
    if (!latest) {
      return { ...base, status: 'empty', display: '--', detail: `近 ${range.days} 天无数据` };
    }
    return {
      ...base,
      status: 'ok',
      value: latest.value,
      unit: latest.unit,
      display: formatMetricValue(latest.value, latest.unit),
      detail: `近 ${range.days} 天 ${result.samples.length} 天有数据，显示最近一天`,
    };
  } catch (error) {
    return { ...base, status: 'error', display: '读取失败', detail: errorMessage(error) };
  }
}

/** 核心聚合类指标（步数 / 静息心率）的诊断条目 */
function aggregatedReading(
  dataType: string,
  label: string,
  outcome: Outcome<QueryAggregatedResult>,
  days: number,
): MetricReading {
  if (!outcome.ok) {
    return { dataType, label, core: true, status: 'error', display: '读取失败', detail: outcome.error };
  }
  const samples = outcome.result.samples;
  const latest = samples.at(-1);
  return {
    dataType,
    label,
    core: true,
    status: latest ? 'ok' : 'empty',
    value: latest?.value,
    unit: latest?.unit,
    display: latest ? formatMetricValue(latest.value, latest.unit) : '--',
    detail: `近 ${days} 天 ${samples.length} 天有数据`,
  };
}

/** 睡眠的诊断条目 */
function sleepReading(outcome: Outcome<ReadSamplesResult>, days: number): MetricReading {
  if (!outcome.ok) {
    return { dataType: 'sleep', label: '睡眠', core: true, status: 'error', display: '读取失败', detail: outcome.error };
  }
  const nights = toSleepNights(outcome.result.samples);
  const lastNight = nights.at(-1);
  const totalMinutes = lastNight ? lastNight.deepMinutes + lastNight.coreMinutes + lastNight.remMinutes : 0;
  return {
    dataType: 'sleep',
    label: '睡眠',
    core: true,
    status: nights.length > 0 ? 'ok' : 'empty',
    value: lastNight ? totalMinutes : undefined,
    unit: 'minute',
    display: lastNight ? `${Math.floor(totalMinutes / 60)} 小时 ${Math.round(totalMinutes % 60)} 分` : '--',
    detail: `近 ${days} 天 ${nights.length} 晚有数据`,
  };
}

/** 运动的诊断条目 */
function workoutReading(outcome: Outcome<QueryWorkoutsResult>, days: number): MetricReading {
  if (!outcome.ok) {
    return { dataType: 'workouts', label: '运动', core: true, status: 'error', display: '读取失败', detail: outcome.error };
  }
  const count = outcome.result.workouts.length;
  return {
    dataType: 'workouts',
    label: '运动',
    core: true,
    status: count > 0 ? 'ok' : 'empty',
    display: count > 0 ? `${count} 次` : '--',
    detail: `近 ${days} 天共 ${count} 次运动`,
  };
}

/**
 * HealthKit 数据源（真机）。
 * 依赖 @capgo/capacitor-health 原生插件；浏览器环境不会走到这里（见 index.ts 的平台判断）。
 * 读取策略：先申请全部类型的读授权，再并行读取核心指标与全部扩展指标；
 * 单项失败只记录诊断，全部失败才抛错（由 DemoHealthProvider 回退演示数据）。
 */
export class HealthKitProvider implements HealthProvider {
  readonly kind = 'healthkit' as const;
  private lastDiagnostics?: HealthDiagnostics;

  getDiagnostics(): HealthDiagnostics | undefined {
    return this.lastDiagnostics;
  }

  /** 读取最近 days 天的健康快照 */
  async loadSnapshot(days: number): Promise<HealthSnapshot> {
    const { Health } = await import('@capgo/capacitor-health');

    const readings: MetricReading[] = [];
    const diagnostics: HealthDiagnostics = {
      provider: 'healthkit',
      readings,
      notes: ['iOS 不返回精确的读授权状态，以各类型实际查询结果为准'],
      generatedAt: new Date().toISOString(),
    };
    this.lastDiagnostics = diagnostics;

    const rangeEnd = new Date();
    const rangeStart = addDays(rangeEnd, -(days - 1));
    rangeStart.setHours(0, 0, 0, 0);
    const range: Range = {
      days,
      startDate: rangeStart.toISOString(),
      endDate: rangeEnd.toISOString(),
      latestStartDate: addDays(rangeEnd, -365).toISOString(),
    };

    // 1. 可用性
    try {
      const availability = await Health.isAvailable();
      diagnostics.available = availability.available;
      diagnostics.availabilityReason = availability.reason;
    } catch (error) {
      diagnostics.available = false;
      diagnostics.availabilityReason = errorMessage(error);
    }
    if (!diagnostics.available) {
      throw new Error(diagnostics.availabilityReason ?? '当前设备不支持 HealthKit');
    }

    // 2. 授权（读权限只在首次弹窗，用户拒绝不会抛错而是查不到数据）
    try {
      const authorization = await Health.requestAuthorization({ read: READ_TYPES });
      diagnostics.authorization = {
        status: 'ok',
        readAuthorized: authorization.readAuthorized,
        readDenied: authorization.readDenied,
      };
    } catch (error) {
      diagnostics.authorization = { status: 'error', error: errorMessage(error) };
      diagnostics.notes = [...(diagnostics.notes ?? []), '授权请求失败，后续查询预计全部失败'];
    }

    // 3. 并行读取核心四类 + 全部扩展指标
    const [stepsOutcome, restingOutcome, sleepOutcome, workoutsOutcome, extraReadings] = await Promise.all([
      attempt(() =>
        Health.queryAggregated({ dataType: 'steps', startDate: range.startDate, endDate: range.endDate, bucket: 'day', aggregation: 'sum' }),
      ),
      attempt(() =>
        Health.queryAggregated({
          dataType: 'restingHeartRate',
          startDate: range.startDate,
          endDate: range.endDate,
          bucket: 'day',
          aggregation: 'average',
        }),
      ),
      // 睡眠按"最新优先"拉取：分期睡眠一晚会产生大量阶段样本，样本数超过上限时
      // 丢弃最旧的夜晚而不是最新的，保证看板需要的最近几晚数据完整；展示端再按日期升序归并。
      attempt(() =>
        Health.readSamples({ dataType: 'sleep', startDate: range.startDate, endDate: range.endDate, limit: 2000, ascending: false }),
      ),
      attempt(() => Health.queryWorkouts({ startDate: range.startDate, endDate: range.endDate, limit: 100, ascending: false })),
      Promise.all(EXTRA_METRICS.map((config) => readMetric(Health, config, range))),
    ]);

    readings.push(
      aggregatedReading('steps', '步数', stepsOutcome, days),
      aggregatedReading('restingHeartRate', '静息心率', restingOutcome, days),
      sleepReading(sleepOutcome, days),
      workoutReading(workoutsOutcome, days),
      ...extraReadings,
    );

    // 4. 全部类型都失败（如免费签名缺少 HealthKit entitlement）→ 抛错交给演示数据回退
    if (readings.every((reading) => reading.status === 'error')) {
      const firstError = readings.find((reading) => reading.status === 'error')?.detail;
      diagnostics.notes = [...(diagnostics.notes ?? []), '所有数据类型读取失败，回退演示数据'];
      throw new Error(firstError ?? 'HealthKit 读取全部失败');
    }

    return {
      generatedAt: new Date().toISOString(),
      source: 'healthkit',
      dailySteps: stepsOutcome.ok
        ? stepsOutcome.result.samples.map((sample: { startDate: string; value: number }) => ({
            date: toDateKey(new Date(sample.startDate)),
            steps: Math.round(sample.value),
          }))
        : [],
      restingHeartRate: restingOutcome.ok
        ? restingOutcome.result.samples.map((sample: { startDate: string; value: number }) => ({
            date: toDateKey(new Date(sample.startDate)),
            bpm: Math.round(sample.value),
          }))
        : [],
      sleep: sleepOutcome.ok ? toSleepNights(sleepOutcome.result.samples) : [],
      workouts: workoutsOutcome.ok
        ? workoutsOutcome.result.workouts.map((workout) => ({
            id: workout.platformId ?? `${workout.workoutType}-${workout.startDate}`,
            type: workout.workoutType,
            start: workout.startDate,
            end: workout.endDate,
            durationMinutes: Math.round(workout.duration / 60),
            distanceKm: workout.totalDistance != null ? Math.round(workout.totalDistance / 100) / 10 : undefined,
            energyKcal: workout.totalEnergyBurned != null ? Math.round(workout.totalEnergyBurned) : undefined,
          }))
        : [],
      diagnostics,
    };
  }
}

/**
 * 把 HealthKit 睡眠样本按"醒来日期"归并成每晚的睡眠结构。
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
