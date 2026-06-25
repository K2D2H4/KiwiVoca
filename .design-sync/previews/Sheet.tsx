import { Sheet, Button } from "kiwivoca-frontend";
import { Layers, Pencil, Zap } from "lucide-react";

// Sheet renders position:fixed inset-0 (bottom sheet on mobile / centered modal).
// translateZ(0) makes the Stage the containing block so the backdrop + sheet stay
// inside the card instead of escaping to the viewport.
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      position: "relative",
      width: 420,
      height: 500,
      transform: "translateZ(0)",
      overflow: "hidden",
      borderRadius: 24,
    }}
  >
    {children}
  </div>
);

const ModeRow = ({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) => (
  <button
    type="button"
    style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      width: "100%",
      padding: "14px 16px",
      borderRadius: 18,
      background: "rgba(120, 180, 90, 0.08)",
      textAlign: "left",
      cursor: "pointer",
    }}
  >
    <span
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
        borderRadius: 12,
        background: "rgba(120, 180, 90, 0.16)",
        color: "#5a8a36",
        flexShrink: 0,
      }}
    >
      {icon}
    </span>
    <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontWeight: 700, fontSize: 15, color: "#2f3a23" }}>
        {title}
      </span>
      <span style={{ fontSize: 13, color: "rgba(47, 58, 35, 0.55)" }}>
        {desc}
      </span>
    </span>
  </button>
);

export function ModePicker() {
  return (
    <Stage>
      <Sheet open title="학습 모드 선택" onClose={() => {}}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ModeRow
            icon={<Layers size={20} />}
            title="플래시카드"
            desc="카드를 넘기며 뜻을 떠올려요"
          />
          <ModeRow
            icon={<Pencil size={20} />}
            title="타이핑 퀴즈"
            desc="직접 입력하며 외워요"
          />
          <ModeRow
            icon={<Zap size={20} />}
            title="스피드 4지선다"
            desc="빠르게 보기에서 골라요"
          />
          <div style={{ marginTop: 6 }}>
            <Button variant="primary" fullWidth>
              학습 시작하기
            </Button>
          </div>
        </div>
      </Sheet>
    </Stage>
  );
}
