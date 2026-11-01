import type { HealthProvider, HealthSnapshot } from './types';
import { MockHealthProvider } from './mock-provider';

/**
 * 演示数据源：把内置 Mock JSON 当作快照，并把来源标记为 demo。
 * 两种用法：
 * - 传入 primary（真机）：先走 HealthKit，失败（如免费签名缺少 HealthKit 能力）时回退到演示数据；
 * - 不传 primary：构建期强制演示模式（VITE_FORCE_DEMO=1），完全不调用 HealthKit。
 */
export class DemoHealthProvider implements HealthProvider {
  readonly kind = 'demo' as const;
  private readonly demo = new MockHealthProvider();

  constructor(private readonly primary?: HealthProvider) {}

  async loadSnapshot(days: number): Promise<HealthSnapshot> {
    if (this.primary) {
      try {
        return await this.primary.loadSnapshot(days);
      } catch (error) {
        return this.demoSnapshot(days, error instanceof Error ? error.message : String(error));
      }
    }
    return this.demoSnapshot(days, '构建时启用了演示模式（VITE_FORCE_DEMO=1）');
  }

  private async demoSnapshot(days: number, reason: string): Promise<HealthSnapshot> {
    const snapshot = await this.demo.loadSnapshot(days);
    return { ...snapshot, source: 'demo', demoReason: reason };
  }
}
