# Changelog

## 1.0.0

Stack-Link now runs on the browser's native **View Transitions API** instead of iframe pre-rendering. This is a complete rewrite of the transition engine and the reason for the 1.0 release.

### Why this matters

Previously, every transition was driven from JavaScript: an iframe pre-rendered the next screen, and a `setTimeout` chain stepped inline `transform` styles to animate it. That put the entire animation on the main thread, so anything competing for it — hydration, data fetching, a busy WebView — could stall frames mid-transition. The result was animations that ran at 60fps in some situations and visibly dropped frames in others, with no clear pattern.

The browser now owns the animation. It snapshots the outgoing and incoming screens and animates them as pseudo-elements, independently of what JavaScript is doing. Transitions are consistently smooth, and the intermittent frame drops in WebView environments are gone.

Because both screens now live in the same document, global state, React Context, and caches are shared across navigation — the iframe approach booted a separate document each time and lost all of it.

### Added

- **Interactive back gesture.** Swiping from the edge now scrubs the transition in real time, following your finger 1:1 instead of playing a fixed animation after release. Lifting your finger commits or cancels based on distance travelled and fling velocity.
- **Pointer Events support.** Touch and mouse handling are unified, and `setPointerCapture` keeps the gesture alive when your finger leaves the edge region.
- **Reduced motion support.** Transitions are skipped when `prefers-reduced-motion: reduce` is set.
- **Automatic fallback.** Browsers without View Transitions API support commit the navigation immediately, with no animation and no errors.
- **Demo app** under `examples/demo` for verifying transitions and cross-screen state sharing in a real browser.

### Changed

- **`StackLink`'s `preLoad` now defaults to `true`** (previously `false`), and its meaning changed: it calls `router.prefetch(href)` rather than pre-rendering the target in an iframe. Pass `preLoad={false}` to opt out.
- `useStackLinkRouter`'s `isNavigating` now reflects the provider's shared transition state instead of a hook-local ref.
- Transition logic moved into `StackLinkProvider`. `StackLink`, `useStackLinkBack`, and `useStackLinkRouter` are now thin wrappers over it.

### Deprecated

- **`isInStackFrame`** — only meaningful under the iframe approach, which no longer exists. Still exported for compatibility, but it is no longer used internally and will be removed in a future major release.

### Removed

- The internal `Iframe` component. It was never part of the public API.
- `#stack-root` and `#stack-previous` DOM containers, along with the inline styles the provider used to apply to `#stack-main`. The browser manages transition snapshots itself.

### Migration

The public API surface is unchanged — `StackLinkProvider`, `StackLink`, `useStackLinkBack`, and `useStackLinkRouter` keep their signatures. For most projects, upgrading requires no code changes.

Two things to check:

1. If you relied on `preLoad` defaulting to `false`, set it explicitly.
2. If you referenced `#stack-root` or `#stack-previous` in your own CSS or scripts, remove those rules — the elements no longer exist.

### Browser support

Transitions require a browser with the View Transitions API. Chrome and Edge 111+, and Safari 18+, are supported; other browsers fall back to immediate navigation without animation.
