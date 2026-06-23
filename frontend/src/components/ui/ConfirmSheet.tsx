// 확인 다이얼로그 — Sheet + Button 프리미티브 위에 구축. 기존 API 유지.
import { useTranslation } from "react-i18next";
import Sheet from "./Sheet";
import Button from "./Button";

interface ConfirmSheetProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel,
  danger,
  loading,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onClose={onCancel} title={title} ariaLabel={title}>
      {message && <p className="-mt-1 text-body-sm text-seed/60">{message}</p>}
      <div className="mt-5 flex gap-2.5">
        <Button variant="secondary" fullWidth onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          fullWidth
          loading={loading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
