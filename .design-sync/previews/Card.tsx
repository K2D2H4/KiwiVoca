import { Card, Badge } from "kiwivoca-frontend";

function DeckSummary({ title, badge }: { title: string; badge: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 180 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
        <Badge tone="kiwi" size="sm">
          {badge}
        </Badge>
      </div>
      <span style={{ fontSize: 13, opacity: 0.6 }}>단어 124개 · 78% 완료</span>
    </div>
  );
}

export function Elevations() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
      <Card elevation="flat">
        <DeckSummary title="기초 영단어" badge="flat" />
      </Card>
      <Card elevation="sm">
        <DeckSummary title="토익 빈출 600" badge="sm" />
      </Card>
      <Card elevation="md">
        <DeckSummary title="수능 필수" badge="md" />
      </Card>
      <Card elevation="lg">
        <DeckSummary title="비즈니스 회화" badge="lg" />
      </Card>
    </div>
  );
}

export function Interactive() {
  return (
    <div style={{ maxWidth: 280 }}>
      <Card interactive elevation="md">
        <DeckSummary title="토익 빈출 600" badge="학습 시작" />
      </Card>
    </div>
  );
}

export function Paddings() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
      <Card padding="sm" elevation="sm">
        <DeckSummary title="여행 회화" badge="sm" />
      </Card>
      <Card padding="lg" elevation="sm">
        <DeckSummary title="여행 회화" badge="lg" />
      </Card>
    </div>
  );
}
