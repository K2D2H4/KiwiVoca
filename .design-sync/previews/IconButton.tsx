import { IconButton } from "kiwivoca-frontend";
import { Heart, Plus, Settings } from "lucide-react";

export function Variants() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <IconButton label="즐겨찾기" variant="ghost">
        <Heart size={20} />
      </IconButton>
      <IconButton label="단어 추가" variant="solid">
        <Plus size={20} />
      </IconButton>
      <IconButton label="설정" variant="soft">
        <Settings size={20} />
      </IconButton>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <IconButton label="단어 추가" variant="solid" size="sm">
        <Plus size={18} />
      </IconButton>
      <IconButton label="단어 추가" variant="solid" size="md">
        <Plus size={22} />
      </IconButton>
    </div>
  );
}
