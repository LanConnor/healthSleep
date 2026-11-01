# healthSleep 项目说明（给 Claude 会话）

健康看板：Vite + TypeScript + Capacitor 8 + Chart.js，读取 Apple 健康数据（@capgo/capacitor-health）。
**开工前先读 `docs/ios-build-notes.md`**：打包、签名、真机验证、已知限制都在里面。

## 常用命令

- 安装依赖：`npm ci`
- 浏览器预览（Mock 数据）：`npm run dev`
- 生产构建：`npm run build`
- 构建并同步 iOS 工程：`npm run ios:sync`
- 重新生成演示数据：`npm run mock:generate`

## 关键约束

- 开发机是 Windows，没有 Mac；iOS 编译走 GitHub Actions
  （`.github/workflows/ios-unsigned-ipa.yml`，手动 Run workflow，可勾 `demo` 构建演示版）。
- **免费 Apple ID 签名不含 HealthKit capability**（已真机实测，报 Missing entitlement）。
  真机读健康数据必须付费 Apple 开发者账号；不要再建议任何免费方案。
- 仓库远程指向 SSH 别名 `github-lanconnor`（`~/.ssh/config`，专用密钥 `id_ed25519_lanconnor`），
  直接 `git push origin master` 即可。提交信息结尾按约定加 Co-Authored-By。
- 数据源链：浏览器 → `MockHealthProvider`；真机 → `DemoHealthProvider(HealthKitProvider)`，
  HealthKit 全部失败自动回退演示数据；`VITE_FORCE_DEMO=1` 强制演示模式。
- 页面底部有「数据读取诊断」文本框，用户复制回来的内容是最重要的排查依据。
