# 悦足堂 · 足疗店实时运营面板

门口大屏 + 前台平板，双端实时联动的足疗店运营看板。

- **后端**：Python + FastAPI，WebSocket 每秒推送全量快照，REST 触发业务操作
- **前端**：React 18 + TypeScript + Vite，大屏（深色）/ 前台（浅色）两个视图

## 功能一览

### 📺 门口大屏（`#/screen`，默认页）
- **空闲技师数量**（绿色大数字）
- **今日已接待人数**：已结账 + 上钟中
- **今日营收**：已结账订单合计（含客单价）
- 技师动态墙：绿=空闲、红=上钟、黄=待打扫房间中、灰=休息/吃饭
- 房间状态墙：已打扫 / 上钟中 / 待打扫 / 打扫中
- 顾客排队实时等待时长，超 20 分钟红色高亮「建议安抚」

### 📱 前台平板（`#/desk`）
- **当前上钟表**：技师、房间、项目、顾客、**已做多久**、**预计剩余时间**、进度条；
  到点后进度条变红显示「已超时 N 分钟」，一键「下钟结账」
- **顾客排队**：取号 / 取消 / 安排上钟；等待时长实时走动；
  **超过 20 分钟自动弹窗**，建议前台送茶水小吃安抚，可直接安排上钟
- **房间流转**：下钟 → 待打扫 →「开始打扫」→「✓ 保洁完成」点击后变为可用，
  同时把黄色（待打扫房间中）的技师恢复为绿色空闲
- **技师状态**：空闲可「去休息」，休息中可「回岗」
- 「开单上钟」弹窗只能选空闲技师 + 已打扫房间，可由排队顾客带入（开单自动出队）
- 「▶ 演示自动流转」：自动来客人、超时自动下钟、自动打扫，方便投演示数据

> 统计口径：营收 = 今日已结账订单金额之和；已接待 = 已结账 + 上钟中。

## 启动

### 后端（端口 8000）

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 前端（端口 5173）

```bash
cd frontend
npm install
npm run dev
```

浏览器打开：

- 大屏：http://localhost:5173/ （或 `#/screen`）
- 前台：http://localhost:5173/#/desk

Vite 已配置 `/api`、`/ws` 代理到 8000 端口；WebSocket 断线时前端自动降级为 2 秒轮询。

## 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/state` | 当前全量快照 |
| WS | `/ws` | 实时快照推送（每秒 + 操作后立即推） |
| POST | `/api/queue` | 顾客取号 |
| POST | `/api/queue/{id}/remove` | 取消排队 |
| POST | `/api/sessions` | 开单上钟（可带 `queueId`） |
| POST | `/api/sessions/{id}/finish` | 下钟结账 → 房间待打扫、技师黄色 |
| POST | `/api/rooms/{id}/clean/start` | 开始打扫 |
| POST | `/api/rooms/{id}/clean/finish` | 保洁完成 → 房间可用、技师回空闲 |
| POST | `/api/technicians/{id}/rest` | 休息 / 回岗 |
| POST | `/api/demo` | 开关演示自动流转 |
| POST | `/api/reset` | 重置为初始演示数据 |

数据存内存（`backend/store.py`），重启即回到种子数据，方便反复演示。
