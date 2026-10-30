import { Chart } from 'chart.js/auto';
import type { DailySteps, RestingHeartRateDay, SleepNight } from '../health';
import { formatShortDate } from './format';

const MUTED = '#6b746c';
const STEPS_GREEN = '#2e6b4f';
const HEART_RED = '#d6493d';
const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif';

Chart.defaults.font.family = FONT_STACK;
Chart.defaults.font.size = 11;
Chart.defaults.color = MUTED;

/** 尊重系统的“减弱动态效果”设置 */
function animationSpec(): false | { duration: number } {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 500 };
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** 近 7 天步数柱状图：今天用实色，其余用淡色 */
export function createStepsChart(canvas: HTMLCanvasElement, days: DailySteps[]): Chart {
  const recent = days.slice(-7);
  const lastIndex = recent.length - 1;

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: recent.map((item) => formatShortDate(item.date)),
      datasets: [
        {
          data: recent.map((item) => item.steps),
          backgroundColor: recent.map((_, index) =>
            index === lastIndex ? STEPS_GREEN : 'rgba(46, 107, 79, 0.24)',
          ),
          borderRadius: 6,
          borderSkipped: false,
          categoryPercentage: 0.62,
          barPercentage: 0.9,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: animationSpec(),
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => `${Number(item.formattedValue).toLocaleString('zh-CN')} 步`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false } },
        y: { display: false, beginAtZero: true },
      },
    },
  });
}

/** 近 14 天静息心率折线图 */
export function createHeartRateChart(canvas: HTMLCanvasElement, days: RestingHeartRateDay[]): Chart {
  const recent = days.slice(-14);
  const values = recent.map((item) => item.bpm);
  const min = values.length > 0 ? Math.min(...values) : 50;
  const max = values.length > 0 ? Math.max(...values) : 100;

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: recent.map((item) => formatShortDate(item.date)),
      datasets: [
        {
          data: values,
          borderColor: HEART_RED,
          backgroundColor: 'rgba(214, 73, 61, 0.08)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 16,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: HEART_RED,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: animationSpec(),
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (item) => `${item.formattedValue} bpm` } },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { maxTicksLimit: 5, maxRotation: 0 },
        },
        y: { display: false, suggestedMin: min - 4, suggestedMax: max + 4 },
      },
    },
  });
}

/** 近 7 晚睡眠阶段堆叠柱状图（单位：小时） */
export function createSleepChart(canvas: HTMLCanvasElement, nights: SleepNight[]): Chart {
  const recent = nights.slice(-7);
  const stageDataset = (label: string, color: string, pick: (night: SleepNight) => number) => ({
    label,
    data: recent.map((night) => roundTo(pick(night) / 60, 2)),
    backgroundColor: color,
    borderRadius: 2,
    borderSkipped: false,
    categoryPercentage: 0.62,
    barPercentage: 0.9,
  });

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: recent.map((night) => formatShortDate(night.night)),
      datasets: [
        stageDataset('深睡', '#345066', (night) => night.deepMinutes),
        stageDataset('核心', '#7aa0bc', (night) => night.coreMinutes),
        stageDataset('REM', '#b7ccdd', (night) => night.remMinutes),
        stageDataset('清醒', '#d9a441', (night) => night.awakeMinutes),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: animationSpec(),
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', padding: 14 },
        },
        tooltip: { callbacks: { label: (item) => `${item.dataset.label} ${item.formattedValue} 小时` } },
      },
      scales: {
        x: { stacked: true, grid: { display: false }, border: { display: false } },
        y: { stacked: true, display: false, beginAtZero: true },
      },
    },
  });
}
