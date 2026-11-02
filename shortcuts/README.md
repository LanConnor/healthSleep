# 导出健康样本快捷指令

`health-samples.shortcut` 是未签名的 XML plist，直接点开 iOS 会拒绝导入，需要先签名。

## 重新生成

```bash
node tools/build-health-shortcut.mjs
```

## 签名（Windows 无 Mac）

1. 打开 https://playground.cherrilang.org/
2. 用 Import Shortcut 选择本目录下的 `health-samples.shortcut`
3. 点导出图标 → Download Shortcut，得到 HubSign 签名的版本
4. 传到 iPhone，点开文件 → 添加快捷指令；首次运行允许读取步数、静息心率、睡眠

GitHub Actions 的 `shortcuts sign` 需要 macOS 登录 iCloud，公共 runner 不可用，因此仓库不提供 CI 签名工作流。
