import type { HealthDiagnostics, HealthProvider, HealthSnapshot } from './types';
import { MockHealthProvider } from './mock-provider';

/**
 * 演示数据源：把内置 Mock JSON 当作快照，并把来源标记为 demo。
 * 两种用法：
 * - 传入 primary（真机）：先走 HealthKit，失败（如免费签名缺少 HealthKit 能力）时回退到演示数据；
 * - 不传 primary：构建期强制演示模式（VITE_FORCE_DEMO=1），完全不调用 HealthKit。
 * 回退时会保留 HealthKit 的读取诊断，方便在页面底部查看每种数据类型的失败原因。
 */
export class DemoHealthProvider implements HealthProvider {
  readonly kind = 'demo' as const;
  private readonly demo = new MockHealthProvider();
  private lastDiagnostics?: HealthDiagnostics;

  constructor(private readonly primary?: HealthProvider) {}

  getDiagnostics(): HealthDiagnostics | undefined {
    return this.lastDiagnostics;
  }

  async loadSnapshot(days: number): Promise<HealthSnapshot> {
    if (this.primary) {
      try {
        const snapshot = await this.primary.loadSnapshot(days);
        this.lastDiagnostics = snapshot.diagnostics;
        return snapshot;
      } catch (error) {
        return this.demoSnapshot(days, error instanceof Error ? error.message : String(error));
      }
    }
    return this.demoSnapshot(days, '构建时启用了演示模式（VITE_FORCE_DEMO=1）');
  }

  private async demoSnapshot(days: number, reason: string): Promise<HealthSnapshot> {
    const snapshot = await this.demo.loadSnapshot(days);
    const base = this.primary?.getDiagnostics?.() ?? snapshot.diagnostics;
    const diagnostics: HealthDiagnostics | undefined = base
      ? {
          ...base,
          provider: 'demo',
          notes: [...(base.notes ?? []), reason, '已回退演示数据'],
        }
      : undefined;
    this.lastDiagnostics = diagnostics;
    return { ...snapshot, source: 'demo', demoReason: reason, diagnostics };
  }
}
