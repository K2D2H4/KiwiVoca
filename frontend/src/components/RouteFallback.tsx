// 라우트 lazy 로딩 중 표시되는 풀스크린 키위 스피너.
import KiwiMark from "./KiwiMark";

export default function RouteFallback() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-cream">
      <div className="animate-float-y">
        <KiwiMark size={64} className="animate-pulse" />
      </div>
    </div>
  );
}
