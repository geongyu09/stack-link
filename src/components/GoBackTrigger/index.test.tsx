import { act, fireEvent, render } from "@testing-library/react";
import { useEffect } from "react";

import useStackContext from "@hooks/useStackContext";
import StackLinkProvider from "@/provider";

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  prefetch: jest.fn(),
};

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/",
}));

// history를 하나 채워 GoBackTrigger가 렌더링되도록 하는 하네스
function PushOnMount() {
  const { push } = useStackContext();
  useEffect(() => {
    push(["http://localhost/", "/next"]);
  }, [push]);
  return null;
}

const getTrigger = () =>
  document.querySelector('[role="button"]') as HTMLElement;

const swipe = (trigger: HTMLElement, distance: number) => {
  act(() => {
    fireEvent.pointerDown(trigger, { pointerId: 1, clientX: 0 });
  });
  act(() => {
    fireEvent.pointerMove(trigger, { pointerId: 1, clientX: distance });
  });
  act(() => {
    fireEvent.pointerUp(trigger, { pointerId: 1, clientX: distance });
  });
};

describe("GoBackTrigger", () => {
  beforeEach(() => jest.clearAllMocks());

  it("history가 있을 때만 트리거를 렌더링한다.", () => {
    render(<StackLinkProvider>content</StackLinkProvider>);
    expect(getTrigger()).toBeNull();

    render(
      <StackLinkProvider>
        <PushOnMount />
      </StackLinkProvider>,
    );
    expect(getTrigger()).not.toBeNull();
  });

  it("임계값(50px)을 넘겨 스와이프하면 router.back을 호출한다. (폴백)", () => {
    render(
      <StackLinkProvider>
        <PushOnMount />
      </StackLinkProvider>,
    );

    swipe(getTrigger(), 100);

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it("임계값(50px) 이하로 스와이프하면 뒤로가지 않는다.", () => {
    render(
      <StackLinkProvider>
        <PushOnMount />
      </StackLinkProvider>,
    );

    swipe(getTrigger(), 30);

    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});

// View Transition을 지원하는 브라우저를 시뮬레이션해, 제스처가 back 전환을
// "스크럽"하는 핵심 동작(흰 화면 제거 + 손 놓은 지점에서 이어짐)을 검증한다.
describe("GoBackTrigger 인터랙티브 스크럽 (View Transition 지원)", () => {
  const DUR = 280; // DEFAULT_DURATION

  type MockAnim = {
    effect: {
      pseudoElement: string;
      updateTiming: jest.Mock;
      getKeyframes: jest.Mock;
      setKeyframes: jest.Mock;
    };
    currentTime: number;
    pause: jest.Mock;
    play: jest.Mock;
    reverse: jest.Mock;
  };

  let anims: MockAnim[];
  let readyResolve: () => void;
  let finishedResolve: () => void;

  const makeAnim = (): MockAnim => ({
    effect: {
      pseudoElement: "::view-transition-group(root)",
      updateTiming: jest.fn(),
      // CSS animation-timing-function(ease)에서 유래한 키프레임 구간 easing을 모사한다.
      getKeyframes: jest.fn(() => [
        { offset: 0, computedOffset: 0, easing: "ease", transform: "none" },
        { offset: 1, computedOffset: 1, easing: "linear", transform: "none" },
      ]),
      setKeyframes: jest.fn(),
    },
    currentTime: 0,
    pause: jest.fn(),
    play: jest.fn(),
    reverse: jest.fn(),
  });

  const flushReady = async () => {
    await act(async () => {
      readyResolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers(); // safety setTimeout이 실제로 발화하지 않도록
    // jsdom 기본 innerWidth는 0이라 진행률(deltaX/innerWidth) 계산이 무의미해진다.
    // 실제 브라우저에 해당하는 폭을 고정해 스크럽 비율을 검증 가능하게 만든다.
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1000,
    });
    anims = [makeAnim(), makeAnim()];

    document.startViewTransition = jest.fn((cb?: () => void) => {
      cb?.(); // executor 실행: finishRef 설정 + router.back() 호출
      return {
        ready: new Promise<void>((r) => {
          readyResolve = r;
        }),
        finished: new Promise<void>((r) => {
          finishedResolve = r;
        }),
        updateCallbackDone: Promise.resolve(),
        skipTransition: () => {},
      };
    }) as unknown as typeof document.startViewTransition;

    document.getAnimations = (() =>
      anims) as unknown as typeof document.getAnimations;
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (document as { startViewTransition?: unknown }).startViewTransition;
    delete (document as { getAnimations?: unknown }).getAnimations;
  });

  const mount = () => {
    render(
      <StackLinkProvider>
        <PushOnMount />
      </StackLinkProvider>,
    );
    return getTrigger();
  };

  it("드래그를 시작하면(손 떼기 전) back-slide 전환을 시작해 이전 화면을 뒤에 드러낸다.", () => {
    const trigger = mount();

    act(() => fireEvent.pointerDown(trigger, { pointerId: 1, clientX: 0 }));
    act(() => fireEvent.pointerMove(trigger, { pointerId: 1, clientX: 30 })); // 활성화

    // 손을 떼기 전에 이미 전환이 시작됨 → old(현재)/new(이전) 스냅샷 생성 → 흰 화면 아님
    expect(document.startViewTransition).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset.stackAnim).toBe("back-slide");
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it("ready 후 애니메이션을 정지시키고 손가락 위치에 맞춰 currentTime을 스크럽한다.", async () => {
    const W = window.innerWidth;
    const trigger = mount();

    act(() => fireEvent.pointerDown(trigger, { pointerId: 1, clientX: 0 }));
    act(() => fireEvent.pointerMove(trigger, { pointerId: 1, clientX: 30 }));

    await flushReady();

    // 1:1 추종을 위해 linear로 강제하고 pause
    for (const a of anims) {
      expect(a.pause).toHaveBeenCalled();
      expect(a.effect.updateTiming).toHaveBeenCalledWith({ easing: "linear" });
      // 핵심: effect 타이밍뿐 아니라 "키프레임 구간" easing까지 linear로 덮어써야
      // 화면이 손가락보다 앞서 나가지 않는다. (ease → 중반부 ~1.6배 빠름)
      expect(a.effect.setKeyframes).toHaveBeenCalledTimes(1);
      const frames = a.effect.setKeyframes.mock.calls[0][0] as Array<{
        easing: string;
        computedOffset?: number;
      }>;
      for (const frame of frames) {
        expect(frame.easing).toBe("linear");
        // computedOffset(읽기 전용 계산값)은 setKeyframes 입력에서 제거돼야 한다.
        expect(frame.computedOffset).toBeUndefined();
      }
    }

    // 진행률 60% 위치로 이동 → currentTime ≈ 0.6 * duration
    const moveX = Math.round(0.6 * W);
    act(() => fireEvent.pointerMove(trigger, { pointerId: 1, clientX: moveX }));

    for (const a of anims) {
      expect(a.currentTime).toBeCloseTo((moveX / W) * DUR, 0);
    }
  });

  it("임계값을 넘겨 손을 놓으면 그 지점에서 play()로 이어 재생하고 뒤로가기를 확정한다.", async () => {
    const W = window.innerWidth;
    const trigger = mount();
    const commitX = Math.round(0.6 * W);

    act(() => fireEvent.pointerDown(trigger, { pointerId: 1, clientX: 0 }));
    act(() => fireEvent.pointerMove(trigger, { pointerId: 1, clientX: 30 }));
    await flushReady();
    act(() => fireEvent.pointerMove(trigger, { pointerId: 1, clientX: commitX }));
    act(() => fireEvent.pointerUp(trigger, { pointerId: 1, clientX: commitX }));

    // 새 전환을 처음부터 재생하는 게 아니라, 스크럽된 지점에서 play()로 이어감
    for (const a of anims) expect(a.play).toHaveBeenCalledTimes(1);
    for (const a of anims) expect(a.reverse).not.toHaveBeenCalled();
    // 확정: history pop → GoBackTrigger 사라짐, back은 활성화 때 1번만
    expect(getTrigger()).toBeNull();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.forward).not.toHaveBeenCalled();

    await act(async () => {
      finishedResolve();
      await Promise.resolve();
    });
  });

  it("임계값 미만에서 손을 놓으면 reverse()로 되감고 router.forward로 경로를 복원한다.", async () => {
    const trigger = mount();

    act(() => fireEvent.pointerDown(trigger, { pointerId: 1, clientX: 0 }));
    act(() => fireEvent.pointerMove(trigger, { pointerId: 1, clientX: 30 })); // 활성화
    await flushReady();
    act(() => fireEvent.pointerMove(trigger, { pointerId: 1, clientX: 40 })); // 소량 이동
    act(() => fireEvent.pointerUp(trigger, { pointerId: 1, clientX: 40 }));

    for (const a of anims) expect(a.reverse).toHaveBeenCalledTimes(1);
    for (const a of anims) expect(a.play).not.toHaveBeenCalled();
    expect(mockRouter.forward).toHaveBeenCalledTimes(1);
    // 취소이므로 history 유지 → 트리거 계속 존재
    expect(getTrigger()).not.toBeNull();

    await act(async () => {
      finishedResolve();
      await Promise.resolve();
    });
  });
});
