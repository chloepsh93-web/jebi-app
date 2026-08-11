/**
 * 저장소 계층 — 지금은 localStorage.
 * B단계(네이티브)에서 AsyncStorage/SQLite로 교체하기 쉽게 인터페이스 격리.
 */

const KEY_YEONS = "jebi.yeons";
const KEY_MAEUMS = "jebi.maeums";
const KEY_ONBOARDED = "jebi.onboarded";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error("저장 실패", e);
  }
}

export const store = {
  getYeons: () => read(KEY_YEONS, []),
  getMaeums: () => read(KEY_MAEUMS, []),
  saveYeons: (y) => write(KEY_YEONS, y),
  saveMaeums: (m) => write(KEY_MAEUMS, m),

  isOnboarded: () => read(KEY_ONBOARDED, false),
  setOnboarded: (v) => write(KEY_ONBOARDED, v),

  // 인연 찾기/생성 (이름 기준 매칭)
  upsertYeon(name, relationTag, gender) {
    const yeons = this.getYeons();
    let y = yeons.find((v) => v.name === name);
    if (!y) {
      y = {
        id: "y_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        name,
        relationTag: relationTag || "지인",
        avatarGender: gender || null,
        createdAt: Date.now(),
      };
      yeons.push(y);
      this.saveYeons(yeons);
    }
    return y;
  },

  addMaeum(maeum) {
    const maeums = this.getMaeums();
    maeums.push(maeum);
    this.saveMaeums(maeums);
    return maeum;
  },

  updateMaeum(id, patch) {
    const maeums = this.getMaeums();
    const idx = maeums.findIndex((m) => m.id === id);
    if (idx >= 0) {
      maeums[idx] = { ...maeums[idx], ...patch };
      this.saveMaeums(maeums);
      return maeums[idx];
    }
    return null;
  },

  reset() {
    localStorage.removeItem(KEY_YEONS);
    localStorage.removeItem(KEY_MAEUMS);
    localStorage.removeItem(KEY_ONBOARDED);
  },
};
