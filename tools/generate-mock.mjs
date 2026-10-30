// 生成浏览器预览用的 Mock 健康数据（最近 30 天）。
// 用法：npm run mock:generate
// 输出：public/mock/health-export.json，结构与 src/health/types.ts 中的 HealthSnapshot 字段一致。
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DAYS = 30;
const OUT_FILE = resolve(dirname(fileURLToPath(import.meta.url)), '../public/mock/health-export.json');

/** 固定种子的伪随机数，保证每次生成的数据一致 */
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20261029);

function randInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function addDays(base, delta) {
  const date = new Date(base);
  date.setDate(date.getDate() + delta);
  return date;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const today = new Date();
today.setHours(0, 0, 0, 0);
const days = Array.from({ length: DAYS }, (_, index) => addDays(today, index - (DAYS - 1)));

// 1. 运动安排：最近 30 天里的几次训练
const workoutPlans = [
  { daysAgo: 1, type: 'running', startHour: 7, startMinute: 40, minutes: 32, distanceKm: 5.4, energyKcal: 356 },
  { daysAgo: 3, type: 'strengthTraining', startHour: 19, startMinute: 10, minutes: 45, energyKcal: 302 },
  { daysAgo: 6, type: 'cycling', startHour: 9, startMinute: 20, minutes: 58, distanceKm: 18.6, energyKcal: 468 },
  { daysAgo: 9, type: 'running', startHour: 7, startMinute: 25, minutes: 41, distanceKm: 7.2, energyKcal: 452 },
  { daysAgo: 13, type: 'hiking', startHour: 10, startMinute: 5, minutes: 132, distanceKm: 9.8, energyKcal: 780 },
  { daysAgo: 17, type: 'strengthTraining', startHour: 18, startMinute: 40, minutes: 38, energyKcal: 246 },
  { daysAgo: 21, type: 'walking', startHour: 20, startMinute: 0, minutes: 47, distanceKm: 3.9, energyKcal: 178 },
];

const workoutDayKeys = new Set(workoutPlans.map((plan) => toDateKey(addDays(today, -plan.daysAgo))));

// 2. 每日步数：工作日/周末/训练日有差异；今天按当前时刻折算
const nowHour = new Date().getHours();
const dailySteps = days.map((date) => {
  const weekday = date.getDay();
  const isWeekend = weekday === 0 || weekday === 6;
  let steps = 7800 + randInt(-2200, 2800);
  if (isWeekend) {
    steps += randInt(800, 2600);
  }
  if (workoutDayKeys.has(toDateKey(date))) {
    steps += randInt(1200, 3200);
  }
  if (toDateKey(date) === toDateKey(today) && nowHour < 20) {
    steps = Math.round(steps * Math.max(0.15, Math.min(1, (nowHour - 6) / 14)));
  }
  return { date: toDateKey(date), steps: Math.max(1200, steps) };
});

// 3. 每日静息心率
const restingHeartRate = days.map((date) => ({
  date: toDateKey(date),
  bpm: 58 + randInt(-2, 4),
}));

// 4. 每晚睡眠：约 6.5~8.5 小时，带阶段分布；偶尔缺一晚
const sleep = [];
days.forEach((date, index) => {
  if (index % 11 === 4) {
    return;
  }
  const totalMinutes = randInt(385, 500);
  const wake = new Date(date);
  wake.setHours(0, randInt(6 * 60 + 35, 7 * 60 + 50), 0, 0);
  const start = new Date(wake.getTime() - totalMinutes * 60_000);

  const deep = Math.round(totalMinutes * (0.17 + random() * 0.06));
  const rem = Math.round(totalMinutes * (0.19 + random() * 0.05));
  const awake = Math.round(totalMinutes * (0.02 + random() * 0.03));
  const core = totalMinutes - deep - rem - awake;

  sleep.push({
    night: toDateKey(date),
    start: start.toISOString(),
    end: wake.toISOString(),
    deepMinutes: deep,
    coreMinutes: core,
    remMinutes: rem,
    awakeMinutes: awake,
  });
});

// 5. 运动明细（按开始时间倒序）
const workouts = workoutPlans
  .map((plan, index) => {
    const day = addDays(today, -plan.daysAgo);
    const start = new Date(day);
    start.setHours(plan.startHour, plan.startMinute, 0, 0);
    const end = new Date(start.getTime() + plan.minutes * 60_000);
    return {
      id: `mock-workout-${index + 1}`,
      type: plan.type,
      start: start.toISOString(),
      end: end.toISOString(),
      durationMinutes: plan.minutes,
      distanceKm: plan.distanceKm,
      energyKcal: plan.energyKcal,
    };
  })
  .sort((a, b) => b.start.localeCompare(a.start));

const payload = {
  generatedAt: new Date().toISOString(),
  dailySteps,
  restingHeartRate,
  sleep,
  workouts,
};

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(
  `已生成 ${OUT_FILE}（${dailySteps.length} 天步数与心率、${sleep.length} 晚睡眠、${workouts.length} 次运动）`,
);
