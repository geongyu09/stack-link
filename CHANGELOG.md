# Changelog

## 1.0.0-next.1

Three fixes to the interactive back gesture introduced in `1.0.0-next.0`. All of them surface on real devices and slow networks rather than in local development, which is why they were not caught before the first prerelease.

### Why this matters

The interactive gesture has to coordinate two things that finish at unpredictable times: the browser's View Transition snapshot, and Next.js committing the new route (an RSC fetch). The previous implementation assumed the route would commit quickly, and each of the fixes below is a place where that assumption broke.

The safety timeout that guards against a route never committing was set to `duration + 400ms` (680ms by default) — a value derived from the animation length, not from how long a network round trip takes. On a prefetch miss or a slow connection the route commit exceeded it, and the timeout then *completed* the transition while the DOM still showed the previous screen. The browser captured an outgoing and an incoming snapshot that were identical, played that no-op transition, and performed the real screen swap after the transition ended — with no animation at all. The screen appeared to jump. The timeout is now based on network round-trip time and, when it fires, abandons the transition instead of completing it, so the navigation still happens and the transition state is cleaned up rather than being left half-applied.

### Fixed

- **The screen could swap without animation on slow route commits.** The safety timeout is now a dedicated `ROUTE_COMMIT_TIMEOUT` constant sized for a network round trip rather than derived from the animation duration, and on expiry it abandons the transition (`skipTransition()`) instead of completing it against an uncommitted DOM. Routing and history state stay consistent either way.
- **Releasing the gesture before the transition was ready discarded the distance you had dragged.** If you lifted your finger before `transition.ready` resolved — a fast swipe, or a slow route commit — the animation was played or reversed while its `currentTime` was still 0, so it restarted from the beginning instead of continuing from where your finger left off. The pending scrub position is now applied before the gesture settles.
- **Fling detection never triggered.** The velocity sample was overwritten with the current pointer position before being read, so the two values compared were always identical and the computed velocity was always 0. Short but fast swipes were therefore treated as cancellations. Two samples are now retained, and a sample older than 100ms is ignored so that a gesture held still before release is not committed on stale velocity.

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
