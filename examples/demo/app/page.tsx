"use client";

import { StackLink, useStackLinkRouter } from "stack-link";

import { useCounter } from "./counter-context";

export default function Home() {
  const { count, inc } = useCounter();
  const { navigate } = useStackLinkRouter();

  return (
    <div className="screen" style={{ background: "#eff6ff" }}>
      <h1>🏠 홈</h1>

      <p className="count" data-testid="count">
        공유 카운터: {count}
      </p>
      <button className="btn" onClick={inc} data-testid="inc">
        +1
      </button>

      <p className="hint">
        여기서 카운터를 올린 뒤 상세로 이동하면, 같은 값이 그대로 보여야 합니다.
        (iframe 방식이었다면 0으로 초기화됩니다)
      </p>

      <div className="row">
        <StackLink href="/detail">
          <span className="link" data-testid="go-slide">
            상세로 이동 (slide)
          </span>
        </StackLink>
        <StackLink href="/detail" animation="fade">
          <span className="link fade" data-testid="go-fade">
            상세로 이동 (fade)
          </span>
        </StackLink>
        <button
          className="btn secondary"
          onClick={() => navigate({ href: "/detail" })}
          data-testid="go-imperative"
        >
          명령형 이동
        </button>
      </div>
    </div>
  );
}
