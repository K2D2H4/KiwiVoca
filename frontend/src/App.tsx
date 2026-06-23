// 키위보카 라우팅 — /login, /signup (공개) · 보호 라우트는 AppShell로 감쌈
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/layout/AppShell";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import DeckNew from "./pages/DeckNew";
import ImportPhoto from "./pages/ImportPhoto";
import DeckDetail from "./pages/DeckDetail";
import StudyHub from "./pages/StudyHub";
import StudySession from "./pages/StudySession";
import Profile from "./pages/Profile";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Home />} />
            <Route path="/decks/new" element={<DeckNew />} />
            <Route path="/import" element={<ImportPhoto />} />
            <Route path="/decks/:id" element={<DeckDetail />} />
            <Route path="/study" element={<StudyHub />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          {/* 학습 세션은 몰입형 풀스크린(탭바 없음) — 셸 밖에 둠 */}
          <Route path="/study/:deckId/:mode" element={<StudySession />} />
        </Route>
        {/* 알 수 없는 경로는 홈으로(보호 라우트가 미인증 시 /login 처리) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
