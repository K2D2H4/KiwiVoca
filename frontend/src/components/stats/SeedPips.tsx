// avg_box(0~5) 시각화 — 키위 씨앗 5알. 익은 만큼 진한 씨앗으로 채워짐.
// 반올림이 아니라 채워진 씨앗 = floor(avg_box), 마지막 한 알은 소수부 밝기.
interface SeedPipsProps {
  value: number; // 0~5
  max?: number;
  label?: string; // aria
}

export default function SeedPips({ value, max = 5, label }: SeedPipsProps) {
  const clamped = Math.max(0, Math.min(max, value));
  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={label ?? `${clamped.toFixed(1)} / ${max}`}
    >
      {Array.from({ length: max }).map((_, i) => {
        const fill = Math.max(0, Math.min(1, clamped - i)); // 0~1 이 칸 채움 정도
        return (
          <span
            key={i}
            className="h-3 w-3 rounded-full ring-1 ring-inset ring-seed/10"
            style={{
              backgroundColor:
                fill <= 0
                  ? "rgb(var(--ink-100))"
                  : "#5FA63C",
              opacity: fill <= 0 ? 1 : 0.35 + fill * 0.65,
            }}
          />
        );
      })}
    </div>
  );
}
