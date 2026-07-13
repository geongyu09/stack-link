import { isInStackFrame } from "./index";

describe("isInStackFrame", () => {
  const originalSelf = window.self;

  const setSelf = (self: unknown) => {
    Object.defineProperty(window, "self", {
      value: self,
      configurable: true,
      writable: true,
    });
  };

  afterEach(() => {
    setSelf(originalSelf);
  });

  it("최상위 프레임(self === top)이면 false를 반환한다.", () => {
    // jsdom 기본값: window.self === window.top === window
    expect(isInStackFrame()).toBe(false);
  });

  it("iframe 내부(self !== top)이면 true를 반환한다.", () => {
    setSelf({});

    expect(isInStackFrame()).toBe(true);
  });

  it("self에 접근할 수 없으면(falsy) true를 반환한다.", () => {
    setSelf(null);

    expect(isInStackFrame()).toBe(true);
  });
});
