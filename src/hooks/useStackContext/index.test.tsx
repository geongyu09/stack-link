import { renderHook } from "@testing-library/react";
import { PropsWithChildren } from "react";

import StackLinkProvider from "@/provider";

import useStackContext from "./index";

describe("useStackContext", () => {
  it("Provider 외부에서 호출하면 에러를 던진다.", () => {
    // React가 콘솔에 에러를 출력하므로 억제
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useStackContext())).toThrow(
      "useStackContext must be used within a StackProvider",
    );

    spy.mockRestore();
  });

  it("Provider 내부에서 호출하면 context 값을 반환한다.", () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <StackLinkProvider>{children}</StackLinkProvider>
    );

    const { result } = renderHook(() => useStackContext(), { wrapper });

    expect(result.current).toEqual(
      expect.objectContaining({
        history: [],
        push: expect.any(Function),
        pop: expect.any(Function),
        isAnimating: false,
        setIsAnimating: expect.any(Function),
        handleGoBack: expect.any(Function),
      }),
    );
  });
});
