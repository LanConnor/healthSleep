# iOS 打包与真机验证记录（交接文档）

> 更新时间：2026-11-01
> 仓库：https://github.com/LanConnor/healthSleep （公开仓库）
> 本文档记录本项目从「Windows 开发」到「GitHub Actions 打包 IPA → 爱思助手签名 → iPhone 真机验证」的完整经过，
> 供后续对话与协作者快速接手，避免重复踩坑。

## 1. 项目速览

- 技术栈：Vite 8 + TypeScript + Chart.js，Capacitor 8（SPM，无 CocoaPods），HealthKit 读取使用 `@capgo/capacitor-health`。
- Bundle ID：`com.lanconnor.healthdashboard`（原 `com.example.healthdashboard`；改为全局唯一 ID，免费签名创建 App ID 时需要）。
- 数据源设计：浏览器走 Mock 数据（`public/mock/health-export.json`）；真机走 HealthKit；
  HealthKit 读取失败自动回退演示数据，界面显著标注「演示数据」。
- 开发环境：Windows 11，没有 Mac；iOS 编译全部在 GitHub Actions 的 macOS runner 上完成。

## 2. 关键提交时间线

| 提交 | 内容 |
| --- | --- |
| `868aa89` | 初始化健康看板项目（Vite + Capacitor iOS 脚手架） |
| `0cea904` | 修复睡眠样本截断与今日步数桶标注 |
| `97e2039` | 增加 GitHub Actions 未签名 IPA 工作流；补齐 HealthKit entitlement 与共享 scheme；Bundle ID 改为 com.lanconnor.healthdashboard；HealthKit 抛错回退演示数据；package-lock 下载源从私有源改回公共 npm registry |
| `e057c13` | 全量读取插件支持的 28 类健康/运动数据；新增「更多健康指标」网格与可复制的「数据读取诊断」文本框 |
| `75b2f06` | 修正 iOS 端不支持聚合查询的 11 类数据，改用 readSamples（见 6.3） |
| 本文档 | docs/ios-build-notes.md + CLAUDE.md |

## 3. GitHub Actions 打包（无 Mac）

工作流文件：`.github/workflows/ios-unsigned-ipa.yml`

- Runner：`macos-15`；构建前自动选择 runner 上已安装的最新 Xcode。
- 触发方式：
  - 手动：仓库 Actions → **Build unsigned iOS IPA** → Run workflow；
  - 打 tag：`git tag v0.1.0 && git push origin v0.1.0`（tag 构建不是演示版）。
  - 注意：普通 push 提交不会自动触发构建。
- 手动触发的输入项：`demo`（布尔）。勾选则构建**演示版**（等价于 `VITE_FORCE_DEMO=1`，完全不调用 HealthKit）。
- 步骤：checkout → setup-node 24 → `npm ci` → `npm run mock:generate`（把演示数据滚动到当天）→
  `npm run build` → `npx cap sync ios` → 选最新 Xcode → `xcodebuild archive`（`CODE_SIGNING_ALLOWED=NO` 未签名）→
  打包 `Payload/App.app` 为 IPA（附 SHA-256）→ 上传 artifact（保留 30 天）。
- 产物命名：
  - 普通版：`healthSleep-unsigned-ipa.zip` → `healthSleep-unsigned.ipa`；
  - 演示版：`healthSleep-unsigned-ipa-demo.zip` → `healthSleep-unsigned-demo.ipa`。
- 下载 artifact 必须登录 GitHub（任意账号，仓库公开）；未登录 API 下载返回 401。
- 计费：公开仓库的 macOS runner 免费不限时；私有仓库 macOS 按 10 倍扣额度（2000 分钟/月约合 200 分钟 macOS）。

## 4. 签名与安装（免费账号 + 爱思助手）

1. 下载 artifact 解压得到 `.ipa`；
2. 爱思助手 → 工具箱 → **IPA 签名** → 添加 IPA → 登录 Apple ID（免费个人账号即可，需能收验证码）→ 开始签名 → 安装；
3. 首次运行前在 iPhone：设置 → 通用 → VPN 与设备管理 → 信任对应开发者证书；
4. 免费签名有效期约 7 天，过期重签即可；App ID/证书数量按周有配额。

**实测结论（重要）**：免费 Apple ID 的签名不包含 HealthKit capability
（iOS 只对付费 Apple Developer Program 会员开放，报错 `Missing com.apple.developer.healthkit entitlement.`）。
免费签名装上的 App 能启动、能看界面，但读不到任何真实健康数据，会回退演示数据。
**不存在任何免费方案可以读 HealthKit**，不要再尝试。

## 5. GitHub 推送配置（Windows 机器）

- 仓库远程使用 SSH 别名：`origin = git@github-lanconnor:LanConnor/healthSleep.git`。
- `~/.ssh/config` 中 `github-lanconnor` 指向专用密钥 `~/.ssh/id_ed25519_lanconnor`
  （本机默认密钥属于另一个账号 chengfeng110，对 LanConnor/healthSleep 没有写权限）。
- 该专用密钥的公钥已添加到 GitHub（账号 SSH key 或仓库 deploy key，均可使 push 生效）。
- 直接 `git push origin master` 即可；提交信息结尾按约定加
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。

## 6. 数据读取实现（src/health/）

### 6.1 数据源链

| 文件 | 职责 |
| --- | --- |
| `index.ts` | 工厂：`VITE_FORCE_DEMO=1` → 强制演示；原生平台 → `DemoHealthProvider(HealthKitProvider)`；浏览器 → `MockHealthProvider` |
| `native-provider.ts` | HealthKit 全量读取：申请全部 28 类读权限 → 并行读取核心四类与全部扩展指标 → 单项失败只记录诊断，全部失败才抛错 |
| `demo-provider.ts` | 捕获 HealthKit 错误后回退 Mock 数据，保留 HealthKit 诊断并标注回退原因 |
| `mock-provider.ts` | 浏览器/Mock 数据源，同时生成 mock 诊断 |
| `metrics.ts` | 扩展指标配置（EXTRA_METRICS）与单位格式化 |
| `types.ts` | 领域模型：HealthSnapshot、MetricReading、HealthDiagnostics 等 |

回退规则：

- 单项读取失败 → 记录到诊断，其他类型继续；
- 全部类型都 error（如免费签名缺少 entitlement）→ 抛错，`DemoHealthProvider` 回退演示数据，诊断随快照展示；
- 授权被用户拒绝但不抛错 → 查询返回空数组，展示真实但为空的看板（不回退演示数据）。

### 6.2 读取的数据类型（共 28 类）

核心四类（看板主区域）：steps、restingHeartRate、sleep、workouts。

扩展指标（「更多健康指标」网格）：distance、distanceCycling、flightsClimbed、exerciseTime、calories、
basalCalories、totalCalories、heartRate、heartRateVariability、respiratoryRate、oxygenSaturation、vo2Max、
weight、height、bodyFat、bloodGlucose、bloodPressure、bodyTemperature、basalBodyTemperature、
appleSleepingWristTemperature、mindfulness、appleStandHour、dietaryWater、dietaryEnergyConsumed。

读取方式（`metrics.ts` 中 `mode`）：

- `sum` / `average`：`queryAggregated` 按天聚合，展示最近一天；
- `latest` / `bloodPressure`：`readSamples` 取最近一条样本（时间窗为近一年，覆盖体重/身高这类低频数据）。

### 6.3 iOS 端聚合查询限制（已踩坑）

真机诊断显示插件在 iOS 端只对部分类型支持 `queryAggregated`。以下 11 类**必须用 readSamples**，
否则会报 `Aggregated queries are not supported for xxx. Use readSamples instead.`（`75b2f06` 已修正）：

- distanceCycling、flightsClimbed、exerciseTime、basalCalories、totalCalories、
  heartRateVariability、respiratoryRate、oxygenSaturation、vo2Max；
- mindfulness、appleStandHour（分类类型，报 `not a quantity type`）。

### 6.4 诊断面板（页面底部）

- 「更多健康指标」：两列网格，展示全部扩展指标的最近值（读取失败显示红色"读取失败"）；
- 「数据读取诊断」：只读文本框，逐行输出每类数据的读取结果
  （✓ 成功 / ○ 无数据 / ✕ 错误及原因）、授权状态、HealthKit 可用性、回退原因与备注；
- 「复制诊断信息」按钮：优先写剪贴板；失败则自动全选文本供长按复制（`bindDiagnostics` in `src/ui/dashboard.ts`）；
- iOS 不返回精确的读授权状态（`readAuthorized/readDenied` 仅供参考），以各类型实际查询结果为准。

## 7. 真机实测记录（2026-11-01）

- 构建：GitHub Actions 普通版（未勾 demo），artifact `healthSleep-unsigned-ipa`，约 730 KB；
- 签名：爱思助手 + 免费 Apple ID；安装、启动、界面渲染全部正常；
- 页面表现：顶部"演示数据"角标 + 虚线横幅，横幅内容为回退原因
  （首次实测时为 `Missing com.apple.developer.healthkit entitlement.`）；
- 诊断文本（e057c13 版本）主要结论：
  - `HealthKit 可用: 是`，但 `授权请求: 失败 — Missing com.apple.developer.healthkit entitlement.`；
  - 28 类数据全部 ✕；其中 17 类为 entitlement 错误，11 类为「不支持聚合查询」（见 6.3，已修复）；
  - 演示数据回退与诊断保留均按设计工作。

## 8. 真机验证真实健康数据的唯一路径：付费开发者账号

费用参考：Apple Developer Program ¥688/年（个人）。上账号后有两条路：

1. **爱思助手导入签名**：开发者后台创建证书（.p12）与描述文件（App ID 勾选 HealthKit capability），
   导入爱思助手对普通版 IPA 重新签名安装；
2. **CI 直接出签名包**：把证书与描述文件存成 GitHub Secrets（base64），在现有 workflow 基础上增加
   keychain 导入 + `xcodebuild archive` 签名 + `exportArchive` 步骤，可产出可安装 IPA，也可上传 TestFlight。

上付费账号后的验证流程：用最新 master 构建 → 签名安装 → 打开页面拉到底 → 复制「数据读取诊断」。
预期：授权请求成功，各类型按 ✓/○ 展示；「更多健康指标」网格填入真实数据。

## 9. 已知限制与注意事项

- **免费签名不可读 HealthKit**：硬性限制，无绕过方案；
- `package-lock.json` 曾指向阿里云私有 npm 源（`packages.aliyun.com`），GitHub Actions 上没有凭据会 401。
  已改回 `https://registry.npmjs.org`（版本与 integrity 不变）。**今后不要用私有源重新生成 lockfile**；
- Windows 上 `git add` 出现 `LF will be replaced by CRLF` 警告属正常（仓库内存 LF）；
- iOS 读授权状态不可精确获取，以查询结果为准；删除 App 重装可重新触发授权弹窗；
- 模拟器没有真实健康数据，HealthKit 必须真机验证；
- 演示数据由 `npm run mock:generate` 生成，CI 构建前会自动刷新到当天；本地看板日期过旧时也重新执行该脚本；
- 健康数据敏感：不要把真实导出的健康数据提交到公开仓库。

## 10. 新对话快速上手

1. 先读本文件与根目录 `CLAUDE.md`；
2. 常用命令：`npm ci`、`npm run dev`、`npm run build`、`npm run ios:sync`、`npm run mock:generate`；
3. 构建入口：GitHub 仓库 Actions → Build unsigned iOS IPA → Run workflow（可勾 demo）；
4. 涉及 HealthKit 真机读取时，先确认用户是否已有付费 Apple 开发者账号；
   没有就只承诺"演示数据 + 诊断面板"能验证，不要承诺能读到健康数据；
5. 重要变更后请同步更新本文件与 CLAUDE.md。
