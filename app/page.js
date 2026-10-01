"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { isConfigured, supabase } from "@/lib/supabase";
import { store } from "@/lib/store";
import { logEvent } from "@/lib/metrics";
import { computeAlerts } from "@/lib/alerts";
import { availableSeeds, isTransferRecord } from "@/lib/model";
import Onboarding from "@/components/Onboarding";
import Home from "@/components/Home";
import TabBar from "@/components/TabBar";
import YeonList from "@/components/YeonList";
import YeonForm from "@/components/YeonForm";
import YeonDetail from "@/components/YeonDetail";
import MaeumSheet from "@/components/MaeumSheet";
import AddMaeum from "@/components/AddMaeum";
import AlertsCenter from "@/components/AlertsCenter";
import SentList from "@/components/SentList";
import Settlement from "@/components/Settlement";
import Me from "@/components/Me";
import SeedCeremony from "@/components/SeedCeremony";
import YearReport from "@/components/YearReport";
import GuardFlow from "@/components/GuardFlow";
import ShareCard from "@/components/ShareCard";
import {
  getAuthInfo,
  onAuthChange,
  snapshotAnonymous,
  stageSnapshot,
  takeStagedSnapshot,
  clearStagedSnapshot,
  mergeAnonymousRows,
  isAlreadyMerged,
  markMerged,
} from "@/lib/auth";
import { ConfirmDialog, Loading, SetupGuide, Toast, SaveDelight, useSheetHistory } from "@/components/ui";
import { ImageZoomSheet } from "@/components/ImageSlot";
import { probeSplitsSupport, getSplitsMap } from "@/lib/splits";
import { probeTagsSupport, getTagsMap, setTags } from "@/lib/tags";

/**
 * 앱 진입점 상태 머신 (P0: 온보딩이 앱 진입점에 완전히 통합)
 * boot → setup(미설정 안내) | loading → onboarding | main
 */
export default function Page() {
  const [phase, setPhase] = useState("boot");
  const [loadError, setLoadError] = useState("");
  const [onboarded, setOnboarded] = useState(false);
  const [tab, setTab] = useState("home");
  const [yeons, setYeons] = useState([]);
  const [maeums, setMaeums] = useState([]);

  // 화면/시트 상태
  const [detailYeonId, setDetailYeonId] = useState(null);
  const [settlementOpen, setSettlementOpen] = useState(false);
  // 라운드2 — 올해의 인연 돌아보기
  const [yearReportOpen, setYearReportOpen] = useState(false);
  const [addOccasion, setAddOccasion] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addPresetYeonId, setAddPresetYeonId] = useState(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [sentOpen, setSentOpen] = useState(false);
  const [yeonForm, setYeonForm] = useState(null); // {mode:'add'} | {mode:'edit', yeon}
  const [maeumSheet, setMaeumSheet] = useState(null); // maeum
  // 라운드3 — 시트-브라우저 히스토리 동기화를 useSheetHistory 훅으로 일반화.
  // 기존 동작 유지: pushState 1-entry + popstate 닫기, 버튼 닫기는 history.back()으로 entry 소비.
  // 풀 동기화(URL·딥링크)는 제외 — 기획안 §6 수용기준 #1·#2 충족.
  const closeMaeumSheet = useSheetHistory(!!maeumSheet, () => setMaeumSheet(null), "maeum");
  // 라운드3 — 이미지 확대 보기 (마음 시트 안에서 열리는 경우 훅의 직렬화 가드가
  // 마음 시트를 먼저 닫고 entry 1개를 유지한다 — 중첩 시트 금지)
  const [imageZoom, setImageZoom] = useState(null); // {id, url, name}
  const openImageZoom = (img) => {
    if (img) setImageZoom(img);
  };
  const [share, setShare] = useState(null); // {kind, name} — 라운드3: confirm 스택 effect보다 먼저 선언 (TDZ 방지)
  const [confirm, setConfirm] = useState(null); // {title, sub, okLabel, danger, onOk}
  // 라운드3 — 시트 위 ConfirmDialog의 뒤로가기 우선순위 (기획안 §4 수용기준 3).
  // 시트가 열려 있을 때 Confirm이 뜨면 별도 entry를 쌓아 뒤로가기 1회가 Confirm만 닫게 한다.
  // 시트 entry의 sid 태그 덕분에 같은 popstate에 시트가 함께 닫히지 않는다.
  const sheetOpenForConfirm = !!(maeumSheet || share || imageZoom);
  const confirmEntry = useRef(null);
  useEffect(() => {
    if (!confirm || !sheetOpenForConfirm) {
      confirmEntry.current = null;
      return;
    }
    const sid = `confirm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      history.pushState({ jebiSheet: "confirm", jebiSid: sid }, "");
      confirmEntry.current = sid;
    } catch {
      confirmEntry.current = null;
    }
    const onPop = (e) => {
      if (e.state && e.state.jebiSid === sid) return; // 내 entry로 복귀 — 무시
      confirmEntry.current = null;
      setConfirm(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [confirm, sheetOpenForConfirm]);
  const closeConfirm = () => {
    // 버튼으로 닫을 때도 쌓은 entry를 소비해야 다음 뒤로가기가 엉뚱하게 동작하지 않는다
    if (confirmEntry.current) {
      confirmEntry.current = null;
      try {
        history.back(); // popstate → setConfirm(null)
        return;
      } catch {
        /* fallthrough */
      }
    }
    setConfirm(null);
  };
  const [toast, setToast] = useState("");
  const [ceremony, setCeremony] = useState(null); // 박 열림 세리머니 {maeumId, name}
  // 라운드3 — 세리머니는 뒤로가기·스와이프로 닫히지 않는다 (기획안 §4 수용기준 5).
  // entry를 쌓고, 내 entry를 떠나는 popstate마다 다시 쌓아 뒤로가기를 무효화한다.
  // '확인' 계열 버튼(심으러 가기·나중에·박씨 소식 나누기)으로만 나간다.
  const ceremonyEntry = useRef(null);
  useEffect(() => {
    if (!ceremony) {
      ceremonyEntry.current = null;
      return;
    }
    const sid = `ceremony-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      history.pushState({ jebiSheet: "ceremony", jebiSid: sid }, "");
      ceremonyEntry.current = sid;
    } catch {
      ceremonyEntry.current = null;
    }
    const onPop = (e) => {
      if (e.state && e.state.jebiSid === sid) return; // 내 entry로 복귀 — 무시
      // 뒤로가기 무효화 — entry를 다시 쌓아 세리머니를 유지한다
      try {
        history.pushState({ jebiSheet: "ceremony", jebiSid: sid }, "");
      } catch {
        /* 실패 시 브라우저 기본 동작 (최후 수단) */
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [ceremony]);
  // 세리머니를 버튼으로 나갈 때 쌓은 entry를 소비한다 (popstate는 리스너 정리 후 조용히 소멸)
  const closeCeremonyEntry = () => {
    if (ceremonyEntry.current) {
      ceremonyEntry.current = null;
      try {
        history.back();
      } catch {
        /* fallthrough */
      }
    }
  };
  // 세리머니 → 공유 시트 전환 ("닫고 열기" — 기획안 §3).
  // 세리머니 entry를 먼저 소비하고 popstate가 정착한 뒤 공유 시트를 열어 entry 1개를 유지한다.
  const shareFromCeremony = (name) => {
    const payload = { kind: "moment", name, eventType: ceremony?.eventType };
    setCeremony(null);
    if (!ceremonyEntry.current) {
      setShare(payload);
      return;
    }
    ceremonyEntry.current = null;
    const once = () => {
      window.removeEventListener("popstate", once);
      setShare(payload);
    };
    window.addEventListener("popstate", once);
    try {
      history.back();
    } catch {
      window.removeEventListener("popstate", once);
      setShare(payload);
    }
  };
  const [addSeedFrom, setAddSeedFrom] = useState(null); // 박씨 심기 진입 시 원본 마음 id
  const [bigText, setBigText] = useState(false); // 시니어 접근성 · 큰 글씨
  // P1-6 기록 완료 delight — 토스트에 띄울 카피가 있으면 표시 중
  const [delight, setDelight] = useState(null);
  // 라운드2 — N빵 분할 (graceful: 미지원이면 빈 맵 + UI 숨김)
  const [splitsSupported, setSplitsSupported] = useState(false);
  const [splitsByMaeum, setSplitsByMaeum] = useState(new Map());
  // 라운드2 — 인연 태그 (graceful: 미지원이면 빈 맵 + UI 숨김)
  const [tagsSupported, setTagsSupported] = useState(false);
  const [tagsByYeon, setTagsByYeon] = useState(new Map());

  /** P1-6: 제비 미니 애니메이션(600ms) + 햅틱. reduced-motion이면 바로 토스트 */
  const triggerDelight = (msg) => {
    try {
      if (navigator.vibrate) navigator.vibrate(15);
    } catch { /* 미지원 기기 */ }
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      showToast(msg);
      return;
    }
    setDelight(msg);
  };

  // P0 데이터 복원 — 인증 상태와 플로우
  const [auth, setAuth] = useState({ isAnonymous: true, email: null, id: null });
  const [guardFlow, setGuardFlow] = useState(null); // 'link' | 'login'
  const [mergeOffer, setMergeOffer] = useState(null); // {yeons, maeums}
  const authRef = useRef({ isAnonymous: true });
  const mergeSnapRef = useRef(null);

  const showToast = (t) => {
    setToast(t);
    setTimeout(() => setToast(""), 2200);
  };

  const refresh = useCallback(async () => {
    const [y, m] = await Promise.all([store.getYeons(), store.getMaeums()]);
    setYeons(y);
    setMaeums(m);
    // 라운드2 — N빵 분할 맵 + 인연 태그 맵 (프로브 1회씩, 실패하면 조용히 빈 맵)
    try {
      const [splitsOk, tagsOk] = await Promise.all([probeSplitsSupport(), probeTagsSupport()]);
      setSplitsSupported(splitsOk);
      setTagsSupported(tagsOk);
      const [smap, tmap] = await Promise.all([
        splitsOk ? getSplitsMap(m.map((x) => x.id)) : new Map(),
        tagsOk ? getTagsMap(y.map((x) => x.id)) : new Map(),
      ]);
      setSplitsByMaeum(smap);
      setTagsByYeon(tmap);
    } catch {
      setSplitsSupported(false);
      setSplitsByMaeum(new Map());
      setTagsSupported(false);
      setTagsByYeon(new Map());
    }
    return [y, m];
  }, []);

  const boot = useCallback(async () => {
    setLoadError("");
    if (!isConfigured) {
      setPhase("setup");
      return;
    }
    setPhase("loading");
    try {
      const [y, m] = await refresh();
      // P0-1: 새 기기에서 기록을 복원했는데 온보딩 플래그(기기별)가 없으면
      // 온보딩을 다시 보여주지 않는다 — 데이터가 곧 "이미 시작한 집"의 증거
      const ob = store.isOnboarded() || y.length > 0 || m.length > 0;
      if (ob && !store.isOnboarded()) store.setOnboarded(true);
      setOnboarded(ob);
      setBigText(store.isBigText());
      setPhase("main");
      logEvent("session_started", {}, "home");
    } catch (e) {
      console.error(e);
      setLoadError(e.message || "데이터를 불러오지 못했어요.");
      setPhase("setup");
    }
  }, [refresh]);

  useEffect(() => {
    boot();
  }, [boot]);

  // P0-3: 서비스 워커 등록 (오프라인 읽기 + PWA 설치 완성)
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* 등록 실패해도 앱은 정상 동작 */
      });
    }
  }, []);

  // P1-7: 초대 링크(?ref=) 수신 — 온보딩에서 환영 한 줄 + 메트릭
  const [inviteRef, setInviteRef] = useState(null);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const ref = q.get("ref");
      if (ref && !store.isOnboarded()) {
        setInviteRef(ref);
        logEvent("invite_accepted", { ref });
      }
    } catch {
      /* noop */
    }
  }, []);

  // ---- P0 데이터 복원: 인증 상태 구독 (익명 → 이메일 전환/로그인 감지) ----
  useEffect(() => {
    let alive = true;
    getAuthInfo().then((info) => {
      if (alive) {
        setAuth(info);
        authRef.current = info;
      }
    });
    const unsub = onAuthChange(async (event) => {
      const info = await getAuthInfo();
      if (!alive) return;
      const wasAnon = authRef.current.isAnonymous;
      setAuth(info);
      authRef.current = info;
      if (wasAnon && !info.isAnonymous && info.email) {
        // 세션 전환 완료 — 영구 계정으로 데이터를 다시 읽는다
        await refresh();
        if (event === "USER_UPDATED") logEvent("guard_linked");
        if (event === "SIGNED_IN") logEvent("session_authenticated");
        // 병합 제안은 매직링크 로그인(SIGNED_IN) 완료 시에만.
        // 익명→이메일 전환(link)은 같은 user id라 병합이 필요 없고,
        // 낡은 스냅샷이 남아 있어도 anonId가 같으면 건너뛰어 중복 복사를 막는다.
        if (event === "SIGNED_IN") {
          const snap = mergeSnapRef.current || takeStagedSnapshot();
          mergeSnapRef.current = null;
          if (
            snap && snap.anonId && snap.anonId !== info.id &&
            !isAlreadyMerged(snap.anonId) &&
            ((snap.yeons || []).length || (snap.maeums || []).length)
          ) {
            setMergeOffer(snap);
          } else {
            clearStagedSnapshot();
          }
        }
      }
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [refresh]);

  // "이미 지킨 기록이 있어요" — 세션 전환 전에 익명 기록 스냅샷
  const startLoginFlow = async () => {
    try {
      const snap = await snapshotAnonymous();
      mergeSnapRef.current = snap;
      stageSnapshot(snap); // 매직링크 클릭 시 리로드에 대비해 localStorage에도 보관
    } catch {
      mergeSnapRef.current = null;
      showToast("기록을 확인하지 못했어요. 로그인 전에 다시 시도해주세요.");
      return;
    }
    setGuardFlow("login");
  };

  // 병합 실행 — 이 기기의 익명 기록을 영구 계정으로 복사
  // J08: 스냅샷은 성공 후에만 파기 — 실패하면 재시도 가능 (반쪽 병합 방지)
  // J08: 병합 중 연속 클릭 가드 + 이미 병합한 스냅샷은 건너뜀 (중복 복사 방지)
  const mergingRef = useRef(false);
  const doMerge = async () => {
    const snap = mergeOffer;
    if (!snap || mergingRef.current) return;
    if (isAlreadyMerged(snap.anonId)) {
      setMergeOffer(null);
      clearStagedSnapshot();
      return;
    }
    mergingRef.current = true;
    setGuardFlow(null);
    try {
      await mergeAnonymousRows(snap);
      markMerged(snap.anonId);
      clearStagedSnapshot();
      setMergeOffer(null);
      await refresh();
      showToast("이 기기의 기록을 합쳤어요");
    } catch (e) {
      showToast("합치지 못했어요. 다시 시도해주세요");
    } finally {
      mergingRef.current = false;
    }
  };

  // ---- 핵심 순환: 갚기 (P1-1) — 박이 열리는 '정'의 순간 → 박씨 세리머니 ----
  const repayingRef = useRef(false); // J07: 연속 탭 레이스 방지 (mergingRef와 같은 패턴)
  const handleRepay = async (mid) => {
    if (repayingRef.current) return; // 이미 진행 중이면 무시
    repayingRef.current = true;
    try {
      const m = maeums.find((x) => x.id === mid);
      // J07: 중복 박 방지 — 이미 열린 박이면 세리머니를 다시 띄우지 않는다
      if (m?.repaidAt) { closeMaeumSheet(); return; }
      // J02/J07: 금품 수신 기록이 아니면 박 열기 대상이 아니다 (초대·참석만)
      if (!isTransferRecord(m)) { closeMaeumSheet(); return; }
      const name = m ? yeons.find((y) => y.id === m.yeonId)?.name : null;
      try {
        await store.updateMaeum(mid, { repaidAt: Date.now() });
      } catch (e) {
        showToast("저장에 실패했어요. 다시 시도해주세요");
        return;
      }
      // 저장은 성공 — 이후 단계가 실패해도 DB에는 반영된 상태
      try { await refresh(); } catch (e) { /* 목록은 다음 진입 시 반영 */ }
      closeMaeumSheet();
      setCeremony({ maeumId: mid, name: name || "소중한 분", eventType: m?.eventType });
    } finally {
      repayingRef.current = false;
    }
  };
  const handleMissed = async (mid) => {
    try {
      await store.updateMaeum(mid, { remindedAt: Date.now() });
      await refresh();
      showToast("3일 뒤에 다시 물어볼게요");
    } catch (e) {
      showToast("저장에 실패했어요. 다시 시도해주세요");
    }
  };
  const handleRemind = async (mid, msg) => {
    try {
      await store.updateMaeum(mid, { remindedAt: Date.now() });
      await refresh();
      logEvent("reminder_snoozed", {}, "home"); // 알림 미루기는 실제 챙김 완료가 아니다
      showToast(msg);
    } catch (e) {
      showToast("저장에 실패했어요. 다시 시도해주세요");
    }
  };

  // ---- 인연 CRUD ----
  const handleSaveYeon = async (patch) => {
    const { tags, ...yeonPatch } = patch;
    let savedId = null;
    if (yeonForm?.mode === "edit") {
      await store.updateYeon(yeonForm.yeon.id, yeonPatch);
      savedId = yeonForm.yeon.id;
      showToast("인연을 수정했어요");
    } else {
      const created = await store.createYeon(yeonPatch.name, yeonPatch.relationTag, yeonPatch.avatarGender);
      savedId = created.id;
      showToast("새 인연을 심었어요");
    }
    // 라운드2 — 태그 저장 (조용히, 실패해도 인연 저장은 유지)
    if (tagsSupported && tags !== undefined && savedId) {
      try {
        await setTags(savedId, tags);
      } catch {
        /* 태그 저장 실패는 화면에 드러내지 않음 */
      }
    }
    setYeonForm(null);
    await refresh();
  };
  const askDeleteYeon = (yeon) => {
    const count = maeums.filter((m) => m.yeonId === yeon.id).length;
    setConfirm({
      title: `${yeon.name}님을 지울까요?`,
      sub: `인연 기록과 주고받은 마음 ${count}개가 모두 사라져요.`,
      okLabel: "지우기",
      danger: true,
      onOk: async () => {
        setConfirm(null);
        await store.deleteYeon(yeon.id);
        setYeonForm(null);
        if (detailYeonId === yeon.id) setDetailYeonId(null);
        await refresh();
        showToast("인연을 지웠어요");
      },
    });
  };

  // ---- 마음 CRUD ----
  const handleSaveMaeum = async (id, patch) => {
    await store.updateMaeum(id, patch);
    closeMaeumSheet();
    await refresh();
    showToast("마음을 고쳤어요");
  };
  const askDeleteMaeum = (maeum) => {
    setConfirm({
      title: "이 마음을 지울까요?",
      sub: "지운 마음은 되돌릴 수 없어요.",
      okLabel: "지우기",
      danger: true,
      onOk: async () => {
        closeConfirm(); // Confirm entry 소비 — 뒤로가기 1회 = Confirm 닫기 (§4 수용기준 3)
        await store.deleteMaeum(maeum.id);
        closeMaeumSheet();
        await refresh();
        showToast("마음을 지웠어요");
      },
    });
  };

  const askReset = () => {
    setConfirm({
      title: "모든 기록을 지울까요?",
      sub: "지붕 위 박과 인연 기록이 모두 사라져요.",
      okLabel: "지우기",
      danger: true,
      onOk: async () => {
        setConfirm(null);
        await store.reset();
        store.setOnboarded(false);
        setOnboarded(false);
        setYeons([]);
        setMaeums([]);
        setTab("home");
      },
    });
  };

  // P1-11: 탈퇴하기 — 기록 전체 삭제 + 로그아웃 + 로컬 정리.
  // auth.users 행 자체의 삭제는 edge function(admin API)이 필요해 별도 작업.
  const askWithdraw = () => {
    setConfirm({
      title: "정말 떠날까요?",
      sub: "모든 마음 기록과 인연이 서버에서 삭제돼요. 이별도 정이에요 — 언제든 다시 와요.",
      okLabel: "떠나기",
      danger: true,
      onOk: async () => {
        setConfirm(null);
        try {
          await store.reset();
          try {
            if (supabase) await supabase.auth.signOut();
          } catch { /* noop */ }
          try {
            localStorage.removeItem("jebi.onboarded");
            localStorage.removeItem("jebi:merge-snapshot");
          } catch { /* noop */ }
          store.setOnboarded(false);
          setOnboarded(false);
          setYeons([]);
          setMaeums([]);
          setTab("home");
          showToast("기록을 모두 지웠어요. 잘 가요.");
        } catch (e) {
          showToast("다시 시도해주세요");
        }
      },
    });
  };

  if (phase === "boot" || phase === "loading") {
    return <Loading />;
  }
  if (phase === "setup") {
    return <SetupGuide error={loadError} />;
  }

  // P0: 온보딩 미완료 → 온보딩 (첫 박 심기)
  if (!onboarded) {
    return (
      <div className={bigText ? "app big-text" : "app"}>
        <link rel="preload" as="image" href="/img/jebi_perched.webp" />
        <Onboarding
          inviteRef={inviteRef}
          onDone={async () => {
            setOnboarded(true);
            logEvent("onboarding_done");
            await refresh();
          }}
        />
      </div>
    );
  }

  const alertCount = computeAlerts(maeums, yeons).length;
  const detailYeon = detailYeonId ? yeons.find((y) => y.id === detailYeonId) : null;
  const seeds = availableSeeds(maeums); // 심어지길 기다리는 박씨

  const openAdd = (presetYeonId = null, seedFromId = null) => {
    setAddOccasion(null);
    setAddPresetYeonId(presetYeonId);
    setAddSeedFrom(seedFromId);
    setAddOpen(true);
  };

  // 세리머니에서 "박씨 심으러 가기" — 방금 열린 박의 박씨를 품고 소식 기록으로
  const plantSeed = () => {
    const seedId = ceremony?.maeumId || null;
    closeCeremonyEntry();
    setCeremony(null);
    openAdd(null, seedId);
  };

  // ---- 시니어 접근성: 큰 글씨 토글 ----
  const toggleBigText = () => {
    const v = !bigText;
    store.setBigText(v);
    setBigText(v);
    showToast(v ? "큰 글씨로 바꿨어요" : "기본 글씨로 바꿨어요");
  };

  const appClass = bigText ? "app big-text" : "app";

  return (
    <div className={appClass}>
      <link rel="preload" as="image" href="/img/jebi_perched.webp" />
      {/* P2-6 에셋 프리로딩 — 홈 첫 페인트 이미지 (집·박) */}
      <link rel="preload" as="image" href="/img/house_empty.webp" />
      <link rel="preload" as="image" href="/img/gourd_small.webp" />
      <link rel="preload" as="image" href="/img/gourd_big.webp" />
      {yearReportOpen ? (
        <YearReport
          yeons={yeons}
          maeums={maeums}
          splitsByMaeum={splitsByMaeum}
          onBack={() => setYearReportOpen(false)}
        />
      ) : settlementOpen ? (
        <Settlement
          yeons={yeons}
          maeums={maeums}
          splitsByMaeum={splitsByMaeum}
          onBack={() => setSettlementOpen(false)}
          onBrowseYeons={() => { setSettlementOpen(false); setTab("yeon"); }}
          onToast={showToast}
        />
      ) : detailYeon ? (
        <YeonDetail
          yeon={detailYeon}
          maeums={maeums.filter((m) => m.yeonId === detailYeon.id)}
          yeons={yeons}
          allMaeums={maeums}
          splitsByMaeum={splitsByMaeum}
          onBack={() => setDetailYeonId(null)}
          onRepay={handleRepay}
          onOpenMaeum={setMaeumSheet}
          onAddMaeum={(yid) => openAdd(yid)}
          onEditYeon={(y) => setYeonForm({ mode: "edit", yeon: y })}
        />
      ) : (
        <>
          {tab === "home" && (
            <Home
              yeons={yeons}
              maeums={maeums}
              alertCount={alertCount}
              seeds={seeds}
              onRepay={handleRepay}
              onOpenAlerts={() => setAlertsOpen(true)}
              onAdd={() => openAdd()}
              onOpenYeon={(yid) => setDetailYeonId(yid)}
              onOpenSent={() => setSentOpen(true)}
              onPlantSeed={(sid) => openAdd(null, sid)}
              onShareStory={() => setShare({ kind: "cycle" })}
            />
          )}
          {tab === "yeon" && (
            <YeonList
              yeons={yeons}
              maeums={maeums}
              tagsByYeon={tagsByYeon}
              tagsSupported={tagsSupported}
              onOpen={setDetailYeonId}
              onAdd={() => setYeonForm({ mode: "add" })}
              onEdit={(y) => setYeonForm({ mode: "edit", yeon: y })}
            />
          )}
          {tab === "me" && (
            <Me
              bigText={bigText}
              onToggleBigText={toggleBigText}
              onOpenSettlement={() => setSettlementOpen(true)}
            onOpenYearReport={() => setYearReportOpen(true)}
              onReplayOnboarding={() => { store.setOnboarded(false); setOnboarded(false); }}
              onReset={askReset}
              onWithdraw={askWithdraw}
              auth={auth}
              onGuardLink={() => setGuardFlow("link")}
              onGuardLogin={startLoginFlow}
              onInvite={() => setShare({ kind: "invite" })}
              yeons={yeons}
              maeums={maeums}
              onToast={showToast}
              onImported={refresh}
              splitsSupported={splitsSupported}
            />
          )}
          <TabBar tab={tab} onTab={setTab} />
        </>
      )}

      {addOpen && (
        <AddMaeum
          yeons={yeons}
          maeums={maeums}
          presetYeonId={addPresetYeonId}
          presetOccasion={addOccasion}
          seedFromMaeumId={addSeedFrom}
          seedSupported={store.isSeedSupported()}
          splitsSupported={splitsSupported}
          onClose={() => { setAddOpen(false); setAddSeedFrom(null); }}
          onToast={showToast}
          onSaved={async (saved) => {
            setAddOpen(false);
            setAddSeedFrom(null);
            setTab("home");
            // 측정: 첫 마음 / 박씨 심기 (+ J10 사전: occasion/transfer_saved)
            if (maeums.length === 0) logEvent("first_maeum");
            // J10: 저장 성공 기준 — 금품 기록이면 transfer, 아니면 occasion
            logEvent(isTransferRecord(saved) ? "transfer_saved" : "occasion_saved", {}, "input");
            // 박씨와 함께 심었으면 정의 순환 카피로
            const seedId = saved?.grownFromSeedId;
            if (seedId) {
              logEvent("seed_planted");
              const seed = maeums.find((m) => m.id === seedId);
              const sname = seed ? yeons.find((y) => y.id === seed.yeonId)?.name : null;
              triggerDelight(sname ? `${sname}님의 박씨에서 새 박이 자라나고 있어요` : "박씨에서 새 박이 자라나고 있어요");
            } else {
              // P1-6 기록 완료 delight — "마음이 박에 담겼어요"
              triggerDelight("마음이 박에 담겼어요");
            }
            await refresh();
          }}
        />
      )}
      {alertsOpen && (
        <AlertsCenter
          yeons={yeons}
          maeums={maeums}
          onClose={() => setAlertsOpen(false)}
          onWent={handleRepay}
          onMissed={handleMissed}
          onRemind={handleRemind}
        />
      )}
      {sentOpen && (
        <SentList
          yeons={yeons}
          maeums={maeums}
          onClose={() => setSentOpen(false)}
          onOpenMaeum={(m) => { setSentOpen(false); setMaeumSheet(m); }}
          onAdd={() => { setSentOpen(false); openAdd(); }}
        />
      )}
      {yeonForm && (
        <YeonForm
          yeon={yeonForm.mode === "edit" ? yeonForm.yeon : null}
          initialTags={
            yeonForm.mode === "edit"
              ? tagsByYeon.get
                ? tagsByYeon.get(yeonForm.yeon.id) || []
                : []
              : []
          }
          allTags={[...new Set([...(tagsByYeon.values?.() || [])].flat())]}
          tagsSupported={tagsSupported}
          onClose={() => setYeonForm(null)}
          onSave={handleSaveYeon}
          onDelete={askDeleteYeon}
        />
      )}
      {maeumSheet && (
        <MaeumSheet
          maeum={maeumSheet}
          yeonName={yeons.find((y) => y.id === maeumSheet.yeonId)?.name || "소중한 분"}
          onRecord={() => { const source = maeumSheet; closeMaeumSheet(); openAdd(source.yeonId); setAddOccasion(source); }}
          onClose={closeMaeumSheet}
          onSave={handleSaveMaeum}
          onDelete={askDeleteMaeum}
          onRepay={handleRepay}
          onZoomImage={openImageZoom}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          sub={confirm.sub}
          okLabel={confirm.okLabel}
          danger={confirm.danger}
          onCancel={closeConfirm}
          onOk={confirm.onOk}
        />
      )}
      <Toast text={toast} />
      {/* P1-6 기록 완료 delight — 600ms 후 카피 토스트 */}
      {delight && (
        <SaveDelight
          onDone={() => {
            setDelight(null);
            showToast(delight);
          }}
        />
      )}
      {ceremony && (
        <SeedCeremony
          name={ceremony.name}
          eventType={ceremony.eventType}
          seedOk={store.isSeedSupported()}
          onPlant={plantSeed}
          onLater={() => {
            closeCeremonyEntry();
            setCeremony(null);
          }}
          onShare={() => shareFromCeremony(ceremony.name)}
        />
      )}
      {guardFlow && (
        <GuardFlow
          mode={guardFlow}
          linked={!auth.isAnonymous && !!auth.email}
          onClose={() => setGuardFlow(null)}
          onToast={showToast}
        />
      )}
      {mergeOffer && (
        <ConfirmDialog
          title={`이 기기의 기록 ${(mergeOffer.yeons || []).length + (mergeOffer.maeums || []).length}개를 합칠까요?`}
          sub={
            maeums.length > 0
              ? `이 계정에 이미 마음 ${maeums.length}개가 있어요. 이 기기의 기록을 추가합니다.`
              : "이 기기에서 심은 마음을 이어서 볼 수 있어요."
          }
          okLabel="합치기"
          cancelLabel="버리기"
          danger={false}
          onCancel={() => { setMergeOffer(null); setGuardFlow(null); clearStagedSnapshot(); }}
          onOk={doMerge}
        />
      )}
      {share && (
        <ShareCard
          kind={share.kind}
          name={share.name}
          eventType={share.eventType}
          onClose={() => setShare(null)}
          onToast={showToast}
          onShared={(kind) => logEvent("share_used", { kind })}
        />
      )}
      {/* 라운드3 — 이미지 확대 보기 (마음 시트와 별도 entry, 중첩 금지 — 훅이 직렬화) */}
      {imageZoom && (
        <ImageZoomSheet img={imageZoom} onClose={() => setImageZoom(null)} />
      )}
    </div>
  );
}
