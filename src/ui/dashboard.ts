import type { HealthProvider, HealthSnapshot } from '../health';
import { toDateKey } from '../health/date';
import { createHeartRateChart, createSleepChart, createStepsChart } from './charts';
import { formatDateCn, formatDateKeyCn, formatMinutes, formatSteps, formatTime, workoutLabel } from './format';

const STEPS_GOAL = 10_000;

/** 渲染健康看板：加载快照 → 输出页面结构 → 初始化图表与入场动画 */
export async function renderDashboard(root: HTMLElement, provider: HealthProvider): Promise<void> {
  root.innerHTML = loadingView(provider);

  let snapshot: HealthSnapshot;
  try {
    snapshot = await provider.loadSnapshot(30);
  } catch (error) {
    root.innerHTML = errorView(error);
    root.querySelector<HTMLButtonElement>('.retry')?.addEventListener('click', () => window.location.reload());
    return;
  }

  root.innerHTML = dashboardView(snapshot);
  initCharts(snapshot);
  animateHero();
}

/** 加载中的占位视图 */
function loadingView(provider: HealthProvider): string {
  const sourceName = provider.kind === 'mock' ? '本地 Mock 文件' : 'HealthKit';
  return `
    <div class="state" role="status">
      <p class="state-title">正在读取健康数据</p>
      <p class="state-note">数据源:${sourceName}</p>
    </div>`;
}

/** 加载失败视图：说明原因和下一步动作 */
function errorView(error: unknown): string {
  const message = error instanceof Error ? error.message : '未知错误';
  return `
    <div class="state state-error" role="alert">
      <p class="state-title">读取健康数据失败</p>
      <p class="state-note">${escapeHtml(message)}</p>
      <p class="state-note">浏览器预览请确认 public/mock/health-export.json 存在;真机请检查 HealthKit 授权。</p>
      <button class="retry" type="button">重新加载</button>
    </div>`;
}

/** 组装看板页面结构 */
function dashboardView(snapshot: HealthSnapshot): string {
  const todayKey = toDateKey(new Date());
  const latestSteps = snapshot.dailySteps.at(-1);
  const isToday = latestSteps?.date === todayKey;
  const stepsValue = latestSteps?.steps ?? 0;
  const progress = Math.min(1, stepsValue / STEPS_GOAL);
  // 今天还没有步数桶时，如实标注展示的是最近哪一天的数据
  const heroLabel = isToday || !latestSteps ? '今日步数' : `${formatDateKeyCn(latestSteps.date)} 步数`;

  const latestHr = snapshot.restingHeartRate.at(-1);
  const previousHr = snapshot.restingHeartRate.at(-2);
  const hrDelta = latestHr && previousHr ? latestHr.bpm - previousHr.bpm : null;
  const hrNote =
    hrDelta == null
      ? '暂无昨日数据'
      : hrDelta === 0
        ? '与昨日持平'
        : `较昨日 ${hrDelta > 0 ? '+' : ''}${hrDelta} bpm`;

  const lastNight = snapshot.sleep.at(-1);
  const sleepTotal = lastNight
    ? lastNight.deepMinutes + lastNight.coreMinutes + lastNight.remMinutes
    : 0;
  const sleepHours = Math.floor(sleepTotal / 60);
  const sleepMinutes = Math.round(sleepTotal % 60);

  const last7Days = snapshot.dailySteps.slice(-7);
  const stepsAverage =
    last7Days.length > 0
      ? Math.round(last7Days.reduce((sum, item) => sum + item.steps, 0) / last7Days.length)
      : 0;

  return `
    <header class="page-head">
      <div>
        <h1>健康看板</h1>
        <p class="page-date">${formatDateCn(snapshot.generatedAt)}</p>
      </div>
      <span class="source-chip source-chip-${snapshot.source}">
        ${snapshot.source === 'mock' ? 'Mock 数据' : 'HealthKit'}
      </span>
    </header>

    <section class="hero" aria-label="${heroLabel}">
      <div class="ring-wrap">
        <svg class="ring" viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <linearGradient id="ring-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#4c9a71" />
              <stop offset="100%" stop-color="#245c43" />
            </linearGradient>
          </defs>
          <circle class="ring-track" cx="100" cy="100" r="86" />
          <circle class="ring-progress" id="ring-progress" cx="100" cy="100" r="86"
            stroke="url(#ring-gradient)" data-progress="${progress}" />
        </svg>
        <div class="ring-center">
          <span class="ring-value" id="ring-value" data-target="${stepsValue}">0</span>
          <span class="ring-label">${heroLabel}</span>
        </div>
      </div>
      <p class="hero-note">目标 ${formatSteps(STEPS_GOAL)} 步,已完成 ${Math.round(progress * 100)}%</p>
    </section>

    <section class="vitals" aria-label="生命体征">
      <article class="vital">
        <h2>静息心率</h2>
        <p class="vital-value">
          ${
            latestHr
              ? `<span class="vital-number">${latestHr.bpm}</span><span class="vital-unit">bpm</span>`
              : '<span class="vital-number">--</span>'
          }
        </p>
        <p class="vital-note">${latestHr ? hrNote : '暂无数据'}</p>
      </article>
      <article class="vital">
        <h2>昨夜睡眠</h2>
        <p class="vital-value">
          ${
            lastNight
              ? `<span class="vital-number">${sleepHours}</span><span class="vital-unit">小时 ${sleepMinutes} 分</span>`
              : '<span class="vital-number">--</span>'
          }
        </p>
        <p class="vital-note">${lastNight ? `深睡 ${formatMinutes(lastNight.deepMinutes)}` : '暂无数据'}</p>
      </article>
    </section>

    <section class="panel">
      <header class="panel-head">
        <h2>近 7 天步数</h2>
        <span>日均 ${formatSteps(stepsAverage)} 步</span>
      </header>
      <div class="chart-box">
        <canvas id="chart-steps" role="img" aria-label="近 7 天步数柱状图"></canvas>
      </div>
    </section>

    <section class="panel">
      <header class="panel-head">
        <h2>静息心率趋势</h2>
        <span>近 14 天</span>
      </header>
      <div class="chart-box">
        <canvas id="chart-hr" role="img" aria-label="近 14 天静息心率折线图"></canvas>
      </div>
    </section>

    <section class="panel">
      <header class="panel-head">
        <h2>睡眠构成</h2>
        <span>近 7 晚</span>
      </header>
      <div class="chart-box chart-box-tall">
        <canvas id="chart-sleep" role="img" aria-label="近 7 晚睡眠阶段堆叠柱状图"></canvas>
      </div>
    </section>

    <section class="panel">
      <header class="panel-head">
        <h2>最近运动</h2>
      </header>
      ${workoutList(snapshot)}
    </section>

    <footer class="page-foot">
      <p>数据源 ${snapshot.source === 'mock' ? 'Mock 文件' : 'HealthKit'},更新于 ${formatTime(snapshot.generatedAt)}</p>
    </footer>`;
}

/** 最近运动列表 */
function workoutList(snapshot: HealthSnapshot): string {
  if (snapshot.workouts.length === 0) {
    return '<p class="empty-row">最近 30 天还没有运动记录。</p>';
  }

  const items = snapshot.workouts
    .slice(0, 4)
    .map((workout) => {
      const metaParts = [`${formatDateCn(workout.start)} ${formatTime(workout.start)}`];
      if (workout.distanceKm != null) {
        metaParts.push(`${workout.distanceKm.toFixed(1)} 公里`);
      }
      if (workout.energyKcal != null) {
        metaParts.push(`${workout.energyKcal} 千卡`);
      }
      return `
        <li class="workout">
          <span class="workout-dot" aria-hidden="true"></span>
          <div class="workout-main">
            <p class="workout-name">${workoutLabel(workout.type)}</p>
            <p class="workout-meta">${metaParts.join(', ')}</p>
          </div>
          <span class="workout-duration">${workout.durationMinutes} 分钟</span>
        </li>`;
    })
    .join('');

  return `<ul class="workout-list">${items}</ul>`;
}

/** 初始化三张图表（canvas 需先挂载到 DOM） */
function initCharts(snapshot: HealthSnapshot): void {
  const stepsCanvas = document.querySelector<HTMLCanvasElement>('#chart-steps');
  if (stepsCanvas) {
    createStepsChart(stepsCanvas, snapshot.dailySteps);
  }
  const heartRateCanvas = document.querySelector<HTMLCanvasElement>('#chart-hr');
  if (heartRateCanvas) {
    createHeartRateChart(heartRateCanvas, snapshot.restingHeartRate);
  }
  const sleepCanvas = document.querySelector<HTMLCanvasElement>('#chart-sleep');
  if (sleepCanvas) {
    createSleepChart(sleepCanvas, snapshot.sleep);
  }
}

/** 入场动画：步数环从 0 绘制到目标值，数字同步滚动（唯一的一处动效） */
function animateHero(): void {
  const circle = document.querySelector<SVGCircleElement>('#ring-progress');
  const valueElement = document.querySelector<HTMLElement>('#ring-value');
  if (!circle || !valueElement) {
    return;
  }

  const radius = circle.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, Math.max(0, Number(circle.dataset.progress ?? 0)));
  const target = Number(valueElement.dataset.target ?? 0);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  circle.style.strokeDasharray = `${circumference}`;

  if (reducedMotion) {
    circle.style.strokeDashoffset = `${circumference * (1 - progress)}`;
    valueElement.textContent = formatSteps(target);
    return;
  }

  circle.style.strokeDashoffset = `${circumference}`;
  requestAnimationFrame(() => {
    circle.style.strokeDashoffset = `${circumference * (1 - progress)}`;
  });

  const duration = 900;
  const startTime = performance.now();
  const tick = (now: number): void => {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - (1 - t) ** 3;
    valueElement.textContent = formatSteps(Math.round(target * eased));
    if (t < 1) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}

/** 转义 HTML 特殊字符，避免错误信息注入口径 */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[char] ?? char;
  });
}
