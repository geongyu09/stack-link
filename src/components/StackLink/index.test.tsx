import { act, fireEvent, render, screen } from "@testing-library/react";

import StackLinkProvider from "@/provider";

import StackLink from "./index";

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  prefetch: jest.fn(),
};

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

const renderStackLink = (props: Parameters<typeof StackLink>[0]) =>
  render(
    <StackLinkProvider>
      <StackLink {...props} />
    </StackLinkProvider>,
  );

describe("StackLink", () => {
  const originalSelf = window.self;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, "self", {
      value: originalSelf,
      configurable: true,
      writable: true,
    });
  });

  it("iframe 내부(isInStackFrame)에서는 아무것도 렌더링하지 않는다.", () => {
    Object.defineProperty(window, "self", {
      value: {},
      configurable: true,
      writable: true,
    });

    renderStackLink({ href: "/next", children: "이동" });

    expect(screen.queryByText("이동")).not.toBeInTheDocument();
  });

  it("최상위 프레임에서는 children을 렌더링한다.", () => {
    renderStackLink({ href: "/next", children: "이동" });

    expect(screen.getByText("이동")).toBeInTheDocument();
  });

  it("마운트 시 href를 prefetch한다.", () => {
    renderStackLink({ href: "/next", children: "이동" });

    expect(mockRouter.prefetch).toHaveBeenCalledWith("/next");
  });

  describe("slide 애니메이션(기본)", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("클릭 직후에는 router.push를 호출하지 않는다.", () => {
      renderStackLink({ href: "/next", children: "이동" });

      fireEvent.click(screen.getByText("이동"));

      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it("duration 경과 후 router.push(href)를 호출한다.", () => {
      renderStackLink({ href: "/next", children: "이동", duration: 100 });

      fireEvent.click(screen.getByText("이동"));
      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(mockRouter.push).toHaveBeenCalledWith("/next");
    });

    it("클릭 시 history에 [현재경로, href]를 push하여 이전 화면 iframe이 나타난다.", () => {
      renderStackLink({ href: "/next", children: "이동" });

      expect(
        document.getElementById("stack-previous")?.querySelector("iframe"),
      ).toBeNull();

      fireEvent.click(screen.getByText("이동"));

      const iframe = document
        .getElementById("stack-previous")
        ?.querySelector("iframe");
      expect(iframe).toHaveAttribute("src", window.location.href);
    });
  });

  describe("none 애니메이션", () => {
    it("클릭 즉시 타이머 없이 router.push(href)를 호출한다.", () => {
      renderStackLink({ href: "/next", children: "이동", animation: "none" });

      fireEvent.click(screen.getByText("이동"));

      expect(mockRouter.push).toHaveBeenCalledWith("/next");
    });
  });
});
