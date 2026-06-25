import { ProgressBar } from "kiwivoca-frontend";

export function Values() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 280 }}>
      <ProgressBar value={25} label="오늘 학습 진행률 25%" />
      <ProgressBar value={60} label="오늘 학습 진행률 60%" />
      <ProgressBar value={90} label="오늘 학습 진행률 90%" />
    </div>
  );
}

export function Tones() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 280 }}>
      <ProgressBar value={70} tone="kiwi" label="암기 진행률" />
      <ProgressBar value={70} tone="pop" label="연속 학습 목표" />
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 280 }}>
      <ProgressBar value={55} size="sm" label="복습 진행률 (작게)" />
      <ProgressBar value={55} size="md" label="복습 진행률 (보통)" />
    </div>
  );
}
