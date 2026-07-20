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
// 마지막 이동 후 이 시간이 지나 손을 놓았다면 "튕김"이 아니라 멈춘 것으로 본다(ms).
// 이 가드가 없으면 끝에서 잠시 멈췄다 뗀 제스처도 과거 속도로 오판된다.
const STALE_SAMPLE_MS = 100;
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
  // 속도 추정을 위한 최근 두 개의 이동 샘플.
  // last = 가장 최근, prev = 그 직전. 두 샘플의 차이로 순간 속도를 구한다.
  const lastXRef = useRef(0);
  const lastTRef = useRef(0);
  const prevXRef = useRef(0);
  const prevTRef = useRef(0);

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
      prevXRef.current = clientX;
      prevTRef.current = lastTRef.current;
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

      // 속도 샘플 갱신 — 새 값을 덮기 전에 직전 샘플을 prev로 밀어 둬야 한다.
      // (예전에는 last를 current와 같은 값으로만 갱신해 두 값의 차가 항상 0이었고,
      //  그 결과 속도가 언제나 0이 되어 플링 판정이 동작하지 않았다.)
      prevXRef.current = lastXRef.current;
      prevTRef.current = lastTRef.current;
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
    // 최근 두 이동 샘플로 순간 속도를 구한다. 마지막 이동이 오래 전이면(손을 멈춘 뒤
    // 뗀 경우) 그 속도는 더 이상 유효하지 않으므로 0으로 본다.
    const dt = lastTRef.current - prevTRef.current;
    const sinceLastMove = now() - lastTRef.current;
    const velocity =
      dt > 0 && sinceLastMove < STALE_SAMPLE_MS
        ? (lastXRef.current - prevXRef.current) / dt
        : 0;

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
