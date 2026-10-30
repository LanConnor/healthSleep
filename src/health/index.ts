import { Capacitor } from '@capacitor/core';
import { MockHealthProvider } from './mock-provider';
import { HealthKitProvider } from './native-provider';
import type { HealthProvider } from './types';

/**
 * 数据源工厂：浏览器环境走 Mock；iOS/Android 真机走原生 HealthKit 适配层。
 * 页面代码只依赖 healthProvider，不感知平台差异。
 */
export const healthProvider: HealthProvider = Capacitor.isNativePlatform()
  ? new HealthKitProvider()
  : new MockHealthProvider();

export type { HealthProvider, HealthSnapshot, DailySteps, RestingHeartRateDay, SleepNight, Workout } from './types';
