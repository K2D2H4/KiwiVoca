import { SpeakButton } from "kiwivoca-frontend";

const Row = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 16,
      padding: "14px 18px",
      borderRadius: 20,
      background: "rgba(120, 180, 90, 0.08)",
    }}
  >
    {children}
  </div>
);

export function Variants() {
  return (
    <Row>
      <SpeakButton text="apple" lang="en" variant="ghost" />
      <SpeakButton text="apple" lang="en" variant="solid" />
      <SpeakButton text="apple" lang="en" variant="soft" />
    </Row>
  );
}

export function Sizes() {
  return (
    <Row>
      <SpeakButton text="apple" lang="en" variant="soft" size="sm" />
      <SpeakButton text="apple" lang="en" variant="soft" size="md" />
    </Row>
  );
}
