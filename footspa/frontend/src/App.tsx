import { BrowserRouter, Route, Routes } from "react-router-dom";
import { SpaProvider } from "./lib/store";
import { NavBar } from "./components/NavBar";
import { BigScreen } from "./pages/BigScreen";
import { FrontDesk } from "./pages/FrontDesk";
import { OvertimeAlertModal } from "./components/OvertimeAlertModal";

export default function App() {
  return (
    <SpaProvider>
      <BrowserRouter>
        <div className="min-h-full">
          <NavBar />
          <Routes>
            <Route path="/" element={<BigScreen />} />
            <Route path="/desk" element={<FrontDesk />} />
          </Routes>
          {/* 全局：排队超 20 分钟自动弹窗（两个端都生效） */}
          <OvertimeAlertModal />
        </div>
      </BrowserRouter>
    </SpaProvider>
  );
}
