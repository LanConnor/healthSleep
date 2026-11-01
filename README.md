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
├── .github/workflows/ios-unsigned-ipa.yml # GitHub Actions：构建未签名 IPA
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
├── ios/                           # Capacitor 生成的 Xcode 工程（CI 或 Mac 编译）
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

前置条件：Mac + Xcode、iPhone 真机、**付费** Apple 开发者账号（¥688/年）。
HealthKit capability 只对付费账号开放：免费个人 Team 在 Xcode 里勾选 HealthKit 会直接报错
（"Personal development teams do not support the HealthKit capability"），后台数据投递等能力同样如此。
没有 Mac 时可以先走《无 Mac 打包 IPA》一节，用免费账号验证安装与界面，但读不到健康数据。

1. Windows 上提交代码：`npm run build` 后 `git push`；
2. Mac 上：`npm ci && npm run ios:sync`（等价于 `npm run build && npx cap sync ios`）；
3. `npx cap open ios` 打开 Xcode；
4. Xcode → targets → **Signing & Capabilities**：选择你的 Team，点 **+ Capability** 添加 **HealthKit**；
5. 连接 iPhone 运行（首次需要：iPhone 开启开发者模式、信任开发者证书）。

已预先完成的配置：

- `ios/App/App/Info.plist` 已写入 `NSHealthShareUsageDescription`（健康数据读取说明文案）；
- 桌面显示名已设为「健康看板」；
- `@capgo/capacitor-health` 已通过 Swift Package Manager 写入 Xcode 工程（Capacitor 8 默认 SPM，无需 CocoaPods）；
- `ios/App/App/App.entitlements` 已声明 HealthKit entitlement，Xcode 工程已登记 HealthKit capability（付费账号签名时生效）；
- 已提供共享 scheme `ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme`，CI 可直接 `xcodebuild -scheme App`；
- `.github/workflows/ios-unsigned-ipa.yml`：在 GitHub 的 macOS runner 上构建未签名 IPA（见下节）。

HealthKit 注意事项：

- **模拟器读不到健康数据，必须真机测试**；
- iOS 不会回传精确的“读授权”状态，业务上以“查不到数据”兜底；
- 授权弹窗只出现一次，想重复测试授权流程：删除 App 重装，或在 设置 → 健康 → 数据访问与设备 里撤销；
- App Store 提交时健康类 App 需要隐私政策，健康数据不得写入 iCloud。

### 可选：真机热更新（局域网）

`capacitor.config.ts` 里取消 `server` 注释，把 `url` 换成 Windows 电脑的局域网地址
（手机和电脑需在同一 WiFi），`npm run dev` 保持运行。App 在 Mac 上编译安装一次后，
Web 层的改动会直接在手机里热更新，**只有原生代码/插件改动才需要回 Mac 重新编译**。

## 无 Mac 打包 IPA（GitHub Actions + 爱思助手签名）

工程已内置 `.github/workflows/ios-unsigned-ipa.yml`：由 GitHub 的 macOS runner 编译出
**未签名 IPA**，Windows 下载后用爱思助手重签安装，全程不需要 Mac。

### 在 GitHub 上构建

1. 提交并推送代码（workflow 需要在默认分支上才能手动触发）：

   ```bash
   git add -A && git commit -m "ci: 构建未签名 IPA" && git push
   ```

2. 触发构建，两种方式任选：
   - GitHub 仓库页 → **Actions** → **Build unsigned iOS IPA** → **Run workflow**
     （勾选 **demo** 输入框则构建演示版，见下）；
   - 或打 tag：`git tag v0.1.0 && git push origin v0.1.0`（tag 构建不是演示版）。
3. 构建约 5–10 分钟。完成后在该次运行页面底部下载 artifact，解压得到 `.ipa`
   （同包内附 SHA-256 校验值）：
   - 普通版：`healthSleep-unsigned-ipa.zip` → `healthSleep-unsigned.ipa`（走 HealthKit）；
   - 演示版：`healthSleep-unsigned-ipa-demo.zip` → `healthSleep-unsigned-demo.ipa`
     （完全不调用 HealthKit，强制使用内置演示数据，适合免费签名验证界面）。

> 演示数据来自 `public/mock/health-export.json`，CI 构建前会自动执行 `mock:generate`
> 把它滚动到当天，装到手机上不会过期。想在浏览器里预览演示横幅：
> `VITE_FORCE_DEMO=1 npm run dev`（Git Bash / macOS 写法）。

> 私有仓库注意：macOS runner 按 10 倍计费，免费额度 2000 分钟/月约合 200 分钟 macOS 构建；
> 公开仓库不限时长。

### 用爱思助手签名安装（Windows）

1. 爱思助手 → 工具箱 → **IPA 签名** → 添加 `healthSleep-unsigned.ipa`；
2. 登录你的 Apple ID（免费个人账号，需要能收验证码）；
3. 开始签名，完成后安装到已连接的 iPhone；
4. 首次运行前，在 iPhone 上信任证书：设置 → 通用 → VPN 与设备管理。
   若 7 天后 App 打不开，重新签名安装即可。

### 免费签名的边界（重要）

- **免费 Apple ID 签不出 HealthKit 能力**——苹果只对付费开发者开放该 capability，
  这不是"基础数据 vs 全部数据"的区别，读步数同样需要它。免费签名装上的普通构建
  会进入错误页（普通构建运行期 HealthKit 抛错时会自动回退演示数据并标注来源）；
  想稳定看到完整界面，请直接构建**演示版**。免费签名 7 天过期，重签即可。
- App ID、证书数量按周有配额，频繁重签可能被限流。
- 安装后页面底部的「更多健康指标」会列出全部 28 类数据的读取结果，「数据读取诊断」
  文本框逐项标注成功/无数据/错误原因，点"复制诊断信息"即可发回排查。
- **要真机验证 HealthKit 读取，必须用付费 Apple Developer 账号**：
  - 方式一：付费账号的证书 + 描述文件（App ID 勾选 HealthKit）导入爱思助手签名；
  - 方式二：把证书/描述文件存成 GitHub Secrets，改造成带签名工作流，直接产出可安装
    IPA 或上传 TestFlight（需要时可在现有 workflow 基础上扩展）。

## 下一步建议

- `appId` 已设为 `com.lanconnor.healthdashboard`（全局唯一，免费签名创建 App ID 时需要）；对外发布前可按自己的域名调整；
- 真机联调 `native-provider.ts` 的睡眠归并和聚合口径；
- 需要插件未覆盖的数据类型（如血氧、HRV）时，在 `ios/` 工程里补一个 Swift Capacitor 插件即可。
