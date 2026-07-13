import { act, renderHook } from "@testing-library/react";
import { PropsWithChildren } from "react";

import useStackContext from "@hooks/useStackContext";
import StackLinkProvider from "@/provider";

import useStackLinkRouter from "./index";

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  prefetch: jest.fn(),
};

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

const renderRouter = (prefetchHref?: string | null) => {
  const wrapper = ({ children }: PropsWithChildren) => (
    <StackLinkProvider>{children}</StackLinkProvider>
  );
  return renderHook(
    () => ({
      router: useStackLinkRouter({ prefetchHref }),
      ctx: useStackContext(),
    }),
    { wrapper },
  );
};

describe("useStackLinkRouter", () => {
  beforeEach(() => jest.clearAllMocks());

  it("prefetchHref가 있으면 마운트 시 prefetch한다.", () => {
    renderRouter("/pre");

    expect(mockRouter.prefetch).toHaveBeenCalledWith("/pre");
  });

  describe("navigate - slide 애니메이션", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("240ms 경과 후 router.push(href)를 호출하고 history에 push한다.", () => {
      const { result } = renderRouter();

      act(() => result.current.router.navigate({ href: "/next" }));

      expect(mockRouter.push).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(240);
      });

      expect(mockRouter.push).toHaveBeenCalledWith("/next");
      expect(result.current.ctx.history).toEqual([
        [window.location.href, "/next"],
      ]);
    });

    it("전환 진행 중(isNavigating) 추가 navigate 호출은 무시한다.", () => {
      const { result } = renderRouter();

      act(() => result.current.router.navigate({ href: "/first" }));
      act(() => result.current.router.navigate({ href: "/second" }));

      act(() => {
        jest.advanceTimersByTime(240);
      });

      expect(mockRouter.push).toHaveBeenCalledTimes(1);
      expect(mockRouter.push).toHaveBeenCalledWith("/first");
    });
  });

  describe("navigate - none 애니메이션", () => {
    it("타이머 없이 즉시 router.push(href)를 호출한다.", () => {
      const { result } = renderRouter();

      act(() => result.current.router.navigate({ href: "/next", animation: "none" }));

      expect(mockRouter.push).toHaveBeenCalledWith("/next");
    });
  });
});
