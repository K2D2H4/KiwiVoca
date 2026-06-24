// 탐색 덱 미리보기 — 공개 덱 읽기 전용. 메타 + 카드 목록(SpeakButton) + "내 단어장으로 복사".
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Copy, Layers } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import {
  Button,
  Card,
  Badge,
  SpeakButton,
  Skeleton,
  EmptyState,
  useToast,
} from "../components/ui";
import { langLabel } from "../lib/languages";
import { useDeck } from "../hooks/useDecks";
import { useCards } from "../hooks/useCards";
import { useCopyDeck } from "../hooks/useSharing";

export default function ExploreDeck() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { id = "" } = useParams();

  const { data: deck, isLoading: deckLoading, isError } = useDeck(id);
  const { data: cards, isLoading: cardsLoading } = useCards(id);
  const copyDeck = useCopyDeck();

  const cardCount = cards?.length ?? deck?.card_count ?? 0;

  const onCopy = async () => {
    try {
      const created = await copyDeck.mutateAsync(id);
      toast.success(t("explore.copiedToast"));
      navigate(`/decks/${created.id}`);
    } catch {
      toast.error(t("explore.copyError"));
    }
  };

  if (isError) {
    return (
      <div className="min-h-[100dvh]">
        <PageHeader title={t("explore.detail")} onBack={() => navigate("/explore")} />
        <div className="px-5 pt-16">
          <EmptyState
            mood="sad"
            title={t("explore.notFound")}
            description={t("explore.notFoundHint")}
            action={
              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => navigate("/explore")}
              >
                {t("explore.backToGallery")}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]">
      <PageHeader
        title={deck?.title || t("explore.detail")}
        onBack={() => navigate("/explore")}
      />

      <div className="mx-auto max-w-screen-sm px-5 pt-4">
        {/* 메타 카드 — 코랄 톤으로 "공유된 덱" 강조 */}
        {deckLoading ? (
          <Skeleton className="h-32 w-full" rounded="xl" />
        ) : deck ? (
          <section className="seed-dots rounded-3xl bg-pop p-5 text-white shadow-pop">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="outline" size="sm" className="text-white ring-white/40">
                {deck.kind === "grammar"
                  ? t("deck.kindGrammar")
                  : t("deck.kindVocab")}
              </Badge>
              <Badge tone="outline" size="sm" className="text-white ring-white/40">
                {langLabel(deck.lang_term)}
                <ArrowRight size={11} className="mx-0.5 opacity-60" />
                {langLabel(deck.lang_def)}
              </Badge>
            </div>
            {deck.description && (
              <p className="mt-3 text-body-sm text-white/90">{deck.description}</p>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-body-sm font-bold text-white/90">
              <Layers size={15} />
              {t("deck.cardCount", { count: cardCount })}
            </p>
          </section>
        ) : null}

        {/* 복사 CTA */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="mt-3"
          leftIcon={<Copy size={19} />}
          loading={copyDeck.isPending}
          disabled={!deck}
          onClick={onCopy}
        >
          {t("explore.copyToMyDecks")}
        </Button>
        <p className="mt-2 text-center text-caption text-seed/45">
          {t("explore.copyHint")}
        </p>

        {/* 카드 미리보기 — 읽기 전용 */}
        <div className="mt-5 pb-4">
          <p className="mb-2.5 text-caption font-bold uppercase tracking-wide text-pop-dark">
            {t("explore.previewTitle")}
          </p>
          {cardsLoading ? (
            <ul className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i}>
                  <Skeleton className="h-16 w-full" rounded="xl" />
                </li>
              ))}
            </ul>
          ) : cards && cards.length > 0 ? (
            <ul className="space-y-2.5">
              {cards.map((card) => (
                <li key={card.id}>
                  <Card padding="sm" elevation="sm" className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-display text-body font-bold text-seed">
                          {card.term}
                        </span>
                        <SpeakButton
                          text={card.term}
                          lang={deck?.lang_term}
                          size="sm"
                        />
                      </div>
                      {card.reading && (
                        <p className="truncate text-caption text-seed/45">
                          {card.reading}
                        </p>
                      )}
                      <p className="mt-0.5 text-body-sm text-seed/70">
                        {card.definition}
                      </p>
                      {card.example && (
                        <p className="mt-1 line-clamp-2 text-caption italic text-seed/45">
                          {card.example}
                        </p>
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <Card padding="md">
              <EmptyState mood="sleepy" compact title={t("explore.noCards")} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
