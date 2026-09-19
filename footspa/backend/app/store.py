"""足疗店实时运营状态管理（单进程内存状态 + 异步锁）。"""
from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

TechStatus = Literal["idle", "serving", "room_cleaning", "resting"]
RoomStatus = Literal["cleaned", "dirty", "cleaning"]

# 超过该等待时长（秒）提醒前台安抚
WAIT_ALERT_SECONDS = 20 * 60


@dataclass
class Service:
    id: str
    name: str
    duration_min: int
    price: float
    category: str  # 足疗 / 按摩 / 套餐


@dataclass
class Technician:
    id: str
    name: str
    level: str  # 技师 / 高级技师 / 金牌技师
    status: TechStatus = "idle"
    current_room_id: str | None = None


@dataclass
class Room:
    id: str
    name: str
    status: RoomStatus = "cleaned"


@dataclass
class Session:
    """当前上钟记录。"""
    id: str
    tech_id: str
    room_id: str
    service_id: str
    started_at: float
    duration_min: int
    price: float
    customer_name: str

    @property
    def end_at(self) -> float:
        return self.started_at + self.duration_min * 60


@dataclass
class QueueCustomer:
    id: str
    name: str
    phone: str
    party_size: int  # 人数
    preferred: str  # 项目偏好
    arrived_at: float
    acknowledged: bool = False  # 前台是否已知晓超时提醒


@dataclass
class CompletedRecord:
    """已完成（下钟结账）记录，用于今日已接待人数 / 营收统计。"""
    session_id: str
    tech_id: str
    room_id: str
    service_name: str
    price: float
    started_at: float
    ended_at: float


@dataclass
class Store:
    services: dict[str, Service] = field(default_factory=dict)
    technicians: dict[str, Technician] = field(default_factory=dict)
    rooms: dict[str, Room] = field(default_factory=dict)
    sessions: dict[str, Session] = field(default_factory=dict)
    queue: list[QueueCustomer] = field(default_factory=list)
    completed: list[CompletedRecord] = field(default_factory=list)
    # 今日统计基准时间：今日零点
    day_start: float = field(
        default_factory=lambda: datetime.now()
        .replace(hour=0, minute=0, second=0, microsecond=0)
        .timestamp()
    )

    lock = asyncio.Lock()

    # ---------- 工具方法 ----------
    def get_service(self, service_id: str) -> Service:
        svc = self.services.get(service_id)
        if not svc:
            raise KeyError(f"项目不存在: {service_id}")
        return svc

    def _elapsed_and_remaining(self, s: Session, now: float) -> tuple[int, int]:
        elapsed = max(0, int(now - s.started_at))
        remaining = max(0, int(s.end_at - now))
        return elapsed, remaining

    # ---------- 业务操作 ----------
    async def start_session(
        self, tech_id: str, room_id: str, service_id: str,
        customer_name: str = "",
    ) -> Session:
        async with self.lock:
            tech = self.technicians.get(tech_id)
            room = self.rooms.get(room_id)
            if not tech or not room:
                raise ValueError("技师或房间不存在")
            if tech.status != "idle":
                raise ValueError(f"技师 {tech.name} 当前不是空闲状态")
            if room.status != "cleaned":
                raise ValueError(f"房间 {room.name} 尚未打扫完成")
            if any(x.room_id == room_id for x in self.sessions.values()):
                raise ValueError(f"房间 {room.name} 正在使用中")
            svc = self.get_service(service_id)
            s = Session(
                id=str(uuid.uuid4())[:8],
                tech_id=tech_id,
                room_id=room_id,
                service_id=service_id,
                started_at=time.time(),
                duration_min=svc.duration_min,
                price=svc.price,
                customer_name=customer_name or "散客",
            )
            self.sessions[s.id] = s
            tech.status = "serving"
            tech.current_room_id = room_id
            return s

    async def end_session(self, session_id: str) -> Session:
        """下钟结账：计入今日接待与营收，房间转待打扫。"""
        async with self.lock:
            s = self.sessions.get(session_id)
            if not s:
                raise ValueError("上钟记录不存在")
            tech = self.technicians[s.tech_id]
            room = self.rooms[s.room_id]
            svc = self.get_service(s.service_id)
            self.completed.append(CompletedRecord(
                session_id=s.id,
                tech_id=s.tech_id,
                room_id=s.room_id,
                service_name=svc.name,
                price=s.price,
                started_at=s.started_at,
                ended_at=time.time(),
            ))
            del self.sessions[session_id]
            tech.status = "idle"
            tech.current_room_id = None
            room.status = "dirty"
            return s

    async def start_cleaning(self, room_id: str, tech_id: str | None) -> Room:
        async with self.lock:
            room = self.rooms.get(room_id)
            if not room:
                raise ValueError("房间不存在")
            if room.status not in ("dirty", "cleaning"):
                raise ValueError("只有待打扫的房间才能开始打扫")
            if tech_id:
                tech = self.technicians.get(tech_id)
                if not tech:
                    raise ValueError("技师不存在")
                if tech.status != "idle":
                    raise ValueError(f"技师 {tech.name} 当前不可安排打扫")
                tech.status = "room_cleaning"
                tech.current_room_id = room_id
            room.status = "cleaning"
            return room

    async def finish_cleaning(self, room_id: str) -> Room:
        """保洁完成，房间变为可用（已打扫）。"""
        async with self.lock:
            room = self.rooms.get(room_id)
            if not room:
                raise ValueError("房间不存在")
            if room.status != "cleaning":
                raise ValueError("房间不在打扫中")
            room.status = "cleaned"
            # 释放打扫该房间的技师
            for tech in self.technicians.values():
                if tech.status == "room_cleaning" and tech.current_room_id == room_id:
                    tech.status = "idle"
                    tech.current_room_id = None
            return room

    async def set_tech_status(self, tech_id: str, status: TechStatus) -> Technician:
        async with self.lock:
            tech = self.technicians.get(tech_id)
            if not tech:
                raise ValueError("技师不存在")
            if status == "serving":
                raise ValueError("上钟状态由开单/下钟自动维护")
            if status == "room_cleaning":
                raise ValueError("打扫状态由房间打扫流程维护")
            if tech.status == "serving":
                raise ValueError("技师上钟中，请先下钟")
            tech.status = status
            tech.current_room_id = None
            return tech

    async def add_queue_customer(
        self, name: str, phone: str, party_size: int, preferred: str,
    ) -> QueueCustomer:
        async with self.lock:
            c = QueueCustomer(
                id=str(uuid.uuid4())[:8],
                name=name,
                phone=phone,
                party_size=max(1, party_size),
                preferred=preferred,
                arrived_at=time.time(),
            )
            self.queue.append(c)
            return c

    async def remove_queue_customer(self, customer_id: str) -> None:
        async with self.lock:
            self.queue = [c for c in self.queue if c.id != customer_id]

    async def acknowledge_queue(self, customer_id: str) -> None:
        async with self.lock:
            for c in self.queue:
                if c.id == customer_id:
                    c.acknowledged = True

    async def acknowledge_all_queue(self) -> None:
        async with self.lock:
            for c in self.queue:
                if self._wait_seconds(c.arrived_at, time.time()) >= WAIT_ALERT_SECONDS:
                    c.acknowledged = True

    @staticmethod
    def _wait_seconds(arrived_at: float, now: float) -> int:
        return max(0, int(now - arrived_at))

    # ---------- 快照 ----------
    def snapshot(self) -> dict:
        now = time.time()
        sessions = []
        for s in self.sessions.values():
            elapsed, remaining = self._elapsed_and_remaining(s, now)
            svc = self.get_service(s.service_id)
            overdue = now > s.end_at
            sessions.append({
                "id": s.id,
                "techId": s.tech_id,
                "techName": self.technicians[s.tech_id].name,
                "roomId": s.room_id,
                "roomName": self.rooms[s.room_id].name,
                "serviceId": s.service_id,
                "serviceName": svc.name,
                "customerName": s.customer_name,
                "startedAt": s.started_at,
                "endAt": s.end_at,
                "elapsedSec": elapsed,
                "remainingSec": remaining,
                "overdueSec": max(0, int(now - s.end_at)),
                "durationMin": s.duration_min,
                "price": s.price,
                "overdue": overdue,
            })
        sessions.sort(key=lambda x: x["startedAt"])

        today_records = [
            r for r in self.completed if r.ended_at >= self.day_start
        ]

        queue = []
        for c in self.queue:
            wait_sec = self._wait_seconds(c.arrived_at, now)
            queue.append({
                "id": c.id,
                "name": c.name,
                "phone": c.phone,
                "partySize": c.party_size,
                "preferred": c.preferred,
                "arrivedAt": c.arrived_at,
                "waitSec": wait_sec,
                "overtime": wait_sec >= WAIT_ALERT_SECONDS,
                "acknowledged": c.acknowledged,
            })
        queue.sort(key=lambda x: x["arrivedAt"])

        return {
            "now": now,
            "services": [
                {"id": s.id, "name": s.name, "durationMin": s.duration_min,
                 "price": s.price, "category": s.category}
                for s in self.services.values()
            ],
            "technicians": [
                {"id": t.id, "name": t.name, "level": t.level,
                 "status": t.status, "currentRoomId": t.current_room_id}
                for t in self.technicians.values()
            ],
            "rooms": [
                {"id": r.id, "name": r.name, "status": r.status}
                for r in self.rooms.values()
            ],
            "sessions": sessions,
            "queue": queue,
            "metrics": {
                "idleTechs": sum(
                    1 for t in self.technicians.values() if t.status == "idle"),
                "servingTechs": sum(
                    1 for t in self.technicians.values() if t.status == "serving"),
                "servedToday": len(today_records),
                "revenueToday": round(sum(r.price for r in today_records), 2),
                "availableRooms": sum(
                    1 for r in self.rooms.values()
                    if r.status == "cleaned"
                    and not any(x.room_id == r.id for x in self.sessions.values())),
                "waitingCustomers": len(self.queue),
            },
        }


def seed_store() -> Store:
    """构造演示初始数据。"""
    store = Store()

    services = [
        Service("svc-zy", "经典足疗", 60, 128, "足疗"),
        Service("svc-zw", "中药养生足疗", 75, 168, "足疗"),
        Service("svc-jb", "肩颈舒缓按摩", 45, 138, "按摩"),
        Service("svc-tb", "泰式全身按摩", 90, 258, "按摩"),
        Service("svc-yl", "腰背理疗", 60, 188, "理疗"),
        Service("svc-tc", "至尊足疗+全身套餐", 120, 358, "套餐"),
    ]
    for s in services:
        store.services[s.id] = s

    techs = [
        ("t1", "王芳", "高级技师"), ("t2", "李娟", "技师"),
        ("t3", "张敏", "金牌技师"), ("t4", "刘洋", "技师"),
        ("t5", "陈静", "高级技师"), ("t6", "赵磊", "技师"),
        ("t7", "孙丽", "技师"), ("t8", "周强", "高级技师"),
    ]
    for tid, name, level in techs:
        store.technicians[tid] = Technician(tid, name, level)

    for i in range(1, 9):
        rid = f"r{i}"
        store.rooms[rid] = Room(rid, f"{100 + i}号房")

    now = time.time()

    def m(n: int) -> float:
        return now - n * 60

    # 进行中的上钟
    running = [
        # tech, room, service, started_minutes_ago, customer
        ("t1", "r1", "svc-zy", 42, "陈先生"),   # 还剩 18 分
        ("t3", "r2", "svc-tc", 95, "黄女士"),   # 还剩 25 分
        ("t5", "r3", "svc-jb", 40, "吴先生"),   # 超时 0 分 -> 刚超时? 45-40=还剩5分
        ("t2", "r4", "svc-zw", 68, "林女士"),   # 75-68=还剩7分
    ]
    for tid, rid, sid, ago, customer in running:
        svc = store.services[sid]
        s = Session(
            id=str(uuid.uuid4())[:8], tech_id=tid, room_id=rid,
            service_id=sid, started_at=m(ago),
            duration_min=svc.duration_min, price=svc.price,
            customer_name=customer,
        )
        store.sessions[s.id] = s
        store.technicians[tid].status = "serving"
        store.technicians[tid].current_room_id = rid
        store.rooms[rid].status = "cleaned"  # 上钟中房间视为可用态占用

    # t6 正在打扫 6 号房（待打扫 -> 打扫中）
    store.rooms["r6"].status = "cleaning"
    store.technicians["t6"].status = "room_cleaning"
    store.technicians["t6"].current_room_id = "r6"
    # 5 号房待打扫（刚下钟）
    store.rooms["r5"].status = "dirty"

    # t7 吃饭休息，t8 空闲
    store.technicians["t7"].status = "resting"

    # 排队（第三位已等待 22 分钟 -> 触发提醒）
    queue_seed = [
        ("郑先生", "138****2211", 1, "经典足疗", 8),
        ("何女士", "139****8845", 2, "泰式全身按摩", 14),
        ("高先生", "136****0092", 1, "中药养生足疗", 22),
    ]
    for name, phone, size, pref, ago in queue_seed:
        store.queue.append(QueueCustomer(
            id=str(uuid.uuid4())[:8], name=name, phone=phone,
            party_size=size, preferred=pref, arrived_at=m(ago),
        ))

    # 今日已完成记录（已结账）
    done = [
        ("t1", "r2", "svc-zy", m(180), m(120)),
        ("t4", "r1", "svc-jb", m(150), m(105)),
        ("t3", "r3", "svc-tc", m(260), m(140)),
        ("t5", "r5", "svc-yl", m(90), m(30)),
        ("t2", "r4", "svc-zw", m(210), m(135)),
        ("t8", "r6", "svc-zy", m(60), m(1)),  # 刚下钟 -> r6? 让 r5 对应
    ]
    for tid, rid, sid, started, ended in done:
        svc = store.services[sid]
        store.completed.append(CompletedRecord(
            session_id=str(uuid.uuid4())[:8], tech_id=tid, room_id=rid,
            service_name=svc.name, price=svc.price,
            started_at=started, ended_at=ended,
        ))
    # 修正：最近下钟的是 5 号房（与 dirty 对应）
    store.completed[-1] = CompletedRecord(
        session_id=str(uuid.uuid4())[:8], tech_id="t8", room_id="r5",
        service_name="经典足疗", price=128,
        started_at=m(60), ended_at=m(1),
    )

    return store


store = seed_store()
