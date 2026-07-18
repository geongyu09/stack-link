import { act, render, renderHook } from "@testing-library/react";
import { PropsWithChildren } from "react";

import useStackContext from "@hooks/useStackContext";
import type { PathTuple } from "@models/index";

import StackLinkProvider from "./index";

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  prefetch: jest.fn(),
};

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/",
}));

const wrapper = ({ children }: PropsWithChildren) => (
  <StackLinkProvider>{children}</StackLinkProvider>
);

describe("StackLinkProvider", () => {
  beforeEach(() => jest.clearAllMocks());

  it("stack-main 컨테이너를 렌더링한다.", () => {
    render(<StackLinkProvider>content</StackLinkProvider>);

    expect(document.getElementById("stack-main")).toBeInTheDocument();
  });

  it("children을 stack-main 안에 렌더링한다.", () => {
    render(<StackLinkProvider>hello</StackLinkProvider>);

    expect(document.getElementById("stack-main")).toHaveTextContent("hello");
  });

  it("View Transition 스타일을 head에 1회 주입한다.", () => {
    render(<StackLinkProvider>content</StackLinkProvider>);
    render(<StackLinkProvider>content2</StackLinkProvider>);

    expect(
      document.querySelectorAll("#stack-link-view-transition-style"),
    ).toHaveLength(1);
  });

  it("history가 비어 있으면 GoBackTrigger를 렌더링하지 않는다.", () => {
    render(<StackLinkProvider>content</StackLinkProvider>);

    expect(document.querySelector('[role="button"]')).toBeNull();
  });

  describe("history 상태 관리", () => {
    const path: PathTuple = ["https://a.com/from", "/to"];

    it("push하면 history에 경로 튜플이 추가된다.", () => {
      const { result } = renderHook(() => useStackContext(), { wrapper });

      act(() => result.current.push(path));

      expect(result.current.history).toEqual([path]);
    });

    it("pop하면 history의 마지막 항목이 제거된다.", () => {
      const { result } = renderHook(() => useStackContext(), { wrapper });

      act(() => result.current.push(path));
      act(() => result.current.push(["https://a.com/from2", "/to2"]));
      act(() => result.current.pop());

      expect(result.current.history).toEqual([path]);
    });
  });

  describe("runForward / runBack (폴백: View Transition 미지원)", () => {
    it("runForward는 history에 push하고 router.push(href)를 즉시 호출한다.", () => {
      const { result } = renderHook(() => useStackContext(), { wrapper });

      act(() => result.current.runForward("/next"));

      expect(mockRouter.push).toHaveBeenCalledWith("/next");
      expect(result.current.history).toEqual([[window.location.href, "/next"]]);
    });

    it("runBack은 router.back을 호출하고 history를 pop한다.", () => {
      const { result } = renderHook(() => useStackContext(), { wrapper });

      act(() => result.current.push(["https://a.com/from", "/to"]));
      act(() => result.current.runBack());

      expect(mockRouter.back).toHaveBeenCalledTimes(1);
      expect(result.current.history).toEqual([]);
    });

    it("history가 비어 있으면 runBack이 아무것도 하지 않는다.", () => {
      const { result } = renderHook(() => useStackContext(), { wrapper });

      act(() => result.current.runBack());

      expect(mockRouter.back).not.toHaveBeenCalled();
    });
  });

  describe("runForward (View Transition 지원)", () => {
    let capturedAnim: string | undefined;

    beforeEach(() => {
      capturedAnim = undefined;
      document.startViewTransition = jest.fn((cb?: () => void) => {
        capturedAnim = document.documentElement.dataset.stackAnim;
        cb?.();
        return {
          finished: Promise.resolve(),
          ready: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
          skipTransition: () => {},
        };
      }) as unknown as typeof document.startViewTransition;
    });

    afterEach(() => {
      delete document.startViewTransition;
    });

    it("startViewTransition을 호출하고 방향/애니메이션 data 속성을 설정한다.", () => {
      const { result } = renderHook(() => useStackContext(), { wrapper });

      act(() => result.current.runForward("/next", { animation: "slide" }));

      expect(document.startViewTransition).toHaveBeenCalledTimes(1);
      expect(capturedAnim).toBe("forward-slide");
      expect(mockRouter.push).toHaveBeenCalledWith("/next");
    });

    it("animation:'none'이면 View Transition 없이 즉시 커밋한다.", () => {
      const { result } = renderHook(() => useStackContext(), { wrapper });

      act(() => result.current.runForward("/next", { animation: "none" }));

      expect(document.startViewTransition).not.toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith("/next");
    });
  });

  describe("onGoBack 콜백", () => {
    it("handleGoBack 호출 시 현재 history를 인자로 onGoBack을 실행한다.", () => {
      const onGoBack = jest.fn();
      const cb = ({ children }: PropsWithChildren) => (
        <StackLinkProvider onGoBack={onGoBack}>{children}</StackLinkProvider>
      );
      const { result } = renderHook(() => useStackContext(), { wrapper: cb });

      const path: PathTuple = ["https://a.com/from", "/to"];
      act(() => result.current.push(path));
      act(() => result.current.handleGoBack());

      expect(onGoBack).toHaveBeenCalledWith([path]);
    });

    it("onGoBack이 없으면 handleGoBack 호출이 에러 없이 통과한다.", () => {
      const { result } = renderHook(() => useStackContext(), { wrapper });

      expect(() => act(() => result.current.handleGoBack())).not.toThrow();
    });
  });
});
