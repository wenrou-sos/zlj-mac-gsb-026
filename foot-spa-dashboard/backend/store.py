"""
足疗店实时运营面板 —— 内存数据存储 + 业务逻辑
"""
import random
import time
import uuid
from typing import Any, Dict, List, Optional

# ---------------- 基础种子数据 ----------------

TECHNICIAN_NAMES = [
    "01号 王芳", "02号 李娜", "03号 张敏", "04号 刘洋",
    "05号 陈静", "06号 赵磊", "07号 孙倩", "08号 周婷",
]

ROOM_NAMES = ["VIP 01", "VIP 02", "豪华 03", "标准 04", "标准 05", "标准 06"]

# (项目名, 时长分钟, 价格)
SERVICES_SEED = [
    ("经典足疗", 60, 128),
    ("中式推拿", 60, 158),
    ("精油开背SPA", 90, 238),
    ("修脚+足疗套餐", 75, 168),
    ("肩颈舒缓", 45, 98),
    ("头部放松", 30, 68),
]

CUSTOMER_POOL = [
    "吴先生", "郑女士", "冯先生", "褚女士", "卫先生", "蒋女士",
    "沈先生", "韩女士", "杨先生", "朱女士", "秦先生", "尤女士",
    "许女士", "何先生", "吕女士",
]

WAIT_ALERT_SEC = 20 * 60  # 排队超过 20 分钟需要安抚


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


class Store:
    def __init__(self) -> None:
        self.reset()

    # ---------------- 初始化 / 重置 ----------------
    def reset(self) -> None:
        now = time.time()

        self.services: List[Dict[str, Any]] = [
            {"id": f"svc{i + 1}", "name": n, "durationSec": d * 60, "price": p}
            for i, (n, d, p) in enumerate(SERVICES_SEED)
        ]
        self.technicians: List[Dict[str, Any]] = [
            {"id": f"t{i + 1}", "name": n, "status": "idle", "roomId": None}
            for i, n in enumerate(TECHNICIAN_NAMES)
        ]
        self.rooms: List[Dict[str, Any]] = [
            {"id": f"r{i + 1}", "name": n, "status": "clean",
             "sessionId": None, "technicianId": None, "dirtyAt": None}
            for i, n in enumerate(ROOM_NAMES)
        ]
        self.sessions: List[Dict[str, Any]] = []   # 上钟中
        self.done: List[Dict[str, Any]] = []       # 今日已结账
        self.queue: List[Dict[str, Any]] = []      # 排队中
        self.demo = False                          # 演示自动流转
        self._sim_acc = 0.0

        # 几笔今日已完成的订单（制造营收/接待量）
        done_seed = [
            ("经典足疗", 9.5, "曹先生"),
            ("精油开背SPA", 8.0, "严女士"),
            ("中式推拿", 6.2, "华先生"),
            ("肩颈舒缓", 4.5, "金女士"),
            ("修脚+足疗套餐", 3.0, "魏先生"),
            ("经典足疗", 1.2, "陶女士"),
        ]
        svc_map = {s["name"]: s for s in self.services}
        for sname, hours_ago, customer in done_seed:
            s = svc_map[sname]
            finished_at = now - hours_ago * 3600
            self.done.append({
                "id": new_id("ss"),
                "technicianId": "t1", "roomId": "r1",
                "serviceId": s["id"], "serviceName": s["name"],
                "price": s["price"], "durationSec": s["durationSec"],
                "customerName": customer,
                "startedAt": finished_at - s["durationSec"],
                "finishedAt": finished_at,
            })

        # 四笔进行中的上钟
        def open_seed(ti: int, ri: int, sname: str, ago_min: int, customer: str) -> None:
            s = svc_map[sname]
            self._open_session(
                self.technicians[ti]["id"], self.rooms[ri]["id"],
                s["id"], customer, now - ago_min * 60,
            )

        open_seed(0, 0, "精油开背SPA", 52, "许先生")   # 还剩约 38 分钟
        open_seed(1, 1, "经典足疗", 35, "何女士")       # 还剩约 25 分钟
        open_seed(2, 2, "肩颈舒缓", 40, "高先生")       # 还剩约 5 分钟
        open_seed(3, 3, "中式推拿", 62, "林女士")       # 已超时

        # 一个刚下钟：技师黄色待打扫、房间待打扫
        open_seed(4, 4, "经典足疗", 60, "郭先生")
        self.finish_session(self.sessions[-1]["id"])

        # 一位在休息的技师
        self.technicians[6]["status"] = "resting"

        # 排队顾客（第一位 19 分多钟，很快触发 20 分钟安抚弹窗）
        self._enqueue("马女士", now - 19 * 60 - 25)
        self._enqueue("罗先生", now - 6 * 60 - 10)

    # ---------------- 查询工具 ----------------
    def _tech(self, tid: str) -> Dict[str, Any]:
        t = next((x for x in self.technicians if x["id"] == tid), None)
        if not t:
            raise ValueError("技师不存在")
        return t

    def _room(self, rid: str) -> Dict[str, Any]:
        r = next((x for x in self.rooms if x["id"] == rid), None)
        if not r:
            raise ValueError("房间不存在")
        return r

    def _service(self, sid: str) -> Dict[str, Any]:
        s = next((x for x in self.services if x["id"] == sid), None)
        if not s:
            raise ValueError("项目不存在")
        return s

    # ---------------- 排队 ----------------
    def _enqueue(self, name: str, joined_at: Optional[float] = None) -> Dict[str, Any]:
        entry = {
            "id": new_id("q"),
            "name": name,
            "joinedAt": joined_at if joined_at is not None else time.time(),
        }
        self.queue.append(entry)
        return entry

    def add_queue(self, name: str) -> Dict[str, Any]:
        name = (name or "").strip()
        if not name:
            raise ValueError("请填写顾客称呼（如：王先生 / 3号）")
        return self._enqueue(name)

    def remove_queue(self, qid: str) -> None:
        self.queue = [q for q in self.queue if q["id"] != qid]

    # ---------------- 上钟 ----------------
    def _open_session(self, tid: str, rid: str, sid: str,
                      customer: str, started_at: float) -> Dict[str, Any]:
        svc = self._service(sid)
        sess = {
            "id": new_id("ss"),
            "technicianId": tid,
            "roomId": rid,
            "serviceId": sid,
            "serviceName": svc["name"],
            "price": svc["price"],
            "durationSec": svc["durationSec"],
            "customerName": customer,
            "startedAt": started_at,
        }
        tech = self._tech(tid)
        room = self._room(rid)
        tech["status"] = "busy"
        tech["roomId"] = rid
        room["status"] = "occupied"
        room["sessionId"] = sess["id"]
        room["technicianId"] = tid
        self.sessions.append(sess)
        return sess

    def start_session(self, tid: str, rid: str, sid: str,
                      customer: Optional[str], qid: Optional[str] = None) -> Dict[str, Any]:
        tech = self._tech(tid)
        if tech["status"] != "idle":
            raise ValueError("该技师当前不是空闲状态，无法上钟")
        room = self._room(rid)
        if room["status"] != "clean":
            raise ValueError("该房间当前不可用（需已打扫）")
        self._open_session(tid, rid, sid, (customer or "散客").strip() or "散客", time.time())
        if qid:
            self.queue = [q for q in self.queue if q["id"] != qid]
        return self.sessions[-1]

    def finish_session(self, session_id: str) -> Dict[str, Any]:
        """下钟：结账计营收，技师变黄（待打扫房间中），房间变待打扫。"""
        sess = next((s for s in self.sessions if s["id"] == session_id), None)
        if not sess:
            raise ValueError("上钟记录不存在或已结束")
        self.sessions.remove(sess)
        now = time.time()
        sess["finishedAt"] = now
        self.done.append(sess)

        tech = self._tech(sess["technicianId"])
        room = self._room(sess["roomId"])
        tech["status"] = "cleaning"
        tech["roomId"] = room["id"]
        room["status"] = "dirty"
        room["sessionId"] = None
        room["technicianId"] = tech["id"]
        room["dirtyAt"] = now
        return sess

    # ---------------- 房间打扫 ----------------
    def start_cleaning(self, rid: str) -> None:
        room = self._room(rid)
        if room["status"] != "dirty":
            raise ValueError("该房间不是待打扫状态")
        room["status"] = "cleaning"

    def finish_cleaning(self, rid: str) -> None:
        """保洁完成点击：房间变可用，关联技师恢复空闲（绿色）。"""
        room = self._room(rid)
        if room["status"] != "cleaning":
            raise ValueError("该房间不在打扫中")
        room["status"] = "clean"
        room["dirtyAt"] = None
        tid = room.get("technicianId")
        room["technicianId"] = None
        if tid:
            tech = next((t for t in self.technicians if t["id"] == tid), None)
            if tech and tech["status"] == "cleaning" and tech["roomId"] == rid:
                tech["status"] = "idle"
                tech["roomId"] = None

    # ---------------- 技师休息 ----------------
    def set_rest(self, tid: str, resting: bool) -> None:
        tech = self._tech(tid)
        if resting:
            if tech["status"] != "idle":
                raise ValueError("只有空闲技师可以去休息/吃饭")
            tech["status"] = "resting"
        else:
            if tech["status"] != "resting":
                raise ValueError("该技师当前不在休息状态")
            tech["status"] = "idle"

    # ---------------- 演示模式（自动流转） ----------------
    def set_demo(self, enabled: bool) -> None:
        self.demo = enabled
        self._sim_acc = 0.0

    def tick(self) -> None:
        """每秒触发；演示模式下自动排号、超时下钟、自动打扫。"""
        if not self.demo:
            return
        now = time.time()
        self._sim_acc += 1

        # 每 15 秒自动来一位排队顾客
        if self._sim_acc >= 15:
            self._sim_acc = 0.0
            if len(self.queue) < 5:
                used = {q["name"] for q in self.queue}
                pool = [n for n in CUSTOMER_POOL if n not in used]
                if pool:
                    self._enqueue(random.choice(pool))

        # 超时 40 秒自动下钟
        for s in list(self.sessions):
            if now - s["startedAt"] >= s["durationSec"] + 40:
                self.finish_session(s["id"])

        # 待打扫 6 秒后自动开始，打扫 9 秒后自动完成
        for room in list(self.rooms):
            if not room["dirtyAt"]:
                continue
            waited = now - room["dirtyAt"]
            if room["status"] == "dirty" and waited >= 6:
                self.start_cleaning(room["id"])
            elif room["status"] == "cleaning" and waited >= 15:
                self.finish_cleaning(room["id"])

    # ---------------- 快照 ----------------
    def stats(self) -> Dict[str, Any]:
        return {
            "idle": sum(1 for t in self.technicians if t["status"] == "idle"),
            "busy": sum(1 for t in self.technicians if t["status"] == "busy"),
            "cleaning": sum(1 for t in self.technicians if t["status"] == "cleaning"),
            "resting": sum(1 for t in self.technicians if t["status"] == "resting"),
            "served": len(self.sessions) + len(self.done),
            "revenue": round(sum(d["price"] for d in self.done), 2),
            "queueCount": len(self.queue),
        }

    def snapshot(self) -> Dict[str, Any]:
        sessions = sorted(self.sessions, key=lambda s: s["startedAt"])
        return {
            "serverTime": time.time(),
            "demo": self.demo,
            "technicians": [dict(t) for t in self.technicians],
            "rooms": [dict(r) for r in self.rooms],
            "services": [dict(s) for s in self.services],
            "sessions": [dict(s) for s in sessions],
            "queue": [dict(q) for q in self.queue],
            "stats": self.stats(),
        }


store = Store()
