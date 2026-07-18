"use client";

import { StackLinkProvider } from "stack-link";
import { type PropsWithChildren } from "react";

import { CounterProvider } from "./counter-context";

export default function Providers({ children }: PropsWithChildren) {
  // CounterProvider가 StackLinkProvider보다 바깥(둘 다 layout에 위치)이라
  // 페이지 전환 시에도 두 Provider가 모두 유지된다 → 맥락 공유.
  return (
    <CounterProvider>
      <StackLinkProvider onGoBack={(history) => console.log("goBack", history)}>
        {children}
      </StackLinkProvider>
    </CounterProvider>
  );
}
