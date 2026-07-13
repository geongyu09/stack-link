import { act, render, renderHook } from "@testing-library/react";
import { PropsWithChildren } from "react";

import useStackContext from "@hooks/useStackContext";
import type { PathTuple } from "@models/index";

import StackLinkProvider from "./index";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
}));

const wrapper = ({ children }: PropsWithChildren) => (
  <StackLinkProvider>{children}</StackLinkProvider>
);

describe("StackLinkProvider", () => {
  it("stack-main, stack-root, stack-previous 컨테이너를 렌더링한다.", () => {
    render(<StackLinkProvider>content</StackLinkProvider>);

    expect(document.getElementById("stack-main")).toBeInTheDocument();
    expect(document.getElementById("stack-root")).toBeInTheDocument();
    expect(document.getElementById("stack-previous")).toBeInTheDocument();
  });

  it("children을 stack-main 안에 렌더링한다.", () => {
    render(<StackLinkProvider>hello</StackLinkProvider>);

    expect(document.getElementById("stack-main")).toHaveTextContent("hello");
  });

  it("history가 비어 있으면 GoBackTrigger와 이전 화면 iframe을 렌더링하지 않는다.", () => {
    render(<StackLinkProvider>content</StackLinkProvider>);

    expect(
      document.getElementById("stack-previous")?.querySelector("iframe"),
    ).toBeNull();
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

    it("history가 있으면 이전 화면 iframe을 마지막 항목의 현재 경로로 렌더링한다.", () => {
      const { result } = renderHook(() => useStackContext(), { wrapper });

      act(() => result.current.push(path));

      const iframe = document
        .getElementById("stack-previous")
        ?.querySelector("iframe");
      expect(iframe).toHaveAttribute("src", "https://a.com/from");
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
