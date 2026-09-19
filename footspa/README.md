# 悦足轩 · 足疗店实时运营面板

实时门店运营系统：门口大屏 + 前台平板，双端通过 WebSocket 实时同步。

- **技术栈**：React 19 + TypeScript + Vite + Tailwind CSS；Python 3.11 + FastAPI + WebSocket
- **数据**：内存状态（演示用，重启后恢复种子数据），无需数据库

## 页面

| 端 | 地址 | 内容 |
|---|---|---|
| 门口大屏 | `/` | 空闲技师数、今日已接待、今日营收；技师/房间状态墙、排队列表 |
| 前台平板 | `/desk` | 上钟情况表格、排队登记、房间保洁流程、技师排班 |

## 业务规则

- **技师状态（颜色标识）**：🟢 空闲 · 🔴 上钟 · 🟡 待打扫房间中 · ⚪ 休息/吃饭
- **开单**：仅空闲技师 + 已打扫可用房间可开单；开单后技师转红、房间占用
- **下钟结账**：计入「今日已接待人数」和「今日营收」，房间自动转「待打扫」
- **房间保洁**：待打扫 →（可指派空闲技师，技师变黄）→ 打扫中 → 点击「保洁完成」变已打扫可用，技师释放回空闲
- **排队**：登记等待时长并实时计时；**等待超过 20 分钟自动弹窗**提醒前台安抚，支持单条「已安抚」、「全部已知晓」、「5 分钟后再提醒」；标签页在后台时还会发浏览器通知
- **上钟表格**：技师 / 房间 / 项目 / 已做多久 / 进度条 / 预计剩余时间，剩余 ≤10 分钟变黄、超时变红并显示超时时长

## 启动方式

### 一键启动（开发模式）

```bash
chmod +x run-dev.sh
./run-dev.sh
```

### 手动启动

后端：

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000
```

前端：

```bash
cd frontend
npm install
npm run dev
```

Vite 已把 `/api` 与 `/ws` 代理到 `localhost:8000`，直接访问：

- 门口大屏：http://localhost:5173/
- 前台平板：http://localhost:5173/desk

> 建议门口大屏用全屏（F11）显示；前台平板用横屏。

## 主要 API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/state` | 全量状态快照 |
| WS | `/ws` | 状态变更广播快照；每秒推送 tick 驱动计时 |
| POST | `/api/sessions` | 开单上钟 |
| POST | `/api/sessions/{id}/end` | 下钟结账 |
| POST | `/api/rooms/{id}/cleaning` | 开始打扫（body 可带 `techId`） |
| POST | `/api/rooms/{id}/cleaned` | 保洁完成 → 可用 |
| POST | `/api/technicians/{id}/status` | 切换空闲/休息 |
| POST / DELETE | `/api/queue`、`/api/queue/{id}` | 排队登记 / 移出 |
| POST | `/api/queue/{id}/ack`、`/api/queue/ack-all` | 安抚确认（关闭超时弹窗） |

种子数据里已预置 8 名技师、8 个房间、4 个进行中的上钟单、3 位排队顾客（第 3 位已等 22 分钟，打开页面即会弹出超时提醒）。
