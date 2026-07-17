# Stack-Link

**English** · [한국어](./README.ko.md)

A navigation optimization library that delivers **native-app-like, buttery-smooth page transitions** in Next.js web applications.

[🔗 blog post](https://geongyu09.github.io/post/appLikeWeb/)

## Features

- 🚀 **Instant page transitions** — iframe-based pre-rendering shows the page the moment you click
- ✨ **Smooth animations** — 60fps sliding/fade animations powered by CSS Transform
- 👆 **Gesture-based back navigation** — swipe from the left screen edge to go back
- ⚡ **Performance optimized** — data preloading integrated with Next.js Prefetch
- 🎯 **Type safe** — full TypeScript support

## Background

### The web's navigation problem

Traditional web navigation suffers from the following usability issues:

```
Click → previous screen lingers → blank screen (loading) → content appears
```

These problems are especially critical inside WebView environments:

- A **white screen** flashes on every page transition
- iOS has **no back-navigation gesture**
- A **choppy user experience** compared to native apps

### Approaches we tried and their limits

#### Letting the app handle all navigation

We tried rendering every screen in a separate WebView and letting the native app manage navigation.

**Pros:**

- ✅ App-like, smooth screen transitions
- ✅ Native back-navigation gesture support

**Critical cons:**

- ❌ **Massive bridge logic required** — every page, query parameter, and dynamic route needs its own bridge implementation
- ❌ **Loss of caching benefits** — because each WebView is isolated, it cannot share `localStorage`, `sessionStorage`, the TanStack Query cache, and so on
- ❌ **Performance problems** — every screen transition reloads HTML, CSS, and JS, driving up memory usage

### How Stack-Link solves it

We wanted to keep both the strengths of the web (caching, a single browser context) and the strengths of a native app (smooth transitions, gestures). The goal: stay a website, yet deliver an app-like screen-transition experience.

- **Single WebView** — keeps caching benefits by sharing one browser context
- **Iframe pre-rendering** — renders the next page off-screen for an instant transition
- **CSS Transform animations** — smooth, GPU-accelerated transitions
- **Gesture support** — app-like back navigation via edge swipe
- **Next.js native** — integrates seamlessly with the App Router

## Installation

```bash
npm install stack-link
# or
yarn add stack-link
# or
pnpm add stack-link
```

**Peer Dependencies:**

- `next` ^15.3.0
- `react` ^19.0.0
- `react-dom` ^19.0.0

## Quick Start

### 1. Set up the Provider

Add `StackLinkProvider` to your root layout.

```tsx
// app/layout.tsx
import { StackLinkProvider } from "stack-link";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <StackLinkProvider>{children}</StackLinkProvider>
      </body>
    </html>
  );
}
```

### 2. Use the StackLink component

Replace your existing Next.js `Link` with `StackLink`.

```tsx
import { StackLink } from "stack-link";

export default function ProductList({ products }) {
  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>
          <StackLink
            href={`/product/${product.id}`}
            preLoad // pre-render the page
          >
            <ProductCard product={product} />
          </StackLink>
        </li>
      ))}
    </ul>
  );
}
```

### 3. Implement a back button

```tsx
import { useStackLinkBack } from "stack-link";

export default function BackButton() {
  const { goBack, canGoBack } = useStackLinkBack();

  return (
    <button
      onClick={() => goBack({ animation: "slide" })}
      disabled={!canGoBack}
    >
      Back
    </button>
  );
}
```

## API

### StackLinkProvider

Sits at the root of your application and manages page transitions.

```tsx
interface StackLinkProviderProps {
  children: React.ReactNode;
  onGoBack?: (history: PathTuple[]) => void;
}
```

#### Props

| Prop       | Type                             | Description                                       |
| ---------- | -------------------------------- | ------------------------------------------------- |
| `children` | `ReactNode`                      | Child components                                  |
| `onGoBack` | `(history: PathTuple[]) => void` | Callback invoked on back navigation (optional)    |

### StackLink

A component that handles page transitions declaratively.

```tsx
interface StackLinkProps {
  href: string;
  children: React.ReactNode;
  preLoad?: boolean;
  duration?: number;
  animation?: "slide" | "fade" | "none";
}
```

#### Props

| Prop        | Type                          | Default   | Description                        |
| ----------- | ----------------------------- | --------- | ---------------------------------- |
| `href`      | `string`                      | -         | Target path (required)             |
| `children`  | `ReactNode`                   | -         | Clickable child element (required) |
| `preLoad`   | `boolean`                     | `false`   | Whether to pre-render the page     |
| `duration`  | `number`                      | `280`     | Animation duration (ms)            |
| `animation` | `'slide' \| 'fade' \| 'none'` | `'slide'` | Animation type                     |

#### Animation types

- **`slide`** (default): horizontal sliding animation
- **`fade`**: fade in/out animation
- **`none`**: instant transition with no animation

#### Examples

```tsx
// Basic usage
<StackLink href="/about">
  <span>About</span>
</StackLink>

// Pre-render the page
<StackLink href="/product/123" preLoad>
  <ProductCard />
</StackLink>

// Instant transition with no animation
<StackLink href="/search" animation="none">
  <SearchButton />
</StackLink>

// Fade animation + custom duration
<StackLink
  href="/gallery"
  animation="fade"
  duration={400}
>
  <GalleryCard />
</StackLink>
```

### useStackLinkRouter

A hook that handles page transitions programmatically.

```tsx
function useStackLinkRouter(props: { prefetchHref?: string | null }): {
  navigate: (params: {
    href: string;
    animation?: "slide" | "fade" | "none";
  }) => void;
  isNavigating: boolean;
};
```

#### Parameters

| Prop           | Type             | Description                         |
| -------------- | ---------------- | ----------------------------------- |
| `prefetchHref` | `string \| null` | Path of the page to preload (optional) |

#### Return value

| Property       | Type       | Description                        |
| -------------- | ---------- | ---------------------------------- |
| `navigate`     | `Function` | Page-transition function           |
| `isNavigating` | `boolean`  | Whether a transition is in progress |

#### Example

```tsx
import { useStackLinkRouter } from "stack-link";

export default function SearchResults() {
  const { navigate } = useStackLinkRouter({
    prefetchHref: "/search/default", // preload
  });

  const handleResultClick = (id: string) => {
    navigate({
      href: `/product/${id}`,
      animation: "none", // instant transition
    });
  };

  return (
    <ul>
      {results.map((item) => (
        <li key={item.id} onClick={() => handleResultClick(item.id)}>
          {item.name}
        </li>
      ))}
    </ul>
  );
}
```

### useStackLinkBack

A hook that provides back-navigation functionality.

```tsx
function useStackLinkBack(): {
  goBack: (params: { animation?: "slide" | "fade" | "none" }) => void;
  canGoBack: boolean;
};
```

#### Return value

| Property    | Type       | Description                          |
| ----------- | ---------- | ------------------------------------ |
| `goBack`    | `Function` | Back-navigation function             |
| `canGoBack` | `boolean`  | Whether there is a page to go back to |

#### Example

```tsx
import { useStackLinkBack } from "stack-link";

export default function DetailPage() {
  const { goBack, canGoBack } = useStackLinkBack();

  const handleBack = () => {
    if (!canGoBack) {
      // Stack is empty, go home
      router.push("/");
      return;
    }

    goBack({ animation: "slide" });
  };

  return (
    <div>
      <button onClick={handleBack}>Back</button>
      {/* page content */}
    </div>
  );
}
```

### isInStackFrame

A utility function that checks whether the current page is running inside a Stack-Link iframe.

```tsx
function isInStackFrame(): boolean;
```

#### Example

```tsx
import { isInStackFrame } from "stack-link";

export default function MyComponent() {
  const inFrame = isInStackFrame();

  if (inFrame) {
    // Logic to run only inside the iframe
    return <PreviewMode />;
  }

  return <NormalMode />;
}
```

## How It Works

### Page structure

`StackLinkProvider` creates the following three main regions:

```
┌─────────────────────────────────────┐
│  #stack-main (current page)          │
│  - the actual content the user sees  │
│  - z-index: default                  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  #stack-root (next page)             │
│  - rendered via Portal               │
│  - positioned at translateX(100%)    │
│  - z-index: 999                      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  #stack-previous (previous page)     │
│  - rendered via iframe               │
│  - positioned at translateX(-20%)    │
│  - z-index: -1                       │
└─────────────────────────────────────┘
```

### Page transition flow

#### 1. Forward

```
User clicks
    ↓
If preLoaded: already rendered in the iframe
    ↓
Animation starts
  - main: translateX(0) → translateX(-20%)
  - next: translateX(100%) → translateX(0%)
    ↓
280ms animation
    ↓
router.push(href) runs
    ↓
History stack updated
  push([currentPath, nextPath])
    ↓
Done
```

#### 2. Backward

```
goBack() called or edge swipe
    ↓
Animation starts
  - main: translateX(0) → translateX(100%)
  - previous: translateX(-20%) → translateX(0%)
    ↓
280ms animation
    ↓
router.back() runs
    ↓
Removed from the history stack
  pop()
    ↓
Done
```

### Gesture-based back navigation

Drag from the left screen edge (40px) to go back:

- **Drag 50px or more**: back navigation is triggered
- **Less than 50px**: returns to the original position
- Shows a preview of the previous page while dragging

## Performance Optimization

### 1. Iframe-based pre-rendering

```tsx
<StackLink href="/product/123" preLoad>
  {/* the page is already rendered before the click */}
</StackLink>
```

- Pre-renders the next page off-screen (`translateX(100%)`)
- On click, the already-rendered page slides in and is **shown instantly**
- **0ms** of page-loading wait time

### 2. Using CSS Transform

```tsx
element.style.transform = "translateX(-20%)";
element.style.willChange = "transform";
```

- Applies GPU hardware acceleration
- No reflow/repaint occurs

### 3. Next.js Prefetch integration

```tsx
const { navigate } = useStackLinkRouter({
  prefetchHref: "/product/default",
});
```

- Preloads data via `router.prefetch()`
- No waiting for data to load during the transition

### 4. Portal pattern

```tsx
createPortal(<NextPage />, document.getElementById("stack-root"));
```

- Optimizes the DOM structure with React Portal
- Prevents layout shift
- Manages memory efficiently

## Advanced Usage

### Conditional navigation

```tsx
const { navigate } = useStackLinkRouter({});

const handleSubmit = async (data) => {
  const result = await submitForm(data);

  if (result.success) {
    navigate({
      href: "/success",
      animation: "fade",
    });
  } else {
    navigate({
      href: "/error",
      animation: "none",
    });
  }
};
```

### Using the history stack

```tsx
<StackLinkProvider
  onGoBack={(history) => {
    console.log("Current history:", history);
    // send analytics events, logging, etc.
  }}
>
  {children}
</StackLinkProvider>
```

### Combining multiple animations

```tsx
// List → detail: slide
<StackLink href="/detail" animation="slide">
  <Card />
</StackLink>

// Tab switch: fade
<StackLink href="/tab2" animation="fade">
  <TabButton />
</StackLink>

// Search results: instant transition
<StackLink href="/search" animation="none">
  <SearchResult />
</StackLink>
```

### WebView-to-native bridge integration

```tsx
import { useStackLinkBack } from "stack-link";

export default function BackButton() {
  const { goBack, canGoBack } = useStackLinkBack();
  const nativeGoBack = useNativeBridge(); // native bridge

  const handleBack = () => {
    if (!canGoBack) {
      // Stack is empty, notify the native app
      nativeGoBack();
      return;
    }

    goBack({ animation: "slide" });
  };

  return <button onClick={handleBack}>Back</button>;
}
```

## Type Definitions

```typescript
// Path tuple: [current path, target path]
type PathTuple = [string, string];

// Stack context
interface StackContextType {
  history: PathTuple[];
  push: (path: PathTuple) => void;
  pop: () => void;
  isAnimating: boolean;
  setIsAnimating: (value: boolean) => void;
  handleGoBack: () => void;
}

// StackLink parameters
interface StackLinkParams {
  href: string;
  duration?: number;
  preLoad?: boolean;
  animation?: "slide" | "none" | "fade";
}
```

## Limitations

### 1. Iframe sandbox

Because pre-rendered pages run inside an iframe, the following limitations apply:

- `window.top` and `window.self` differ
- They use a separate context, so state cannot be shared

Solution: detect the iframe environment with the `isInStackFrame()` utility.

```tsx
import { isInStackFrame } from "stack-link";

if (!isInStackFrame()) {
  // Run only in the normal environment
  trackPageView();
}
```

You need to detect and handle the iframe environment separately.

### 2. SSR/SSG pages

Stack-Link only handles client-side transitions. Server-side rendering follows Next.js's default behavior.

### 3. Memory management

When you use `preLoad={true}`, the page is pre-rendered and consumes memory. Using `preLoad` on many links can increase memory usage.

Recommendations:

- Use `preLoad` only on important pages
- Preload only the top 3–5 items of a list, not every item

## License

MIT
