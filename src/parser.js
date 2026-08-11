/**
 * 제비 규칙 기반 파서 (JS 이식본)
 * parser_rule.py를 이식. 실제 문자 4건 + 합성 16건에서 검증된 로직.
 */

const BANKS = ["카카오뱅크", "케이뱅크", "새마을", "우체국", "국민", "신한", "우리", "하나", "농협",
  "기업", "카카오", "토스", "SC", "씨티", "부산", "대구", "광주", "전북", "경남", "수협", "산업", "신협"];

export function parseEvent(text) {
  if (/(訃告|부고|별세|소천|돌아가|명복|빈소|발인|상주|조의|부친상|모친상)/.test(text)) return "부고";
  if (/(돌잔치|첫돌|첫 생일|첫 번째 생일|돌 잔치)/.test(text) ||
      /태어난\s*지\s*(?:1년|일\s*년|열두\s*달)/.test(text) ||
      /(?:첫|1)\s*번째\s*생(?:일|신)/.test(text)) return "돌잔치";
  if (/(결혼|청첩|화촉|부부의 연|성혼)/.test(text)) return "결혼";
  if (/(생신|생일|환갑|칠순|회갑|고희|팔순|만수무강)/.test(text)) return "생일";
  if (/(오픈|개업|개원|창업|집들이|이전)/.test(text)) return "기타";
  return null;
}

export function parseDate(text, event) {
  if (event === "부고") {
    const m = text.match(/발인\s*[은는]?\s*[:：]?\s*(?:(20\d{2})년?\s*)?(\d{1,2})\s*[/월.\-]\s*(\d{1,2})\s*일?/);
    if (m) {
      const y = m[1] ? parseInt(m[1]) : null;
      const mo = parseInt(m[2]), d = parseInt(m[3]);
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31)
        return y ? `${y}-${pad(mo)}-${pad(d)}` : `????-${pad(mo)}-${pad(d)}`;
    }
  }
  let m = text.match(/(20\d{2})[년.\-/\s]+\s*(\d{1,2})[월.\-/\s]+\s*(\d{1,2})\s*일?/);
  if (m) {
    const y = parseInt(m[1]), mo = parseInt(m[2]), d = parseInt(m[3]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  m = text.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (m) {
    const mo = parseInt(m[1]), d = parseInt(m[2]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `????-${pad(mo)}-${pad(d)}`;
  }
  m = text.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (m) {
    const mo = parseInt(m[1]), d = parseInt(m[2]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `????-${pad(mo)}-${pad(d)}`;
  }
  return null;
}

export function parseTime(text) {
  let m = text.match(/(오전|오후|저녁|밤|낮)?\s*(\d{1,2})\s*시\s*반/);
  if (m) {
    const mer = m[1], h = parseInt(m[2]);
    const add = (["오후", "저녁", "밤"].includes(mer) && h !== 12) ? 12 : 0;
    return `${pad(h + add)}:30`;
  }
  m = text.match(/(오전|오후|AM|PM|am|pm|저녁|밤|낮)\s*(\d{1,2})\s*[:시]\s*(\d{1,2})?/);
  if (m) {
    const mer = m[1], h = parseInt(m[2]);
    const mi = m[3] ? parseInt(m[3]) : 0;
    let add = (["오후", "PM", "pm", "저녁", "밤"].includes(mer) && h !== 12) ? 12 : 0;
    if (mer === "낮" && h !== 12) add = 0;
    let h24 = h + add; if (h24 === 24) h24 = 12;
    return `${pad(h24)}:${pad(mi)}`;
  }
  m = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (m) return `${pad(parseInt(m[1]))}:${m[2]}`;
  m = text.match(/(오전|오후|저녁|밤|낮)?\s*(\d{1,2})\s*시/);
  if (m) {
    const mer = m[1], h = parseInt(m[2]);
    const add = (["오후", "저녁", "밤"].includes(mer) && h !== 12) ? 12 : 0;
    return `${pad(h + add)}:00`;
  }
  // 정오
  if (/정오/.test(text)) return "12:00";
  return null;
}

export function parseAccount(text) {
  const bankPat = BANKS.slice().sort((a, b) => b.length - a.length).join("|");
  const re = new RegExp(`(${bankPat})(은행|뱅크)?\\s*([\\d]{2,6}[-\\s]?[\\d]{2,6}[-\\s]?[\\d]{2,7})`);
  const m = text.match(re);
  if (m) {
    let bank = m[1] + (m[2] || "");
    if (!m[2] && ["국민", "신한", "우리", "하나", "기업", "농협"].includes(bank)) bank += "은행";
    const num = m[3].replace(/\s/g, "");
    return `${bank} ${num}`;
  }
  return null;
}

function stripJosa(name) {
  for (const j of ["이가", "께서", "님"])
    if (name.endsWith(j) && name.length - j.length >= 2) return name.slice(0, -j.length);
  for (const j of ["가", "이"])
    if (name.endsWith(j) && name.length - j.length >= 3) return name.slice(0, -j.length);
  return name;
}

export function parseName(text, event, account) {
  if (account) {
    // 예금주 라벨 우선
    const m2 = text.match(/예금주\s*[:：]?\s*([가-힣]{2,4})/);
    if (m2) return m2[1];
    const acctTail = account.split(" ").pop();
    const re = new RegExp(`${escapeRe(acctTail)}[^가-힣]*([가-힣]{2,4})`);
    const m = text.match(re);
    if (m && m[1] !== "예금주") return m[1];
  }

  if (event === "부고") {
    let m = text.match(/상주\s*[:：]?\s*([가-힣]{2,4})/);
    if (m) return m[1];
    m = text.match(/([가-힣]{2,4})\s*\([^)]*\)\s*(?:부친|모친|부모)/);
    if (m) return m[1];
  }

  if (event === "결혼") {
    const groom = text.match(/신랑\s*[:：]?\s*([가-힣]{2,4})/);
    const bride = text.match(/신부\s*[:：]?\s*([가-힣]{2,4})/);
    if (/신랑측/.test(text) && groom) return groom[1];
    if (/신부측/.test(text) && bride) return bride[1];
    let m = text.match(/([가-힣]{2,4})\s*(?:군|양)/);
    if (m) return m[1];
    m = text.match(/([가-힣]{2,4})\s*[·❤♥&]\s*([가-힣]{2,4})/);
    if (m) return /신부측/.test(text) ? m[2] : m[1];
    m = text.match(/([가-힣]{2,4})\s*,\s*[가-힣]{2,4}\s*(?:입니다|이에요|예요|입니당)/);
    if (m) return m[1];
    if (groom) return groom[1];
    if (bride) return bride[1];
  }

  if (event === "돌잔치") {
    let m = text.match(/(?:저희|우리)\s*(?:아기|딸|아들|공주|왕자)?\s*([가-힣]{2,4}?)(?:이가|가|이)?\s*태어난/);
    if (m) return stripJosa(m[1]);
    m = text.match(/(?:저희|우리)\s*(?:아기|딸|아들|공주|왕자)?\s*([가-힣]{2,4}?)(?:이가|가|이|\s|의|\s*첫)/);
    if (m) return stripJosa(m[1]);
    m = text.match(/([가-힣]{2,4}?)\s*(?:첫돌|돌잔치|첫 생일)/);
    if (m) return stripJosa(m[1]);
  }

  if (event === "생일") {
    let m = text.match(/(?:아버님|어머님|아버지|어머니|부친|모친)\s*\(\s*([가-힣]{2,4})\s*\)/);
    if (m) return m[1];
    m = text.match(/([가-힣]{2,4})\s*(?:여사|여사님)/);
    if (m) return m[1];
    m = text.match(/([가-힣]{2,4})\s*(?:님)?\s*(?:생신|생일)/);
    if (m && !["작은", "올해로", "저희", "우리", "가족"].includes(m[1])) return m[1];
    m = text.match(/([가-힣]{2,4})\s*(?:환갑|칠순|고희|팔순)/);
    if (m && !["올해로", "저희", "우리"].includes(m[1])) return m[1];
    m = text.match(/(?:저희\s*)?(아버님|어머님|아버지|어머니|아빠|엄마)\s*(?:\([^)]*\))?\s*(?:께서\s*)?(?:올해로\s*)?(?:환갑|칠순|고희|팔순|생신|생일|맞이|만수무강)/);
    if (m) return m[1];
  }

  return null;
}

export function parsePlace(text) {
  let m = text.match(/((?:[가-힣]+\s+)?[가-힣A-Za-z]+(?:병원|의료원)\s*장례식장\s*(?:특|제)?\d+호실)/);
  if (m) return m[1].trim();
  for (const label of ["장소", "빈소", "예식장"]) {
    m = text.match(new RegExp(`${label}\\s*[:：]\\s*([^\\n/▶►|]+)`));
    if (m) return m[1].trim();
  }
  m = text.match(/((?:[가-힣]+구\s+)?[가-힣A-Za-z0-9]+\s*(?:웨딩홀|웨딩|호텔|컨벤션센터|컨벤션|채플|가든|하우스)\s*(?:[가-힣A-Za-z0-9]+\s*)?(?:\d+층\s*)?[가-힣A-Za-z]*(?:홀|룸|볼룸))/);
  if (m) return m[1].trim();
  m = text.match(/([가-힣A-Za-z]+\s*호텔\s*(?:\d+층\s*)?[가-힣A-Za-z]*(?:홀|룸|볼룸))/);
  if (m) return m[1].trim();
  m = text.match(/([가-힣]+\s+[가-힣A-Za-z0-9]*(?:하우스|뷔페|컨벤션|가든))/);
  if (m && !m[1].includes("생일") && !m[1].includes("돌잔치")) return m[1].trim();
  return null;
}

export function parse(text) {
  const event = parseEvent(text);
  const account = parseAccount(text);
  return {
    event,
    name: parseName(text, event, account),
    date: parseDate(text, event),
    time: parseTime(text),
    place: parsePlace(text),
    account,
  };
}

function pad(n) { return String(n).padStart(2, "0"); }
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
