import './style.css';
import { healthProvider } from './health';
import { renderDashboard } from './ui/dashboard';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) {
  throw new Error('缺少 #app 挂载节点');
}

void renderDashboard(root, healthProvider);
