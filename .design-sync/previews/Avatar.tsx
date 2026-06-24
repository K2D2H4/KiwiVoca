import { Avatar } from "kiwivoca-frontend";

export function Names() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      <Avatar name="민준" />
      <Avatar name="Sara" />
      <Avatar name="지우" />
      <Avatar name="K" />
      <Avatar name="Лев" />
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
      <Avatar name="지우" size={28} />
      <Avatar name="지우" size={40} />
      <Avatar name="지우" size={64} />
    </div>
  );
}
