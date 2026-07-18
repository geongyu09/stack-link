"use client";

import { useRouter } from "next/navigation";
import { memo, useCallback, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import useStackContext from "@hooks/useStackContext";
import type { InteractiveBackController } from "@models/index";

// 제스처가 "뒤로가기 의도"로 인정되기 시작하는 최소 이동 거리(px).
// 엣지 탭이나 미세한 흔들림에서 전환이 시작되는 것을 막는다.
const ACTIVATE_PX = 8;
// 손을 놓았을 때 뒤로가기를 확정하는 진행률(뷰포트 폭 대비).
const COMMIT_FRACTION = 0.2;
// 빠르게 튕기면 거리가 짧아도 확정하는 속도 임계값(px/ms).
const FLING_VELOCITY = 0.4;
// View Transition을 스크럽할 수 없는 환경의 폴백 임계값(px).
const SWIPE_THRESHOLD = 50;

const now = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const viewportWidth = (): number =>
  typeof window === "undefined" ? 1 : window.innerWidth || 1;

export default memo(function GoBackTrigger() {
  const [isTouching, setIsTouching] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  // 속도 추정을 위한 직전 이동 샘플
  const lastXRef = useRef(0);
  const lastTRef = useRef(0);

  // 이번 제스처가 인터랙티브 전환을 시작했는지 / 폴백인지
  const startedRef = useRef(false);
  const fallbackRef = useRef(false);
  const controllerRef = useRef<InteractiveBackController | null>(null);

  const goBackTriggerElementId = useId();

  const { history, runBack, isAnimating, startInteractiveBack } =
    useStackContext();
  const router = useRouter();

  const getMain = () =>
    typeof document === "undefined"
      ? null
      : document.getElementById("stack-main");

  const resetGesture = useCallback(() => {
    startXRef.current = 0;
    currentXRef.current = 0;
    startedRef.current = false;
    fallbackRef.current = false;
    controllerRef.current = null;
  }, []);

  const handleStart = useCallback(
    (clientX: number) => {
      // 다른 전환이 진행 중이면 새 제스처를 시작하지 않는다.
      if (isAnimating) return;
      startXRef.current = clientX;
      currentXRef.current = clientX;
      lastXRef.current = clientX;
      lastTRef.current = now();
      startedRef.current = false;
      fallbackRef.current = false;
      controllerRef.current = null;
      setIsTouching(true);
      // 뒤로 이동할 경로(마지막 push의 출발지)를 미리 prefetch
      const prev = history[history.length - 1]?.[0];
      if (prev) router.prefetch(prev);
    },
    [history, isAnimating, router],
  );

  const handleMove = useCallback(
    (clientX: number) => {
      if (!isTouching) return;
      currentXRef.current = clientX;
      const deltaX = clientX - startXRef.current;

      // 아직 활성화 전이면, 우측 방향으로 임계값을 넘는 순간 전환을 시작한다.
      if (!startedRef.current) {
        if (deltaX <= ACTIVATE_PX) return;
        startedRef.current = true;
        const controller = startInteractiveBack({ animation: "slide" });
        if (controller) {
          controllerRef.current = controller;
          fallbackRef.current = false;
        } else {
          // View Transition 미지원 → transform 피드백 폴백
          controllerRef.current = null;
          fallbackRef.current = true;
        }
      }

      // 속도 샘플 갱신
      lastXRef.current = clientX;
      lastTRef.current = now();

      if (controllerRef.current) {
        // 인터랙티브: old 스냅샷이 손가락을 따라가고 뒤로 이전 화면이 드러난다.
        controllerRef.current.update(deltaX / viewportWidth());
      } else if (fallbackRef.current) {
        // 폴백: 현재 화면만 transform으로 민다.
        const main = getMain();
        if (main && deltaX > 0) {
          main.style.transition = "none";
          main.style.transform = `translateX(${deltaX}px)`;
        }
      }
    },
    [isTouching, startInteractiveBack],
  );

  const handleEnd = useCallback(() => {
    if (!isTouching) return;
    setIsTouching(false);

    const deltaX = currentXRef.current - startXRef.current;
    const dt = now() - lastTRef.current;
    const velocity = dt > 0 ? (currentXRef.current - lastXRef.current) / dt : 0;

    const controller = controllerRef.current;
    if (controller) {
      // 진행률이 충분하거나 빠르게 튕겼으면 확정, 아니면 취소.
      const progress = deltaX / viewportWidth();
      const commit =
        progress > COMMIT_FRACTION ||
        (velocity > FLING_VELOCITY && deltaX > ACTIVATE_PX);
      controller.finish(commit);
    } else if (fallbackRef.current) {
      const main = getMain();
      if (main) {
        // 드래그 피드백 즉시 원복
        main.style.transition = "none";
        main.style.transform = "";
      }
      if (deltaX > SWIPE_THRESHOLD && !isAnimating) {
        runBack({ animation: "slide" });
      }
    }

    resetGesture();
  }, [isTouching, isAnimating, runBack, resetGesture]);

  if (history.length <= 0 || typeof document === "undefined") return null;

  return createPortal(
    <div
      id={goBackTriggerElementId}
      style={{
        position: "fixed",
        width: "2.5rem",
        height: "100vh",
        top: 0,
        left: 0,
        zIndex: 9998,
        touchAction: "none",
      }}
      role="button"
      // Pointer 이벤트로 통일하고 setPointerCapture로 이후 이벤트를 이 요소에
      // 고정한다. 이렇게 하면 손가락/커서가 좁은 엣지 영역을 벗어나도 move/up이
      // 계속 전달되어, 전환이 일시정지된 채 멈추는 것을 막는다. (터치·마우스·펜 공통)
      onPointerDown={(e) => {
        e.stopPropagation();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // 캡처 미지원 환경은 무시 (기능 저하 없이 동작)
        }
        handleStart(e.clientX);
      }}
      onPointerMove={(e) => {
        e.stopPropagation();
        handleMove(e.clientX);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // no-op
        }
        handleEnd();
      }}
      onPointerCancel={(e) => {
        e.stopPropagation();
        handleEnd();
      }}
    />,
    document.body,
  );
});
