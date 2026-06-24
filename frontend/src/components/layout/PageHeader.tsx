// 페이지 헤더 — 뒤로가기 + 제목 + 우측 액션 슬롯. 모바일/데스크탑 공용.
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import IconButton from "../ui/IconButton";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  onBack,
  right,
}: PageHeaderProps) {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-header flex items-center gap-2 border-b border-border bg-cream/85 px-3 py-2.5 backdrop-blur-md">
      {onBack && (
        <IconButton
          label={t("common.back")}
          variant="ghost"
          onClick={onBack}
          className="-ml-1"
        >
          <ChevronLeft size={24} strokeWidth={2.4} />
        </IconButton>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-h3 font-bold text-seed">{title}</h1>
        {subtitle && (
          <p className="truncate text-caption text-seed/50">{subtitle}</p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
  );
}
