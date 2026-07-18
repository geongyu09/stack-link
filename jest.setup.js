require("@testing-library/jest-dom");

// jsdom은 PointerEvent를 구현하지 않아 fireEvent.pointer*가 clientX 등 좌표를
// 전달하지 못한다. MouseEvent를 확장한 최소 폴리필로 좌표를 흘려보낸다.
if (typeof globalThis.PointerEvent === "undefined") {
  class PointerEvent extends MouseEvent {
    constructor(type, params = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? "";
      this.isPrimary = params.isPrimary ?? false;
    }
  }
  globalThis.PointerEvent = PointerEvent;
}

// jsdom에 없는 pointer capture API를 no-op으로 채워 컴포넌트 호출이 던지지 않게 한다.
if (typeof Element !== "undefined") {
  Element.prototype.setPointerCapture ??= function setPointerCapture() {};
  Element.prototype.releasePointerCapture ??= function releasePointerCapture() {};
  Element.prototype.hasPointerCapture ??= function hasPointerCapture() {
    return false;
  };
}
