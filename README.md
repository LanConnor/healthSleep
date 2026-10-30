# 健康看板（iOS 健康数据脚手架）

用 Web 技术开发 iOS App 的起步工程：**Vite + TypeScript + Capacitor 8 + Chart.js**，
读取苹果健康数据用 **[@capgo/capacitor-health](https://github.com/Cap-go/capacitor-health)**（HealthKit）。

设计思路：浏览器里用本地 Mock 数据开发全部界面；真机运行时同一份代码自动切换到 HealthKit。
页面只依赖 `HealthProvider` 接口，不感知数据来源。

## 环境要求

- Node.js ≥ 22（本工程在 **Node 24.14.0** 下验证通过，推荐 24 LTS）
- npm 11+
- 编辑器：WebStorm；浏览器：Chrome（手机模式）

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 http://localhost:5173 ，在 Chrome DevTools 里切换手机模式查看。
页面数据来自 `public/mock/health-export.json`，右上角会显示「Mock 数据」标识。

## 常用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器（浏览器预览，Mock 数据） |
| `npm run build` | 类型检查 + 生产构建，输出到 `dist/` |
| `npm run mock:generate` | 重新生成最近 30 天的 Mock 数据（日期滚动到当天） |
| `npm run ios:sync` | 构建并把 Web 产物、插件同步进 `ios/` 工程 |

## 目录结构

```
appleWorkspace
├── capacitor.config.ts            # Capacitor 配置（含局域网热更新示例，默认注释）
├── index.html
├── public/mock/health-export.json # 浏览器预览用的 Mock 数据（30 天）
├── src
│   ├── main.ts                    # 入口
│   ├── style.css                  # 全局样式（移动端优先，适配安全区）
│   ├── health
│   │   ├── index.ts               # 数据源工厂：web → Mock，原生 → HealthKit
│   │   ├── types.ts               # 统一领域模型 + HealthProvider 接口
│   │   ├── mock-provider.ts       # 读取 public/mock/health-export.json
│   │   ├── native-provider.ts     # HealthKit 适配层（插件 API → 统一模型）
│   │   └── date.ts                # 本地日期工具
│   └── ui
│       ├── dashboard.ts           # 看板页面结构与步数环入场动画
│       ├── charts.ts              # Chart.js 图表（步数 / 静息心率 / 睡眠）
│       └── format.ts              # 展示层格式化
├── tools/generate-mock.mjs        # Mock 数据生成脚本
├── ios/                           # Capacitor 生成的 Xcode 工程（需在 Mac 上编译）
└── dist/                          # 构建产物
```

## 数据源切换原理

`src/health/index.ts` 按平台选择实现：

```ts
export const healthProvider: HealthProvider = Capacitor.isNativePlatform()
  ? new HealthKitProvider()   // 真机：HealthKit
  : new MockHealthProvider(); // 浏览器：Mock JSON
```

- 页面（`src/ui/`）只调用 `healthProvider.loadSnapshot(days)`。
- 真机读取逻辑全部集中在 `src/health/native-provider.ts`：授权 → 聚合查询步数/静息心率 →
  读取睡眠样本 → 查询运动，再归一成 `src/health/types.ts` 里的统一模型。
- 真机联调时如果样本归并口径与实际数据不符（尤其睡眠分期），只改 `native-provider.ts`。

## Mock 数据说明

- `public/mock/health-export.json` 由 `npm run mock:generate` 生成，日期基于生成当天，
  固定随机种子保证结果稳定。**隔几天再看页面时先重新执行一次该脚本**，否则“今日”数据会停在旧日期。
- 要换成真实数据：把导出的健康数据按 `src/health/types.ts` 的结构整理成同一个 JSON 即可
  （注意脱敏，健康数据敏感，不要随意外传或提交到公开仓库）。

## iOS 真机（需要一台 Mac）

前置条件：Mac + Xcode、iPhone 真机、基本需要 ¥688/年的付费 Apple 开发者账号
（HealthKit 能力在免费个人 Team 下经常签不出来，后台数据投递等能力明确要求付费账号）。

1. Windows 上提交代码：`npm run build` 后 `git push`；
2. Mac 上：`npm ci && npm run ios:sync`（等价于 `npm run build && npx cap sync ios`）；
3. `npx cap open ios` 打开 Xcode；
4. Xcode → targets → **Signing & Capabilities**：选择你的 Team，点 **+ Capability** 添加 **HealthKit**；
5. 连接 iPhone 运行（首次需要：iPhone 开启开发者模式、信任开发者证书）。

已预先完成的配置：

- `ios/App/App/Info.plist` 已写入 `NSHealthShareUsageDescription`（健康数据读取说明文案）；
- 桌面显示名已设为「健康看板」；
- `@capgo/capacitor-health` 已通过 Swift Package Manager 写入 Xcode 工程（Capacitor 8 默认 SPM，无需 CocoaPods）。

HealthKit 注意事项：

- **模拟器读不到健康数据，必须真机测试**；
- iOS 不会回传精确的“读授权”状态，业务上以“查不到数据”兜底；
- 授权弹窗只出现一次，想重复测试授权流程：删除 App 重装，或在 设置 → 健康 → 数据访问与设备 里撤销；
- App Store 提交时健康类 App 需要隐私政策，健康数据不得写入 iCloud。

### 可选：真机热更新（局域网）

`capacitor.config.ts` 里取消 `server` 注释，把 `url` 换成 Windows 电脑的局域网地址
（手机和电脑需在同一 WiFi），`npm run dev` 保持运行。App 在 Mac 上编译安装一次后，
Web 层的改动会直接在手机里热更新，**只有原生代码/插件改动才需要回 Mac 重新编译**。

## 下一步建议

- 真机签名前把 `capacitor.config.ts` 的 `appId`（当前 `com.example.healthdashboard`）改成自己的 Bundle ID；
- 真机联调 `native-provider.ts` 的睡眠归并和聚合口径；
- 需要插件未覆盖的数据类型（如血氧、HRV）时，在 `ios/` 工程里补一个 Swift Capacitor 插件即可。
