import { Select } from "kiwivoca-frontend";

export function Default() {
  return (
    <div style={{ width: 280 }}>
      <Select label="학습 언어" defaultValue="en">
        <option value="en">영어</option>
        <option value="ja">일본어</option>
        <option value="ru">러시아어</option>
        <option value="ko">한국어</option>
      </Select>
    </div>
  );
}

export function WithHelper() {
  return (
    <div style={{ width: 280 }}>
      <Select
        label="복습 주기"
        helper="망각 곡선에 맞춰 자동 추천돼요"
        defaultValue="3"
      >
        <option value="1">매일</option>
        <option value="3">3일마다</option>
        <option value="7">매주</option>
      </Select>
    </div>
  );
}

export function WithError() {
  return (
    <div style={{ width: 280 }}>
      <Select label="덱 분류" error="분류를 선택해주세요" defaultValue="">
        <option value="" disabled>
          선택 안 함
        </option>
        <option value="toeic">토익</option>
        <option value="daily">생활 회화</option>
      </Select>
    </div>
  );
}
