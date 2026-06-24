// 덱 카드 — 목록 그리드 항목. Card(interactive) + Badge(kind/언어쌍) + 카드수.
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Layers } from "lucide-react";
import { Card, Badge } from "../ui";
import { langLabel } from "../../lib/languages";
import type { Deck } from "../../types/deck";

export default function DeckCard({ deck }: { deck: Deck }) {
  const { t } = useTranslation();
  const isGrammar = deck.kind === "grammar";
  const count = deck.card_count ?? 0;

  return (
    <Link
      to={`/decks/${deck.id}`}
      className="group block rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-kiwi-400 focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
    >
      <Card
        interactive
        padding="md"
        className="flex h-full min-h-[140px] flex-col"
      >
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

        {/* 하단: 카드 수 */}
        <div className="mt-auto flex items-center gap-1.5 pt-3.5 text-body-sm font-bold text-seed/45">
          <Layers size={15} className="shrink-0 text-kiwi-500" />
          {t("deck.cardCount", { count })}
        </div>
      </Card>
    </Link>
  );
}
