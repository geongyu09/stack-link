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
  usePathname: () => "/",
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

  it("prefetchHref가 없으면 prefetch하지 않는다.", () => {
    renderRouter();

    expect(mockRouter.prefetch).not.toHaveBeenCalled();
  });

  describe("navigate (View Transition 미지원 폴백)", () => {
    it("router.push(href)를 호출하고 history에 [현재경로, href]를 push한다.", () => {
      const { result } = renderRouter();

      act(() => result.current.router.navigate({ href: "/next" }));

      expect(mockRouter.push).toHaveBeenCalledWith("/next");
      expect(result.current.ctx.history).toEqual([
        [window.location.href, "/next"],
      ]);
    });

    it("animation:'none'도 router.push(href)를 호출한다.", () => {
      const { result } = renderRouter();

      act(() =>
        result.current.router.navigate({ href: "/next", animation: "none" }),
      );

      expect(mockRouter.push).toHaveBeenCalledWith("/next");
    });
  });
});
