import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.healthdashboard',
  appName: 'Health Dashboard',
  webDir: 'dist',
  // 开发期真机热更新（可选）：在 Mac 上构建前取消注释，换成你 Windows 电脑的局域网地址，
  // 手机里的 App 会直接加载 npm run dev 的内容，Web 层改动无需重新编译。
  // server: {
  //   url: 'http://192.168.1.100:5173',
  //   cleartext: true,
  // },
};

export default config;
