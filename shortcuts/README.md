# 导出健康样本快捷指令

## 推荐：Cherri Playground（无需 Mac）

1. 打开 `shortcuts/playground-link.txt` 里的链接（代码已内置），或手动打开 https://playground.cherrilang.org/ 并粘贴 [health-samples.cherri](health-samples.cherri)
2. 点锤子按钮编译
3. 点分享/导出图标 → **Download Shortcut**，得到 HubSign 签名版
4. 传到 iPhone，点开文件 → 添加快捷指令
5. 编辑三个「查找健康样本」动作，分别设为：
   - 步数，筛选「开始日期 在最近 2 天内」
   - 静息心率，筛选「开始日期 在最近 2 天内」
   - 睡眠，筛选「开始日期 在最近 2 天内」
6. 首次运行允许读取健康数据；输出到 文件 App → iCloud Drive → Shortcuts → `health-samples.txt`

注意：Playground 左上角的云朵按钮只接受 **iCloud 链接**，不能选择本地文件。

## 未签名源文件

`health-samples.shortcut` 是早期生成的 XML 源文件（输出 JSON），需要 macOS 登录 iCloud 的 `shortcuts sign` 才能签名，公共 CI 不可用，保留仅供有 Mac 的环境参考。

## 重新生成 XML 源文件

```bash
node tools/build-health-shortcut.mjs
```
