import { fireEvent, render, screen } from "@testing-library/react";

import StackLinkProvider from "@/provider";

import StackLink from "./index";

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  prefetch: jest.fn(),
};

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/",
}));

const renderStackLink = (props: Parameters<typeof StackLink>[0]) =>
  render(
    <StackLinkProvider>
      <StackLink {...props} />
    </StackLinkProvider>,
  );

describe("StackLink", () => {
  beforeEach(() => jest.clearAllMocks());

  it("children을 렌더링한다.", () => {
    renderStackLink({ href: "/next", children: "이동" });

    expect(screen.getByText("이동")).toBeInTheDocument();
  });

  it("preLoad 기본값이면 마운트 시 href를 prefetch한다.", () => {
    renderStackLink({ href: "/next", children: "이동" });

    expect(mockRouter.prefetch).toHaveBeenCalledWith("/next");
  });

  it("preLoad=false면 prefetch하지 않는다.", () => {
    renderStackLink({ href: "/next", children: "이동", preLoad: false });

    expect(mockRouter.prefetch).not.toHaveBeenCalled();
  });

  it("클릭하면 router.push(href)를 호출한다. (View Transition 미지원 폴백)", () => {
    renderStackLink({ href: "/next", children: "이동" });

    fireEvent.click(screen.getByText("이동"));

    expect(mockRouter.push).toHaveBeenCalledWith("/next");
  });

  it("animation:'none'이면 클릭 즉시 router.push(href)를 호출한다.", () => {
    renderStackLink({ href: "/next", children: "이동", animation: "none" });

    fireEvent.click(screen.getByText("이동"));

    expect(mockRouter.push).toHaveBeenCalledWith("/next");
  });
});
