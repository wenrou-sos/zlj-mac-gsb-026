"""端到端业务流程冒烟测试（不依赖运行中的服务）。"""
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def get():
    return client.get("/api/state").json()


def find_idle_tech(s):
    return next(t for t in s["technicians"] if t["status"] == "idle")


def find_clean_room(s):
    return next(r for r in s["rooms"] if r["status"] == "clean")


def post(url, **body):
    r = client.post(url, json=body)
    assert r.status_code == 200, (url, r.status_code, r.text)
    return r.json()


s = get()
assert s["stats"]["idle"] >= 1
assert s["stats"]["served"] == 11  # 4 进行中 + 1 已下钟 + 6 历史
assert s["stats"]["revenue"] == 1046  # 6 笔历史 918 + 1 笔种子下钟 128
assert len(s["sessions"]) == 4
assert len(s["queue"]) == 2
print("初始快照 OK:", s["stats"])

# 进行中的上钟字段齐全
row = s["sessions"][0]
assert {"technicianId", "roomId", "serviceName", "startedAt", "durationSec", "price"} <= set(row)

# 上钟 → 下钟 → 开始打扫 → 保洁完成 全流程
client.post("/api/reset")
s = get()
tech = find_idle_tech(s)
room = find_clean_room(s)
svc = s["services"][0]
s = post("/api/sessions", technicianId=tech["id"], roomId=room["id"],
         serviceId=svc["id"], customerName="测试先生")
t2 = next(x for x in s["technicians"] if x["id"] == tech["id"])
r2 = next(x for x in s["rooms"] if x["id"] == room["id"])
assert t2["status"] == "busy", "上钟后技师应为红色 busy"
assert r2["status"] == "occupied", "房间应为上钟中"
sess = next(x for x in s["sessions"] if x["technicianId"] == tech["id"])
print("开单上钟 OK:", sess["serviceName"])

s = post(f"/api/sessions/{sess['id']}/finish")
t3 = next(x for x in s["technicians"] if x["id"] == tech["id"])
r3 = next(x for x in s["rooms"] if x["id"] == room["id"])
assert t3["status"] == "cleaning" and t3["roomId"] == room["id"], "下钟后技师应黄色待打扫"
assert r3["status"] == "dirty", "下钟后房间应待打扫"
assert all(x["id"] != sess["id"] for x in s["sessions"])
print("下钟结账 OK: 营收 =", s["stats"]["revenue"], "已接待 =", s["stats"]["served"])

s = post(f"/api/rooms/{room['id']}/clean/start")
assert next(x for x in s["rooms"] if x["id"] == room["id"])["status"] == "cleaning"

s = post(f"/api/rooms/{room['id']}/clean/finish")
r4 = next(x for x in s["rooms"] if x["id"] == room["id"])
t4 = next(x for x in s["technicians"] if x["id"] == tech["id"])
assert r4["status"] == "clean" and r4["technicianId"] is None, "保洁完成房间应可用"
assert t4["status"] == "idle" and t4["roomId"] is None, "保洁完成技师应恢复绿色空闲"
print("保洁完成 OK，技师恢复空闲:", t4["status"], "房间:", r4["status"])

# 排队 + 带排队开单自动出队
s = post("/api/queue", name="排队先生")
q = s["queue"][-1]
assert q["name"] == "排队先生"
nq_before = len(s["queue"])
tech = find_idle_tech(s)
room = find_clean_room(s)
s = post("/api/sessions", technicianId=tech["id"], roomId=room["id"],
         serviceId=svc["id"], queueId=q["id"])
assert len(s["queue"]) == nq_before - 1, "带排队开单后应自动出队"
assert not any(x["id"] == q["id"] for x in s["queue"])
print("排队安排上钟自动出队 OK")

# 校验类错误
tech_busy = next(t for t in s["technicians"] if t["status"] == "busy")
r = client.post("/api/sessions", json={
    "technicianId": tech_busy["id"], "roomId": "r1",
    "serviceId": svc["id"]})
assert r.status_code == 400 and "不是空闲" in r.json()["detail"]

r = client.post("/api/queue", json={"name": "  "})
assert r.status_code == 400

# 休息 / 回岗
s = get()
idle = find_idle_tech(s)
s = post(f"/api/technicians/{idle['id']}/rest", resting=True)
assert next(x for x in s["technicians"] if x["id"] == idle["id"])["status"] == "resting"
s = post(f"/api/technicians/{idle['id']}/rest", resting=False)
assert next(x for x in s["technicians"] if x["id"] == idle["id"])["status"] == "idle"
print("休息/回岗 OK")

# 演示模式 + tick 自动流转（6秒后开始打扫，15秒后完成）
post("/api/reset")
s = post("/api/demo", enabled=True)
assert s["demo"] is True
print("演示模式开关 OK")

print("\n全部冒烟测试通过 ✅")
