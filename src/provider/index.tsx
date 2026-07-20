"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import GoBackTrigger from "@components/GoBackTrigger";
import StackContext from "@context/stackContext";
import type {
  InteractiveBackController,
  PathTuple,
  StackDirection,
  TransitionOptions,
} from "@models/index";
import {
  clearTransitionVars,
  DEFAULT_DURATION,
  forceLinearScrub,
  getViewTransitionAnimations,
  injectStackStyles,
  prefersReducedMotion,
  ROUTE_COMMIT_TIMEOUT,
  setTransitionVars,
  supportsViewTransition,
} from "@/utils";

interface StackLinkProviderProps {
  onGoBack?: (history: PathTuple[]) => void;
  children?: ReactNode;
}

export default function StackLinkProvider({
  onGoBack,
  children,
}: StackLinkProviderProps) {
  const [history, setHistory] = useState<PathTuple[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  // View Transition 콜백이 새 라우트 커밋을 기다릴 수 있도록 하는 브리지
  const finishRef = useRef<(() => void) | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 전환 진행 중 재진입(중복 네비게이션) 방지
  const animatingRef = useRef(false);

  // 스타일 1회 주입
  useEffect(() => {
    injectStackStyles();
  }, []);

  // 새 경로가 커밋되면 대기 중인 전환을 종료해 새 스냅샷을 찍게 한다.
  useEffect(() => {
    if (finishRef.current) {
      finishRef.current();
      finishRef.current = null;
    }
  }, [pathname]);

  const push = useCallback((path: PathTuple) => {
    setHistory((prev) => [...prev, path]);
  }, []);

  const pop = useCallback(() => {
    setHistory((prev) => prev.slice(0, -1));
  }, []);

  const handleGoBack = useCallback(() => {
    if (onGoBack) onGoBack(history);
  }, [onGoBack, history]);

  const runTransition = useCallback(
    (
      commit: () => void,
      direction: StackDirection,
      { animation = "slide", duration }: TransitionOptions,
    ) => {
      const dur = duration ?? DEFAULT_DURATION;

      // 미지원 / 모션 최소화 / animation:"none" → 즉시 커밋 (폴백)
      if (
        animation === "none" ||
        !supportsViewTransition() ||
        prefersReducedMotion()
      ) {
        commit();
        return;
      }

      animatingRef.current = true;
      setIsAnimating(true);
      setTransitionVars(`${direction}-${animation}`, dur);

      const transition = document.startViewTransition!(
        () =>
          new Promise<void>((resolve) => {
            finishRef.current = resolve;
            commit();
          }),
      );

      // 라우트가 바뀌지 않아 화면이 얼어붙는 것을 방지하는 안전장치.
      // 미커밋 상태에서 콜백만 resolve하면 DOM이 아직 이전 화면이라 old == new
      // 스냅샷이 잡히고, 진짜 화면 교체는 전환 종료 후 애니메이션 없이 일어난다.
      // 그래서 "확정" 대신 전환 자체를 포기(skip)해 상태를 깨끗이 정리한다.
      safetyRef.current = setTimeout(() => {
        if (!finishRef.current) return;
        finishRef.current();
        finishRef.current = null;
        transition.skipTransition();
      }, ROUTE_COMMIT_TIMEOUT);

      transition.finished.finally(() => {
        if (safetyRef.current) {
          clearTimeout(safetyRef.current);
          safetyRef.current = null;
        }
        clearTransitionVars();
        animatingRef.current = false;
        setIsAnimating(false);
      });
    },
    [],
  );

  const runForward = useCallback(
    (href: string, options: TransitionOptions = {}) => {
      if (typeof window === "undefined" || animatingRef.current) return;
      push([window.location.href, href]);
      runTransition(() => router.push(href), "forward", options);
    },
    [push, router, runTransition],
  );

  const runBack = useCallback(
    (options: TransitionOptions = {}) => {
      if (typeof window === "undefined" || animatingRef.current) return;
      if (history.length === 0) return;
      handleGoBack();
      runTransition(() => router.back(), "back", options);
      pop();
    },
    [history.length, handleGoBack, pop, router, runTransition],
  );

  // 뒤로가기 제스처가 back View Transition을 손가락 위치에 맞춰 스크럽하도록,
  // 전환을 시작하고 제어 핸들을 반환한다. (미지원 시 null → 호출부가 폴백)
  const startInteractiveBack = useCallback(
    (options: TransitionOptions = {}): InteractiveBackController | null => {
      if (typeof window === "undefined" || animatingRef.current) return null;
      if (history.length === 0) return null;

      const animation = options.animation ?? "slide";
      const dur = options.duration ?? DEFAULT_DURATION;

      // 스크럽은 View Transition 의사요소 애니메이션을 직접 조작하는 방식이라
      // VT 미지원/모션 최소화/animation:"none"에서는 스크럽할 수 없다 → 폴백 위임.
      if (
        animation === "none" ||
        !supportsViewTransition() ||
        prefersReducedMotion()
      ) {
        return null;
      }

      animatingRef.current = true;
      setIsAnimating(true);
      setTransitionVars(`back-${animation}`, dur);

      // 전환 라이프사이클 동안 유지되는 로컬 상태
      let animations: Animation[] = [];
      let ready = false;
      // 전환이 스킵됐는지(커밋 타임아웃 등). 이 경우 애니메이션은 없지만
      // 라우팅/히스토리 상태는 그대로 정합성을 맞춰야 한다.
      let skipped = false;
      // 손가락이 마지막으로 가리킨 진행률 (ready 이전 이동은 여기 저장했다가 적용)
      let pendingProgress = 0;
      // ready 이전에 손을 놓은 경우의 커밋 결정 (null = 아직 진행 중)
      let endedCommit: boolean | null = null;

      const applyProgress = (progress: number) => {
        const clamped = Math.max(0, Math.min(1, progress));
        for (const animation of animations) {
          try {
            animation.currentTime = clamped * dur;
          } catch {
            // currentTime 세팅 실패는 무시 (일부 애니메이션은 스크럽 대상 아님)
          }
        }
      };

      // 애니메이션과 무관하게 라우팅/히스토리 상태만 확정한다.
      // 전환이 스킵돼 애니메이션이 없는 경우에도 이 정합성은 반드시 맞춰야 한다.
      const settleState = (commit: boolean) => {
        if (commit) {
          handleGoBack();
          pop();
        } else {
          // router.back()으로 이미 바뀐 경로를 되돌린다. 스냅샷이 화면을 덮고 있는
          // 동안 실제 DOM이 원래 화면으로 복귀하므로 깜빡임을 최소화한다.
          router.forward();
        }
      };

      const settle = (commit: boolean) => {
        settleState(commit);
        // 확정이면 현재 지점에서 끝까지 재생, 취소면 현재 지점에서 되감기.
        for (const animation of animations) {
          if (commit) animation.play();
          else animation.reverse();
        }
      };

      const transition = document.startViewTransition!(
        () =>
          new Promise<void>((resolve) => {
            finishRef.current = resolve;
            router.back();
          }),
      );

      // 경로가 바뀌지 않아 ready가 걸리는 것을 방지하는 안전장치.
      // 커밋 전에 전환을 확정하면 old == new 스냅샷이 재생되고 실제 화면 교체는
      // 전환이 끝난 뒤 애니메이션 없이 일어나므로, 확정 대신 전환을 포기한다.
      safetyRef.current = setTimeout(() => {
        if (!finishRef.current) return;
        finishRef.current();
        finishRef.current = null;
        transition.skipTransition();
      }, ROUTE_COMMIT_TIMEOUT);

      transition.ready
        .then(() => {
          animations = getViewTransitionAnimations();
          for (const animation of animations) {
            // 손가락과 1:1로 움직이도록 키프레임 구간 easing까지 linear로 강제하고
            // 정지시킨다. (effect 타이밍만 linear로 두면 keyframe의 ease가 남아 화면이
            // 손가락보다 앞서 나간다 → forceLinearScrub 참고)
            forceLinearScrub(animation);
            animation.pause();
          }
          ready = true;
          // ready 이전에 손을 놓았더라도, 먼저 손가락이 마지막으로 가리킨 지점까지
          // 스크럽한 뒤 마무리해야 한다. 곧바로 settle하면 currentTime이 0인 채로
          // play/reverse가 걸려 사용자가 끈 거리가 통째로 버려진다.
          applyProgress(pendingProgress);
          if (endedCommit !== null) settle(endedCommit);
        })
        .catch(() => {
          // 전환이 스킵됐다(커밋 타임아웃 등). 애니메이션은 재생할 수 없지만
          // 라우팅/히스토리 상태는 맞춰야 한다. 아직 손을 놓지 않았다면
          // 이후 finish()가 skipped 경로로 같은 처리를 한다.
          skipped = true;
          if (endedCommit !== null) settleState(endedCommit);
        });

      transition.finished.finally(() => {
        if (safetyRef.current) {
          clearTimeout(safetyRef.current);
          safetyRef.current = null;
        }
        clearTransitionVars();
        animatingRef.current = false;
        setIsAnimating(false);
      });

      return {
        update: (progress: number) => {
          pendingProgress = progress;
          if (ready) applyProgress(progress);
        },
        finish: (commit: boolean) => {
          if (ready) settle(commit);
          else if (skipped) settleState(commit);
          else endedCommit = commit;
        },
      };
    },
    [history.length, handleGoBack, pop, router],
  );

  return (
    <StackContext.Provider
      value={{
        history,
        push,
        pop,
        isAnimating,
        setIsAnimating,
        handleGoBack,
        runForward,
        runBack,
        startInteractiveBack,
      }}
    >
      <div
        id="stack-main"
        style={{
          position: "relative",
          minHeight: "100vh",
          minWidth: "100vw",
          willChange: "transform",
        }}
      >
        {children}
      </div>
      {history.length > 0 && <GoBackTrigger />}
    </StackContext.Provider>
  );
}
