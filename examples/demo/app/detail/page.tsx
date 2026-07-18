"use client";

import { useStackLinkBack } from "stack-link";

import { useCounter } from "../counter-context";

export default function Detail() {
  const { count, inc } = useCounter();
  const { goBack, canGoBack } = useStackLinkBack();

  return (
    <div className="screen" style={{ background: "#ecfdf5" }}>
      <h1>📄 상세</h1>

      <p className="count" data-testid="count">
        공유 카운터: {count}
      </p>
      <button className="btn" onClick={inc} data-testid="inc">
        +1
      </button>

      <p className="hint">
        이 값이 홈에서 올린 값과 같다면 <b>맥락 공유 성공</b>입니다. 여기서 값을
        올리고 뒤로 가면 홈에도 반영돼 있어야 합니다.
      </p>

      <div className="row">
        <button
          className="btn"
          onClick={() => goBack()}
          disabled={!canGoBack}
          data-testid="back"
        >
          ← 뒤로가기
        </button>
        <button
          className="btn secondary"
          onClick={() => goBack({ animation: "fade" })}
          disabled={!canGoBack}
          data-testid="back-fade"
        >
          ← 뒤로 (fade)
        </button>
      </div>

      <p className="hint">좌측 화면 가장자리에서 오른쪽으로 스와이프해도 뒤로갑니다.</p>
    </div>
  );
}
