"""足疗店实时运营面板 — FastAPI 入口。

REST：前台操作（开单/下钟/打扫/排队/技师状态）
WebSocket：/ws 推送全量快照，另每秒推送 tick 保证计时实时
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Literal

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .store import WAIT_ALERT_SECONDS, store
from .ws import manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("footspa")

app = FastAPI(title="足疗店实时运营面板")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- Pydantic 请求模型 ----------------
class StartSessionIn(BaseModel):
    techId: str
    roomId: str
    serviceId: str
    customerName: str = ""


class CleaningIn(BaseModel):
    techId: str | None = None


class TechStatusIn(BaseModel):
    status: Literal["idle", "resting"]


class QueueIn(BaseModel):
    name: str = Field(min_length=1)
    phone: str = ""
    partySize: int = Field(default=1, ge=1, le=20)
    preferred: str = ""


# ---------------- REST ----------------
@app.get("/api/state")
async def get_state():
    return store.snapshot()


@app.post("/api/sessions")
async def start_session(body: StartSessionIn):
    try:
        s = await store.start_session(
            body.techId, body.roomId, body.serviceId, body.customerName)
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    await broadcast_state()
    return {"ok": True, "sessionId": s.id}


@app.post("/api/sessions/{session_id}/end")
async def end_session(session_id: str):
    try:
        await store.end_session(session_id)
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    await broadcast_state()
    return {"ok": True}


@app.post("/api/rooms/{room_id}/cleaning")
async def start_cleaning(room_id: str, body: CleaningIn):
    try:
        await store.start_cleaning(room_id, body.techId)
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    await broadcast_state()
    return {"ok": True}


@app.post("/api/rooms/{room_id}/cleaned")
async def finish_cleaning(room_id: str):
    try:
        await store.finish_cleaning(room_id)
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    await broadcast_state()
    asyncio.create_task(_maybe_alert())
    return {"ok": True}


@app.post("/api/technicians/{tech_id}/status")
async def set_tech_status(tech_id: str, body: TechStatusIn):
    try:
        await store.set_tech_status(tech_id, body.status)
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    await broadcast_state()
    return {"ok": True}


@app.post("/api/queue")
async def add_queue(body: QueueIn):
    c = await store.add_queue_customer(
        body.name, body.phone, body.partySize, body.preferred)
    await broadcast_state()
    return {"ok": True, "id": c.id}


@app.delete("/api/queue/{customer_id}")
async def remove_queue(customer_id: str):
    await store.remove_queue_customer(customer_id)
    await broadcast_state()
    return {"ok": True}


@app.post("/api/queue/{customer_id}/ack")
async def ack_queue(customer_id: str):
    await store.acknowledge_queue(customer_id)
    await broadcast_state()
    return {"ok": True}


@app.post("/api/queue/ack-all")
async def ack_all_queue():
    await store.acknowledge_all_queue()
    await broadcast_state()
    return {"ok": True}


@app.get("/api/config")
async def get_config():
    return {"waitAlertSeconds": WAIT_ALERT_SECONDS}


# ---------------- WebSocket ----------------
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    await ws.send_json({"type": "state", "data": store.snapshot()})
    try:
        while True:
            # 前端只接收，不发送；保持 receive 以感知断开
            await ws.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(ws)


async def broadcast_state() -> None:
    await manager.broadcast({"type": "state", "data": store.snapshot()})


async def _maybe_alert() -> None:
    """打扫完成后如有空房，状态里已有排队信息，前端自行判断弹窗。"""
    return None


# ---------------- 每秒 tick（驱动计时 + 超时弹窗检测） ----------------
@app.on_event("startup")
async def _startup() -> None:
    async def tick_loop() -> None:
        while True:
            await asyncio.sleep(1)
            await manager.broadcast({"type": "tick", "data": {"now": time.time()}})

    asyncio.create_task(tick_loop())
    logger.info("运营面板后端已启动")
