// 관대한 채점 — 트림/소문자/다중공백 축약/문장부호·악센트 제거 후 비교
export function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // 결합 악센트 제거 (café → cafe)
    .replace(/[.,!?;:'"()[\]{}…·~\-_/\\]/g, " ") // 문장부호 → 공백
    .replace(/\s+/g, " ") // 다중 공백 축약
    .trim();
}

export function isAnswerCorrect(input: string, expected: string): boolean {
  const a = normalizeAnswer(input);
  if (!a) return false;
  return a === normalizeAnswer(expected);
}

// 배열 셔플 (Fisher-Yates) — distractor/매칭 그리드 무작위화
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
