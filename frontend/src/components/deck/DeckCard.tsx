// 덱 카드 — 목록 그리드 항목. Card(interactive) + Badge(kind/언어쌍) + 카드수.
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, GraduationCap, Layers } from "lucide-react";
import { Card, Badge } from "../ui";
import { langLabel } from "../../lib/languages";
import type { Deck } from "../../types/deck";

interface DeckCardProps {
  deck: Deck;
  // 선택 모드 — 병합용. 제공 시 Link 대신 선택 토글 버튼으로 렌더.
  selectable?: boolean;
  selected?: boolean;
  // 다른 종류(kind)라 합칠 수 없는 덱 — 흐리게 + 선택 불가
  disabled?: boolean;
  onToggleSelect?: (id: string | number) => void;
}

export default function DeckCard({
  deck,
  selectable,
  selected,
  disabled,
  onToggleSelect,
}: DeckCardProps) {
  const { t } = useTranslation();
  const isGrammar = deck.kind === "grammar";
  // 문법 덱은 card_count=0, grammar_count 에 항목 수가 담김
  const count = isGrammar ? deck.grammar_count ?? 0 : deck.card_count ?? 0;

  const inner = (
    <Card
      interactive
      padding="md"
      className={[
        "flex h-full min-h-[140px] flex-col transition",
        selectable && selected ? "ring-2 ring-kiwi shadow-kiwi-glow" : "",
      ].join(" ")}
    >
      {/* 선택 모드 체크 마크 — 우상단 오버레이 */}
      {selectable && (
        <span
          className={[
            "absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 transition",
            selected
              ? "border-kiwi bg-kiwi text-white"
              : "border-ink-300 bg-surface/90 text-transparent",
          ].join(" ")}
        >
          <Check size={15} strokeWidth={3} />
        </span>
      )}
      {renderBody()}
    </Card>
  );

  function renderBody() {
    return (
      <>
        {/* 상단: kind 칩 + 언어쌍 */}
        <div className="mb-3 flex items-center gap-1.5">
          <Badge tone={isGrammar ? "neutral" : "kiwi"} size="sm">
            {isGrammar ? t("deck.kindGrammar") : t("deck.kindVocab")}
          </Badge>
          <Badge tone="outline" size="sm" className="ml-auto">
            <span className="max-w-[4.5rem] truncate">
              {langLabel(deck.lang_term)}
            </span>
            <ArrowRight size={11} className="mx-0.5 shrink-0 opacity-50" />
            <span className="max-w-[4.5rem] truncate">
              {langLabel(deck.lang_def)}
            </span>
          </Badge>
        </div>

        {/* 제목 + 설명 */}
        <h3 className="line-clamp-2 font-display text-[17px] font-bold leading-snug text-seed">
          {deck.title}
        </h3>
        {deck.description && (
          <p className="mt-1 line-clamp-1 text-body-sm text-seed/50">
            {deck.description}
          </p>
        )}

        {/* 하단: 카드 수(단어) / 항목 수(문법) */}
        <div className="mt-auto flex items-center gap-1.5 pt-3.5 text-body-sm font-bold text-seed/45">
          {isGrammar ? (
            <GraduationCap size={15} className="shrink-0 text-bark" />
          ) : (
            <Layers size={15} className="shrink-0 text-kiwi-500" />
          )}
          {isGrammar
            ? t("grammar.itemCount", { count })
            : t("deck.cardCount", { count })}
        </div>
      </>
    );
  }

  // 선택 모드: 네비게이션 대신 선택 토글 버튼
  if (selectable) {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={!!selected}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        onClick={() => !disabled && onToggleSelect?.(deck.id)}
        className={[
          "group relative block w-full rounded-3xl text-left outline-none transition focus-visible:ring-2 focus-visible:ring-kiwi-400 focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
          disabled ? "cursor-not-allowed opacity-45 saturate-50" : "",
        ].join(" ")}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      to={`/decks/${deck.id}`}
      className="group relative block rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-kiwi-400 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
    >
      {inner}
    </Link>
  );
}
