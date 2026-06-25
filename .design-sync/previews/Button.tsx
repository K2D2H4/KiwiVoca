import { Button } from "kiwivoca-frontend";
import { Plus, ArrowRight, Trash2 } from "lucide-react";

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">단어 추가</Button>
      <Button variant="secondary">취소</Button>
      <Button variant="ghost">건너뛰기</Button>
      <Button variant="danger">덱 삭제</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">작게</Button>
      <Button size="md">보통</Button>
      <Button size="lg">크게</Button>
    </div>
  );
}

export function WithIcons() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button leftIcon={<Plus size={18} />}>새 카드</Button>
      <Button variant="secondary" rightIcon={<ArrowRight size={18} />}>
        다음 문제
      </Button>
      <Button variant="danger" leftIcon={<Trash2 size={18} />}>
        삭제
      </Button>
    </div>
  );
}

export function States() {
  return (
    <div className="flex w-64 flex-col gap-3">
      <Button loading>저장 중</Button>
      <Button disabled>비활성</Button>
      <Button variant="primary" fullWidth>
        학습 시작하기
      </Button>
    </div>
  );
}
