"use client";

import { useCallback } from "react";

import useStackContext from "@hooks/useStackContext";
import type { TransitionOptions } from "@models/index";

const useStackLinkBack = () => {
  const { runBack, history } = useStackContext();

  const canGoBack = history.length > 0;

  const goBack = useCallback(
    ({ animation = "slide", duration }: TransitionOptions = {}) => {
      runBack({ animation, duration });
    },
    [runBack],
  );

  return { goBack, canGoBack };
};

export default useStackLinkBack;
