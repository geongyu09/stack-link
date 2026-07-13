import { act, fireEvent, render } from "@testing-library/react";
import { useEffect } from "react";

import useStackContext from "@hooks/useStackContext";
import StackLinkProvider from "@/provider";

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  prefetch: jest.fn(),
};

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
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

describe("GoBackTrigger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

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

  it("임계값(50px)을 넘겨 스와이프하면 애니메이션 후 router.back을 호출하고 pop한다.", () => {
    render(
      <StackLinkProvider>
        <PushOnMount />
      </StackLinkProvider>,
    );

    const trigger = getTrigger();

    // isTouching 상태가 각 이벤트 사이에 반영되도록 act를 분리한다.
    act(() => {
      fireEvent.mouseDown(trigger, { clientX: 0 });
    });
    act(() => {
      fireEvent.mouseMove(trigger, { clientX: 100 });
    });
    act(() => {
      fireEvent.mouseUp(trigger, { clientX: 100 });
    });

    expect(mockRouter.back).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(280);
    });

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it("임계값(50px) 이하로 스와이프하면 뒤로가지 않는다.", () => {
    render(
      <StackLinkProvider>
        <PushOnMount />
      </StackLinkProvider>,
    );

    const trigger = getTrigger();

    act(() => {
      fireEvent.mouseDown(trigger, { clientX: 0 });
    });
    act(() => {
      fireEvent.mouseMove(trigger, { clientX: 30 });
    });
    act(() => {
      fireEvent.mouseUp(trigger, { clientX: 30 });
    });

    act(() => {
      jest.advanceTimersByTime(280);
    });

    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});
