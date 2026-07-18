"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect } from "react";

import useStackContext from "@hooks/useStackContext";
import type { StackLinkParams } from "@models/index";
import { DEFAULT_DURATION } from "@/utils";

// children을 명시적으로 선언한다. `extends PropsWithChildren`(타입 인자 없이)는
// `unknown & { children }`으로 평가돼 소비 측에서 children이 사라지는 문제가 있다.
export interface StackLinkedProps extends StackLinkParams {
  children?: ReactNode;
}

export default function StackLink({
  href,
  children,
  preLoad = true,
  duration = DEFAULT_DURATION,
  animation = "slide",
}: StackLinkedProps) {
  const router = useRouter();
  const { runForward } = useStackContext();

  useEffect(() => {
    if (typeof window === "undefined" || !preLoad) return;
    router.prefetch(href);
  }, [href, preLoad, router]);

  const handleActivate = useCallback(() => {
    runForward(href, { animation, duration });
  }, [runForward, href, animation, duration]);

  return <div onClick={handleActivate}>{children}</div>;
}
