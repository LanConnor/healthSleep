import type { HealthDataType, HealthUnit } from '@capgo/capacitor-health';

/**
 * 核心指标（步数/静息心率/睡眠/运动）在看板主区域展示，其余类型统一在"更多指标"网格展示。
 * mode 决定读取方式：sum/average 按天聚合；latest 取最近一条样本；bloodPressure 取最近一条血压样本。
 */
export interface MetricConfig {
  dataType: HealthDataType;
  label: string;
  mode: 'sum' | 'average' | 'latest' | 'bloodPressure';
}

/** 除核心四类之外，额外读取的全部健康数据类型 */
export const EXTRA_METRICS: MetricConfig[] = [
  { dataType: 'distance', label: '步行跑步距离', mode: 'sum' },
  { dataType: 'distanceCycling', label: '骑行距离', mode: 'sum' },
  { dataType: 'flightsClimbed', label: '爬楼层数', mode: 'sum' },
  { dataType: 'exerciseTime', label: '锻炼时间', mode: 'sum' },
  { dataType: 'calories', label: '活动能量', mode: 'sum' },
  { dataType: 'basalCalories', label: '基础能量', mode: 'sum' },
  { dataType: 'totalCalories', label: '总消耗能量', mode: 'sum' },
  { dataType: 'heartRate', label: '心率', mode: 'average' },
  { dataType: 'heartRateVariability', label: '心率变异性', mode: 'average' },
  { dataType: 'respiratoryRate', label: '呼吸频率', mode: 'average' },
  { dataType: 'oxygenSaturation', label: '血氧', mode: 'average' },
  { dataType: 'vo2Max', label: '最大摄氧量', mode: 'average' },
  { dataType: 'weight', label: '体重', mode: 'latest' },
  { dataType: 'height', label: '身高', mode: 'latest' },
  { dataType: 'bodyFat', label: '体脂率', mode: 'latest' },
  { dataType: 'bloodGlucose', label: '血糖', mode: 'latest' },
  { dataType: 'bloodPressure', label: '血压', mode: 'bloodPressure' },
  { dataType: 'bodyTemperature', label: '体温', mode: 'latest' },
  { dataType: 'basalBodyTemperature', label: '基础体温', mode: 'latest' },
  { dataType: 'appleSleepingWristTemperature', label: '睡眠手腕温度', mode: 'latest' },
  { dataType: 'mindfulness', label: '正念时间', mode: 'sum' },
  { dataType: 'appleStandHour', label: '站立小时', mode: 'sum' },
  { dataType: 'dietaryWater', label: '饮水', mode: 'sum' },
  { dataType: 'dietaryEnergyConsumed', label: '摄入能量', mode: 'sum' },
];

/** 把插件返回的数值+单位格式化成展示文本 */
export function formatMetricValue(value: number, unit: HealthUnit | string): string {
  const round1 = (input: number): number => Math.round(input * 10) / 10;
  switch (unit) {
    case 'count':
      return Math.round(value).toLocaleString('zh-CN');
    case 'meter':
      return value >= 1000 ? `${round1(value / 1000)} km` : `${Math.round(value)} m`;
    case 'kilocalorie':
      return `${Math.round(value).toLocaleString('zh-CN')} kcal`;
    case 'bpm':
      return `${Math.round(value)} bpm`;
    case 'kilogram':
      return `${round1(value)} kg`;
    case 'minute':
      return `${Math.round(value)} min`;
    case 'percent':
      return `${round1(value)}%`;
    case 'millisecond':
      return `${Math.round(value)} ms`;
    case 'celsius':
      return `${round1(value)} °C`;
    case 'centimeter':
      return `${round1(value)} cm`;
    case 'liter':
      return `${round1(value)} L`;
    case 'mmHg':
      return `${Math.round(value)} mmHg`;
    case 'mg/dL':
      return `${round1(value)} mg/dL`;
    case 'mL/min/kg':
      return `${round1(value)} mL/min/kg`;
    default:
      return `${round1(value)} ${unit}`;
  }
}
