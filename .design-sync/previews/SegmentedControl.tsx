import { SegmentedControl } from "kiwivoca-frontend";

export function Modes() {
  return (
    <SegmentedControl
      ariaLabel="학습 모드"
      layoutId="seg-mode"
      value="카드"
      onChange={() => {}}
      segments={[
        { value: "카드", label: "카드" },
        { value: "타이핑", label: "타이핑" },
        { value: "선택", label: "선택" },
      ]}
    />
  );
}

export function Languages() {
  return (
    <SegmentedControl
      ariaLabel="표시 언어"
      layoutId="seg-lang"
      value="한국어"
      onChange={() => {}}
      segments={[
        { value: "한국어", label: "한국어" },
        { value: "영어", label: "영어" },
      ]}
    />
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <SegmentedControl
        ariaLabel="정렬 (작게)"
        layoutId="seg-sort-sm"
        size="sm"
        value="최신"
        onChange={() => {}}
        segments={[
          { value: "최신", label: "최신" },
          { value: "이름", label: "이름" },
        ]}
      />
      <SegmentedControl
        ariaLabel="정렬 (보통)"
        layoutId="seg-sort-md"
        size="md"
        value="최신"
        onChange={() => {}}
        segments={[
          { value: "최신", label: "최신" },
          { value: "이름", label: "이름" },
        ]}
      />
    </div>
  );
}
