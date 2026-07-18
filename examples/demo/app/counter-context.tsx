"use client";

import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
} from "react";

interface CounterValue {
  count: number;
  inc: () => void;
}

const CounterContext = createContext<CounterValue | null>(null);

/**
 * 라우트보다 상위(layout)에 마운트되는 전역 상태.
 * View Transitions 방식에서는 화면 전환 시에도 이 Provider가 유지되어
 * 홈/상세가 같은 count를 공유한다. (iframe 방식이라면 상세에서 0으로 초기화됨)
 */
export function CounterProvider({ children }: PropsWithChildren) {
  const [count, setCount] = useState(0);
  return (
    <CounterContext.Provider value={{ count, inc: () => setCount((c) => c + 1) }}>
      {children}
    </CounterContext.Provider>
  );
}

export function useCounter(): CounterValue {
  const ctx = useContext(CounterContext);
  if (!ctx) throw new Error("useCounter must be used within CounterProvider");
  return ctx;
}
