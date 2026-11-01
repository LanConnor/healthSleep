import { Capacitor } from '@capacitor/core';
import { DemoHealthProvider } from './demo-provider';
import { MockHealthProvider } from './mock-provider';
import { HealthKitProvider } from './native-provider';
import type { HealthProvider } from './types';

/**
 * 数据源工厂：浏览器环境走 Mock；iOS 真机走原生 HealthKit 适配层，
 * HealthKit 抛错时回退到演示数据（界面会明确标注）。
 * VITE_FORCE_DEMO=1 时跳过 HealthKit，直接使用演示数据（CI 演示构建）。
 * 页面代码只依赖 healthProvider，不感知平台差异。
 */
export const healthProvider: HealthProvider =
  import.meta.env.VITE_FORCE_DEMO === '1'
    ? new DemoHealthProvider()
    : Capacitor.isNativePlatform()
      ? new DemoHealthProvider(new HealthKitProvider())
      : new MockHealthProvider();

export type { HealthProvider, HealthSnapshot, DailySteps, RestingHeartRateDay, SleepNight, Workout } from './types';
