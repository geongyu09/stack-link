export const DEFAULT_DURATION = 280;

/**
 * 라우트 커밋(RSC 페치 + 렌더)을 기다리는 최대 시간(ms).
 *
 * View Transition 콜백은 새 라우트가 실제로 커밋될 때까지 대기해야 한다. 이 대기를
 * 너무 일찍 끊으면 **DOM이 아직 이전 화면인 상태로 new 스냅샷이 찍혀** old == new인
 * 무의미한 전환이 재생되고, 진짜 화면 교체는 전환이 끝난 뒤 애니메이션 없이 일어난다
 * (= 화면이 "툭" 하고 바뀌는 증상).
 *
 * 따라서 이 값은 애니메이션 길이가 아니라 **네트워크 왕복 시간**을 기준으로 잡아야 한다.
 * 과거 `duration + 400ms`(기본 680ms)를 쓰다가, prefetch 미스나 느린 네트워크에서
 * 커밋이 이를 넘기면 위 증상이 재현되어 상수로 분리했다.
 */
export const ROUTE_COMMIT_TIMEOUT = 1500;

/**
 * @deprecated iframe 프리렌더 방식이 View Transitions 기반으로 전환되면서
 * 더 이상 내부에서 사용하지 않습니다. 하위 호환을 위해 export만 유지합니다.
 */
export const isInStackFrame = () => {
  try {
    if (typeof window === "undefined" || !window.self || !window.top) {
      return true;
    }
    return window.self !== window.top;
  } catch (e) {
    console.error("[isInIframe] Error checking if in iframe:", e);
    return true;
  }
};

/** 현재 환경이 same-document View Transitions API를 지원하는지 */
export const supportsViewTransition = (): boolean =>
  typeof document !== "undefined" &&
  typeof document.startViewTransition === "function";

/** 사용자가 모션 최소화를 원하는지 */
export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const STACK_STYLE_ID = "stack-link-view-transition-style";

/**
 * View Transition 의사요소(::view-transition-old/new(root))에 적용할 키프레임과
 * 방향별 애니메이션 규칙. Provider 마운트 시 <head>에 1회 주입한다.
 */
export const STACK_TRANSITION_CSS = `
@keyframes stack-slide-in-from-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes stack-slide-out-to-left { from { transform: translateX(0); } to { transform: translateX(-25%); } }
@keyframes stack-slide-in-from-left { from { transform: translateX(-25%); } to { transform: translateX(0); } }
@keyframes stack-slide-out-to-right { from { transform: translateX(0); } to { transform: translateX(100%); } }
@keyframes stack-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes stack-fade-out { from { opacity: 1; } to { opacity: 0.1; } }

::view-transition-group(root) { animation-duration: var(--stack-duration, 280ms); }
::view-transition-old(root), ::view-transition-new(root) { animation: none; mix-blend-mode: normal; }

html[data-stack-anim="forward-slide"]::view-transition-old(root) {
  animation: stack-slide-out-to-left var(--stack-duration, 280ms) both ease; z-index: 0;
}
html[data-stack-anim="forward-slide"]::view-transition-new(root) {
  animation: stack-slide-in-from-right var(--stack-duration, 280ms) both ease; z-index: 1;
}
html[data-stack-anim="back-slide"]::view-transition-old(root) {
  animation: stack-slide-out-to-right var(--stack-duration, 280ms) both ease; z-index: 1;
}
html[data-stack-anim="back-slide"]::view-transition-new(root) {
  animation: stack-slide-in-from-left var(--stack-duration, 280ms) both ease; z-index: 0;
}
html[data-stack-anim="forward-fade"]::view-transition-old(root),
html[data-stack-anim="back-fade"]::view-transition-old(root) {
  animation: stack-fade-out var(--stack-duration, 280ms) both ease;
}
html[data-stack-anim="forward-fade"]::view-transition-new(root),
html[data-stack-anim="back-fade"]::view-transition-new(root) {
  animation: stack-fade-in var(--stack-duration, 280ms) both ease;
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root), ::view-transition-new(root) { animation: none !important; }
}
`;

/** View Transition 스타일을 <head>에 1회만 주입한다. */
export const injectStackStyles = (): void => {
  if (typeof document === "undefined") return;
  if (document.getElementById(STACK_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STACK_STYLE_ID;
  style.textContent = STACK_TRANSITION_CSS;
  document.head.appendChild(style);
};

/** :root 에 방향/지속시간 변수를 설정해 어떤 키프레임을 쓸지 선택한다. */
export const setTransitionVars = (anim: string, duration: number): void => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.stackAnim = anim;
  root.style.setProperty("--stack-duration", `${duration}ms`);
};

/** 전환 종료 후 :root 변수를 정리한다. */
export const clearTransitionVars = (): void => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  delete root.dataset.stackAnim;
  root.style.removeProperty("--stack-duration");
};

/**
 * 현재 진행 중인 View Transition의 의사요소(::view-transition-*(root)) 애니메이션을
 * 모두 수집한다. 제스처가 손가락 위치에 맞춰 `currentTime`을 스크럽하거나
 * `play()`/`reverse()`로 마무리할 때 사용한다. getAnimations 미지원 환경에서는 빈 배열.
 */
export const getViewTransitionAnimations = (): Animation[] => {
  if (
    typeof document === "undefined" ||
    typeof document.getAnimations !== "function"
  ) {
    return [];
  }
  return document.getAnimations().filter((animation) => {
    const effect = animation.effect as KeyframeEffect | null;
    const pseudo = effect?.pseudoElement;
    return typeof pseudo === "string" && pseudo.startsWith("::view-transition");
  });
};

/**
 * 제스처 스크럽 중 화면이 손가락과 1:1로 움직이도록 애니메이션을 완전한 선형으로 만든다.
 *
 * `updateTiming({ easing: "linear" })`는 effect 레벨 타이밍 easing만 바꾸는데,
 * 그 값은 원래도 linear다. 정작 움직임을 지배하는 것은 CSS `animation-timing-function`에서
 * 유래한 "키프레임 구간 easing"(예: `ease`)이며, 이를 그대로 두면 진행률 p에 대해 화면이
 * ease(p)만큼 이동해 손가락보다 앞서 나간다(ease는 중반부에서 ~1.6배 빠름).
 * 따라서 키프레임 자체의 easing까지 linear로 덮어써야 진짜 1:1 추종이 된다.
 */
export const forceLinearScrub = (animation: Animation): void => {
  const effect = animation.effect as KeyframeEffect | null;
  if (!effect) return;

  // 1) 키프레임 구간 easing 제거 (핵심)
  if (
    typeof effect.getKeyframes === "function" &&
    typeof effect.setKeyframes === "function"
  ) {
    try {
      const frames = effect.getKeyframes().map((frame) => {
        const next: Keyframe = { ...frame, easing: "linear" };
        // computedOffset은 읽기 전용 계산값이라 setKeyframes 입력에서 제외한다.
        delete (next as { computedOffset?: number }).computedOffset;
        return next;
      });
      effect.setKeyframes(frames);
    } catch {
      // setKeyframes 미지원/실패 시 무시 (아래 updateTiming으로 최소한 보정)
    }
  }

  // 2) effect 레벨 타이밍 easing도 선형으로 (방어적)
  try {
    effect.updateTiming({ easing: "linear" });
  } catch {
    // updateTiming 미지원/실패 시 무시
  }
};
