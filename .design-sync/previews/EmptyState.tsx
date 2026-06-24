import { EmptyState, Button } from "kiwivoca-frontend";
import { Plus, RotateCcw } from "lucide-react";

const Center = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "flex", justifyContent: "center", width: 360 }}>
    {children}
  </div>
);

export function NoDecks() {
  return (
    <Center>
      <EmptyState
        mood="happy"
        title="아직 덱이 없어요"
        description="첫 단어장을 만들어 학습을 시작해 보세요."
        action={
          <Button variant="primary" fullWidth leftIcon={<Plus size={18} />}>
            첫 덱 만들기
          </Button>
        }
      />
    </Center>
  );
}

export function Error() {
  return (
    <Center>
      <EmptyState
        mood="sad"
        title="불러오지 못했어요"
        description="네트워크 상태를 확인하고 다시 시도해 주세요."
        action={
          <Button
            variant="secondary"
            fullWidth
            leftIcon={<RotateCcw size={18} />}
          >
            다시 시도
          </Button>
        }
      />
    </Center>
  );
}

export function Compact() {
  return (
    <Center>
      <EmptyState
        compact
        mood="sleepy"
        title="오늘 복습 끝!"
        description="내일 다시 만나요."
      />
    </Center>
  );
}
