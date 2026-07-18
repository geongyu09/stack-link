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
            // 라우트가 바뀌지 않아 화면이 얼어붙는 것을 방지하는 안전장치
            safetyRef.current = setTimeout(() => {
              if (finishRef.current) {
                finishRef.current();
                finishRef.current = null;
              }
            }, dur + 400);
            commit();
          }),
      );

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

      const settle = (commit: boolean) => {
        if (commit) {
          // 현재 지점에서 끝까지 재생 → 뒤로가기 확정
          handleGoBack();
          pop();
          for (const animation of animations) animation.play();
        } else {
          // 현재 지점에서 되감기 → 취소. router.back()으로 이미 바뀐 경로를
          // 되돌리기 위해 forward를 먼저 호출한다. 스냅샷이 화면을 덮고 있는 동안
          // 실제 DOM이 원래 화면으로 복귀하므로 깜빡임을 최소화한다.
          router.forward();
          for (const animation of animations) animation.reverse();
        }
      };

      const transition = document.startViewTransition!(
        () =>
          new Promise<void>((resolve) => {
            finishRef.current = resolve;
            // 경로가 바뀌지 않아 ready가 걸리는 것을 방지하는 안전장치
            safetyRef.current = setTimeout(() => {
              if (finishRef.current) {
                finishRef.current();
                finishRef.current = null;
              }
            }, dur + 400);
            router.back();
          }),
      );

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
          if (endedCommit !== null) {
            settle(endedCommit);
          } else {
            applyProgress(pendingProgress);
          }
        })
        .catch(() => {
          // ready 실패 시(전환 스킵 등) 취소로 종료됐다면 경로만 되돌린다.
          if (endedCommit === false) router.forward();
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
