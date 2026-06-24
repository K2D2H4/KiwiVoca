import { ConfirmSheet } from "kiwivoca-frontend";

// ConfirmSheet renders a Sheet (position: fixed inset-0 overlay). A `transform`
// on the wrapper makes it the containing block for the fixed descendant, so the
// backdrop + bottom sheet stay inside the card instead of escaping the viewport.
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      position: "relative",
      width: 420,
      height: 420,
      transform: "translateZ(0)",
      overflow: "hidden",
      borderRadius: 28,
    }}
  >
    {children}
  </div>
);

export function DeleteDeck() {
  return (
    <Stage>
      <ConfirmSheet
        open
        title="덱을 삭제할까요?"
        message="이 덱과 포함된 모든 카드가 영구적으로 삭제돼요. 되돌릴 수 없어요."
        confirmLabel="삭제"
        danger
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    </Stage>
  );
}
