// 카드 행 — 보기/인라인 편집 토글. 편집 시 term/reading/definition/example 폼.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2 } from "lucide-react";
import { Card, TextField, Button, IconButton } from "../ui";
import type { Card as CardType, UpdateCardPayload } from "../../types/deck";

interface CardEditorRowProps {
  card: CardType;
  index: number;
  onSave: (id: string | number, payload: UpdateCardPayload) => Promise<void>;
  onDelete: (id: string | number) => void;
  saving?: boolean;
}

export default function CardEditorRow({
  card,
  index,
  onSave,
  onDelete,
  saving,
}: CardEditorRowProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [term, setTerm] = useState(card.term);
  const [reading, setReading] = useState(card.reading ?? "");
  const [definition, setDefinition] = useState(card.definition);
  const [example, setExample] = useState(card.example ?? "");

  const reset = () => {
    setTerm(card.term);
    setReading(card.reading ?? "");
    setDefinition(card.definition);
    setExample(card.example ?? "");
  };

  const save = async () => {
    if (!term.trim() || !definition.trim()) return;
    await onSave(card.id, {
      term: term.trim(),
      reading: reading.trim() || undefined,
      definition: definition.trim(),
      example: example.trim() || undefined,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <li>
        <Card padding="sm" className="ring-2 ring-kiwi-300">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <TextField
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={t("card.term")}
            />
            <TextField
              value={reading}
              onChange={(e) => setReading(e.target.value)}
              placeholder={t("card.reading")}
            />
            <div className="sm:col-span-2">
              <TextField
                value={definition}
                onChange={(e) => setDefinition(e.target.value)}
                placeholder={t("card.definition")}
              />
            </div>
            <div className="sm:col-span-2">
              <TextField
                value={example}
                onChange={(e) => setExample(e.target.value)}
                placeholder={t("card.example")}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2.5">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                reset();
                setEditing(false);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={saving}
              disabled={!term.trim() || !definition.trim()}
              onClick={save}
            >
              {t("common.save")}
            </Button>
          </div>
        </Card>
      </li>
    );
  }

  return (
    <li>
      <Card padding="sm" className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-kiwi-100 text-caption font-bold text-kiwi-700">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="break-words font-display text-base font-bold text-seed">
              {card.term}
            </span>
            {card.reading && (
              <span className="text-caption font-bold text-bark">
                {card.reading}
              </span>
            )}
          </div>
          {card.definition.trim() && (
            <p className="mt-0.5 break-words text-body-sm text-seed/70">
              {card.definition}
            </p>
          )}
          {card.example && (
            <p className="mt-1 break-words border-l-2 border-kiwi-200 pl-2 text-caption italic text-seed/45">
              {card.example}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton
            label={t("common.edit")}
            variant="ghost"
            onClick={() => setEditing(true)}
          >
            <Pencil size={18} />
          </IconButton>
          <IconButton
            label={t("common.delete")}
            variant="ghost"
            className="text-pop hover:bg-pop-soft"
            onClick={() => onDelete(card.id)}
          >
            <Trash2 size={18} />
          </IconButton>
        </div>
      </Card>
    </li>
  );
}
