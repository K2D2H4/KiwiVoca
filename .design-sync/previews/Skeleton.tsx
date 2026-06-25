import { Skeleton } from "kiwivoca-frontend";

export function CardSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        maxWidth: 320,
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, width: "100%" }}>
        <Skeleton rounded="full" style={{ width: 40, height: 40, flexShrink: 0 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          <Skeleton rounded="md" style={{ width: "70%", height: 12 }} />
          <Skeleton rounded="md" style={{ width: "45%", height: 12 }} />
        </div>
      </div>
      <Skeleton rounded="lg" style={{ width: "100%", height: 56 }} />
    </div>
  );
}

export function Shapes() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
      <Skeleton rounded="md" style={{ width: 64, height: 64 }} />
      <Skeleton rounded="lg" style={{ width: 64, height: 64 }} />
      <Skeleton rounded="xl" style={{ width: 64, height: 64 }} />
      <Skeleton rounded="full" style={{ width: 64, height: 64 }} />
    </div>
  );
}
