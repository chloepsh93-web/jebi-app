/* 제비 서비스 워커 — PWA 설치 완성 + 오프라인 읽기 + 푸시 수신 스텁
 * - 설치 시 앱 셸(루트 HTML)·폰트·핵심 이미지를 미리 캐시
 * - 정적 에셋(img/fonts/icon): cache-first
 * - 내비게이션: network-first, 실패 시 캐시 → 그래도 없으면 오프라인 폴백
 * - 푸시 수신부: 수신 시 알림 표시 (발송 인프라는 별도 — Edge Function + pg_cron)
 */
const VERSION = "jebi-v1";
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/img/jebi_perched.webp",
  "/img/house_empty.webp",
  "/img/gourd_small.webp",
  "/fonts/PretendardVariable.woff2",
  "/fonts/NotoSerifKR-400.woff2",
];

const OFFLINE_HTML = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>제비 — 마음을 기억하는 집</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FCFBF9;font-family:'Apple SD Gothic Neo',-apple-system,sans-serif">
<div style="text-align:center;padding:24px">
<div style="font-size:20px;color:#5A4400;margin-bottom:8px">연결이 끊겼어요</div>
<p style="font-size:14px;color:#75705F;line-height:1.7">제비가 기다리고 있어요.<br>연결되면 다시 와요.</p>
<button onclick="location.reload()" style="margin-top:16px;padding:14px 28px;font-size:15px;font-weight:600;color:#fff;background:#9A6410;border:none;border-radius:12px">다시 시도</button>
</div></body></html>`;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) =>
      c.addAll(SHELL).catch(() => {
        /* 일부 실패해도 설치는 계속 */
      })
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // 정적 에셋 — cache-first
  if (
    url.pathname.startsWith("/img/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.match(/\.(png|webp|webmanifest)$/)
  ) {
    e.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(request, copy));
            return res;
          })
      )
    );
    return;
  }

  // 내비게이션 — network-first, 실패 시 캐시 → 오프라인 폴백
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() =>
          caches.match(request).then(
            (hit) =>
              hit ||
              new Response(OFFLINE_HTML, {
                headers: { "Content-Type": "text/html; charset=utf-8" },
              })
          )
        )
    );
  }
});

// 푸시 수신 스텁 — 발송 인프라(Edge Function + pg_cron) 연결 시 활성화
self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    /* noop */
  }
  const title = data.title || "제비가 물어왔어요";
  e.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "지붕 위 박들을 살펴보세요.",
      icon: "/icon-192.png",
      badge: "/favicon.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
