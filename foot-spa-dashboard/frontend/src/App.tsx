import { useEffect, useState } from "react";
import { useRealtime } from "./hooks/useRealtime";
import BigScreen from "./components/BigScreen";
import FrontDesk from "./components/FrontDesk";

// 大屏：#/screen（默认）　前台平板：#/desk
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return hash.startsWith("#/desk") ? "desk" : "screen";
}

export default function App() {
  const route = useHashRoute();
  const { snap, connected, now } = useRealtime();

  if (!snap) {
    return (
      <div className="loading">
        <div className="loading-dot" />
        正在连接运营中心…
      </div>
    );
  }

  return (
    <>
      {!connected && <div className="conn-banner">实时连接中断，正在重连…（当前为轮询数据）</div>}
      {route === "screen" ? (
        <BigScreen snap={snap} now={now} />
      ) : (
        <FrontDesk snap={snap} now={now} />
      )}
    </>
  );
}
