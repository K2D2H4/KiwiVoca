// Avatar — 이니셜 기반 사용자 아바타. 이름에서 안정적으로 톤 선택.
interface AvatarProps {
  name?: string | null;
  size?: number;
  className?: string;
}

const TONES = [
  "bg-kiwi text-white",
  "bg-info text-white",
  "bg-bark text-white",
  "bg-kiwi-700 text-white",
  "bg-warning text-white",
];

export default function Avatar({ name, size = 40, className = "" }: AvatarProps) {
  const display = (name || "K").trim();
  const initial = display.slice(0, 1).toUpperCase();
  // 이름 기반 결정적 톤 선택
  const code = display.charCodeAt(0) || 0;
  const tone = TONES[code % TONES.length];

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold",
        tone,
        className,
      ].join(" ")}
    >
      {initial}
    </span>
  );
}
