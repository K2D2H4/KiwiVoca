import { TextField } from "kiwivoca-frontend";
import { Search, Mail } from "lucide-react";

export function Default() {
  return (
    <div className="w-72">
      <TextField
        label="이메일"
        placeholder="you@example.com"
        defaultValue="hong@kiwivoca.com"
      />
    </div>
  );
}

export function WithHelper() {
  return (
    <div className="w-72">
      <TextField
        label="덱 이름"
        placeholder="예: 토익 빈출 600"
        helper="학습 목록에 표시될 이름이에요"
        defaultValue="토익 빈출 600"
      />
    </div>
  );
}

export function WithError() {
  return (
    <div className="w-72">
      <TextField
        label="비밀번호"
        type="password"
        defaultValue="123"
        error="8자 이상 입력해주세요"
      />
    </div>
  );
}

export function WithIcon() {
  return (
    <div className="w-72">
      <TextField
        label="검색"
        leftIcon={<Search size={18} />}
        placeholder="단어 검색"
        defaultValue="apple"
      />
    </div>
  );
}
