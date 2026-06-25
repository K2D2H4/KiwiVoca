import { useEffect } from "react";
import { ToastProvider, useToast } from "kiwivoca-frontend";

// The Toast stack enters with a framer-motion opacity/transform animation. In
// the headless capture the screenshot can fire while that entrance is still at
// opacity 0 (instant networkidle when fonts are cached), so the card comes up
// blank. We force the settled visual state with an !important style override
// (beats framer-motion's inline opacity) so the static card always shows the
// real toasts — success / error / info.
function Demo() {
  const toast = useToast();
  useEffect(() => {
    toast.success("저장했어요!");
    toast.error("네트워크 오류가 발생했어요");
    toast.info("새 단어 5개를 불러왔어요");
  }, []);
  return null;
}

export function Toasts() {
  return (
    <div
      style={{
        position: "relative",
        width: 420,
        height: 220,
        transform: "translateZ(0)",
        overflow: "hidden",
        borderRadius: 24,
      }}
    >
      <style>{`[role="status"]{opacity:1 !important;transform:none !important;}`}</style>
      <ToastProvider>
        <Demo />
      </ToastProvider>
    </div>
  );
}
