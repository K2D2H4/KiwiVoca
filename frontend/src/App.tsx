// 키위보카 라우팅 — /login, /signup (공개) · 보호 라우트는 AppShell로 감쌈.
// 화면별 코드 스플리팅: 각 페이지를 React.lazy로 분리, Suspense 키위 스피너 fallback.
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import RouteFallback from "./components/RouteFallback";

// 셸은 즉시 필요(레이아웃) — eager 유지
import AppShell from "./components/layout/AppShell";

// 화면들은 라우트 진입 시 청크 로드
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const OAuthCallback = lazy(() => import("./pages/OAuthCallback"));
const Home = lazy(() => import("./pages/Home"));
const DeckNew = lazy(() => import("./pages/DeckNew"));
const ImportPhoto = lazy(() => import("./pages/ImportPhoto"));
const GrammarCreate = lazy(() => import("./pages/GrammarCreate"));
const GrammarPractice = lazy(() => import("./pages/GrammarPractice"));
const DeckDetail = lazy(() => import("./pages/DeckDetail"));
const StudyHub = lazy(() => import("./pages/StudyHub"));
const StudySession = lazy(() => import("./pages/StudySession"));
const Stats = lazy(() => import("./pages/Stats"));
const Profile = lazy(() => import("./pages/Profile"));
const Explore = lazy(() => import("./pages/Explore"));
const ExploreDeck = lazy(() => import("./pages/ExploreDeck"));
const Call = lazy(() => import("./pages/Call"));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          {/* OAuth 콜백 — 공개(미인증) 라우트, 셸·보호 밖. 토큰 저장 후 홈으로 */}
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Home />} />
              <Route path="/decks/new" element={<DeckNew />} />
              <Route path="/import" element={<ImportPhoto />} />
              <Route path="/grammar/new" element={<GrammarCreate />} />
              <Route path="/decks/:id" element={<DeckDetail />} />
              <Route path="/study" element={<StudyHub />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/explore/:id" element={<ExploreDeck />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            {/* 학습 세션·전화는 몰입형 풀스크린(탭바 없음) — 셸 밖에 둠 */}
            {/* 멀티덱 + 옵션 진입(decks/scope/limit/mode 쿼리) */}
            <Route path="/study/play" element={<StudySession />} />
            {/* 문법 연습 — 몰입형 풀스크린(필터/옵션 시트 → 문제 풀이 → 결과) */}
            <Route path="/grammar/practice" element={<GrammarPractice />} />
            {/* 레거시 단일 덱 진입 — 하위 호환 유지 */}
            <Route path="/study/:deckId/:mode" element={<StudySession />} />
            <Route path="/call/:deckId" element={<Call />} />
          </Route>
          {/* 알 수 없는 경로는 홈으로(보호 라우트가 미인증 시 /login 처리) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
