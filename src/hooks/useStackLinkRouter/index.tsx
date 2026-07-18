"use client";

import useStackContext from "@hooks/useStackContext";
import type { StackLinkParams } from "@models/index";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

interface UseStackLinkRouterProps {
  prefetchHref?: string | null;
}

export default function useStackLinkRouter({
  prefetchHref,
}: UseStackLinkRouterProps = {}) {
  const router = useRouter();
  const { runForward, isAnimating } = useStackContext();

  useEffect(() => {
    if (typeof window === "undefined" || !prefetchHref) return;
    router.prefetch(prefetchHref);
  }, [prefetchHref, router]);

  const navigate = useCallback(
    ({ href, animation = "slide", duration }: Omit<StackLinkParams, "preLoad">) =>
      runForward(href, { animation, duration }),
    [runForward],
  );

  return {
    navigate,
    isNavigating: isAnimating,
  };
}
