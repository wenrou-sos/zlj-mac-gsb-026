"""
足疗店实时运营面板 —— FastAPI 后端
REST 操作接口 + WebSocket 每秒推送全量快照
"""
import asyncio
from contextlib import asynccontextmanager
from typing import Optional, Set

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from store import store


@asynccontextmanager
async def lifespan(_: FastAPI):
    # 每秒心跳：驱动演示流转 + 给所有大屏推送快照
    task = asyncio.create_task(_ticker())
    yield
    task.cancel()


app = FastAPI(title="足疗店实时运营面板 API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueueIn(BaseModel):
    name: str


class StartIn(BaseModel):
    technicianId: str
    roomId: str
    serviceId: str
    customerName: Optional[str] = None
    queueId: Optional[str] = None


class RestIn(BaseModel):
    resting: bool


class DemoIn(BaseModel):
    enabled: bool


_ws_clients: Set[WebSocket] = set()


async def _broadcast() -> None:
    """操作后立即推送一次，前端无需等待每秒心跳。"""
    if not _ws_clients:
        return
    payload = store.snapshot()
    dead = []
    for ws in list(_ws_clients):
        try:
            await ws.send_json(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _ws_clients.discard(ws)


def _handle(fn, *args):
    """把业务层 ValueError 转成 400。"""
    try:
        return fn(*args)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------- 实时通道 ----------------
@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    _ws_clients.add(ws)
    await ws.send_json(store.snapshot())
    try:
        while True:
            await ws.receive_text()  # 客户端心跳内容忽略
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        _ws_clients.discard(ws)


async def _ticker() -> None:
    while True:
        await asyncio.sleep(1)
        store.tick()
        if _ws_clients:
            payload = store.snapshot()
            dead = []
            for ws in list(_ws_clients):
                try:
                    await ws.send_json(payload)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                _ws_clients.discard(ws)


# ---------------- REST 接口 ----------------
@app.get("/api/state")
async def get_state():
    return store.snapshot()


@app.post("/api/queue")
async def add_queue(body: QueueIn):
    _handle(store.add_queue, body.name)
    await _broadcast()
    return store.snapshot()


@app.post("/api/queue/{qid}/remove")
async def remove_queue(qid: str):
    store.remove_queue(qid)
    await _broadcast()
    return store.snapshot()


@app.post("/api/sessions")
async def start_session(body: StartIn):
    _handle(store.start_session, body.technicianId, body.roomId,
            body.serviceId, body.customerName, body.queueId)
    await _broadcast()
    return store.snapshot()


@app.post("/api/sessions/{sid}/finish")
async def finish_session(sid: str):
    _handle(store.finish_session, sid)
    await _broadcast()
    return store.snapshot()


@app.post("/api/rooms/{rid}/clean/start")
async def start_cleaning(rid: str):
    _handle(store.start_cleaning, rid)
    await _broadcast()
    return store.snapshot()


@app.post("/api/rooms/{rid}/clean/finish")
async def finish_cleaning(rid: str):
    _handle(store.finish_cleaning, rid)
    await _broadcast()
    return store.snapshot()


@app.post("/api/technicians/{tid}/rest")
async def set_rest(tid: str, body: RestIn):
    _handle(store.set_rest, tid, body.resting)
    await _broadcast()
    return store.snapshot()


@app.post("/api/demo")
async def set_demo(body: DemoIn):
    store.set_demo(body.enabled)
    await _broadcast()
    return store.snapshot()


@app.post("/api/reset")
async def reset_data():
    store.reset()
    await _broadcast()
    return store.snapshot()
