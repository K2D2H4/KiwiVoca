import { Badge } from "kiwivoca-frontend";
import { Sparkles } from "lucide-react";

export function Tones() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
      <Badge tone="kiwi">신규</Badge>
      <Badge tone="success">완료</Badge>
      <Badge tone="warning">진행중</Badge>
      <Badge tone="info">정보</Badge>
      <Badge tone="pop">인기</Badge>
      <Badge tone="neutral">보관</Badge>
      <Badge tone="outline">기본</Badge>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      <Badge tone="kiwi" size="sm">
        단어 24개
      </Badge>
      <Badge tone="kiwi" size="md">
        단어 124개
      </Badge>
    </div>
  );
}

export function WithIcon() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
      <Badge tone="pop" leftIcon={<Sparkles size={13} />}>
        오늘의 추천
      </Badge>
      <Badge tone="success" leftIcon={<Sparkles size={13} />}>
        연속 7일
      </Badge>
    </div>
  );
}
