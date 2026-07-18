import { act, renderHook } from "@testing-library/react";
import { PropsWithChildren } from "react";

import useStackContext from "@hooks/useStackContext";
import type { PathTuple } from "@models/index";
import StackLinkProvider from "@/provider";

import useStackLinkBack from "./index";

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  prefetch: jest.fn(),
};

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/",
}));

const path: PathTuple = ["https://a.com/from", "/to"];

const renderBack = () => {
  const wrapper = ({ children }: PropsWithChildren) => (
    <StackLinkProvider>{children}</StackLinkProvider>
  );
  return renderHook(
    () => ({ back: useStackLinkBack(), ctx: useStackContext() }),
    { wrapper },
  );
};

describe("useStackLinkBack", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("canGoBack", () => {
    it("history가 비어 있으면 false다.", () => {
      const { result } = renderBack();

      expect(result.current.back.canGoBack).toBe(false);
    });

    it("history가 있으면 true다.", () => {
      const { result } = renderBack();

      act(() => result.current.ctx.push(path));

      expect(result.current.back.canGoBack).toBe(true);
    });
  });

  describe("goBack (View Transition 미지원 폴백)", () => {
    it("router.back을 호출하고 history를 pop한다.", () => {
      const { result } = renderBack();

      act(() => result.current.ctx.push(path));
      act(() => result.current.back.goBack({ animation: "slide" }));

      expect(mockRouter.back).toHaveBeenCalledTimes(1);
      expect(result.current.ctx.history).toEqual([]);
    });

    it("인자 없이 호출해도 동작한다.", () => {
      const { result } = renderBack();

      act(() => result.current.ctx.push(path));
      act(() => result.current.back.goBack());

      expect(mockRouter.back).toHaveBeenCalledTimes(1);
    });
  });
});
