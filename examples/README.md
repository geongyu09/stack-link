# stack-link 데모 & 검증 로드맵

이 문서는 v0.2.0(iframe → View Transitions 전환)의 **실제 브라우저 동작을 검증**하기 위한
데모 앱의 목적·구조·검증 항목과, 그 이후의 진행 방향을 정리합니다.

## 왜 데모가 필요한가

- jsdom 단위 테스트는 `document.startViewTransition`이 없어 **폴백 경로만** 검증됨
  (즉시 `router.push`, 애니메이션 없음)
- 실제 슬라이드/페이드 전환과 **"두 화면이 맥락을 공유한다"** 는 핵심 가치는
  브라우저(Chrome/Safari 등 VT 지원 환경)에서만 눈으로 확인 가능
- 구 iframe 방식이라면 실패할 시나리오(전역 상태·캐시 공유)를 데모로 재현해
  회귀 없이 해결됐음을 증명

## 데모 앱 구조 (`examples/demo`)

PnP 루트와 격리된 **독립 Next 15 App Router 앱**. 라이브러리는 빌드된 `dist`를
Next webpack alias(`stack-link` → `../../dist/index.mjs`)로 연결한다.

```
examples/demo/
├── package.json          # next/react/react-dom (데모 전용 node_modules)
├── next.config.mjs       # stack-link → ../../dist/index.mjs alias
├── tsconfig.json
├── app/
│   ├── layout.tsx        # (server) Providers로 감쌈
│   ├── providers.tsx     # ("use client") CounterProvider + StackLinkProvider
│   ├── counter-context.tsx  # ("use client") 화면 간 공유될 전역 상태
│   ├── globals.css
│   ├── page.tsx          # 홈: 카운터 + StackLink + 명령형 이동
│   └── detail/
│       └── page.tsx      # 상세: 같은 카운터 + 뒤로가기
```

### 핵심 검증 장치: 공유 카운터

`CounterProvider`를 **라우트보다 상위**(providers.tsx)에 두고, 홈과 상세가 같은 값을 읽는다.

- **iframe 방식**: 상세 화면이 별도 document로 새로 부팅 → 카운터가 `0`으로 초기화 (맥락 단절)
- **View Transitions 방식**: 같은 트리 유지 → 홈에서 올린 값이 상세에서 **그대로 보임** (맥락 공유)

## 실행 방법

```bash
# 1) 라이브러리 빌드 (dist 생성/갱신)
yarn build

# 2) 데모 의존성 설치 (최초 1회) — PnP와 격리
cd examples/demo && npm install

# 3) 데모 실행
npm run dev        # http://localhost:3000
```

> 라이브러리 소스를 수정하면 `yarn build`로 dist를 다시 만든 뒤 데모를 새로고침한다.
> (dev 편의를 위해 `yarn dev` watch 빌드를 병행 가능)

## 검증 체크리스트

수동으로 브라우저에서 확인:

- [ ] 홈 → 상세 이동 시 **슬라이드 전환**이 보인다 (오른쪽에서 진입)
- [ ] 홈에서 카운터를 올린 뒤 상세로 이동하면 **같은 값**이 보인다 (맥락 공유)
- [ ] 상세에서 카운터를 올리고 뒤로 가면 홈에도 반영돼 있다 (양방향 공유)
- [ ] 뒤로가기 전환은 **왼쪽으로 되돌아가는** 방향이다
- [ ] DOM에 `<iframe>`이 **존재하지 않는다** (DevTools Elements)
- [ ] 좌측 엣지 스와이프(모바일 에뮬레이션)로 뒤로가기가 동작한다
- [ ] `animation="fade"` 링크는 페이드로 전환된다
- [ ] `prefers-reduced-motion` 설정 시 애니메이션 없이 즉시 이동한다

## 이후 진행 방향 (로드맵)

### 1단계 — 데모로 기능 검증 (현재)
- 위 체크리스트 통과 확인, 필요 시 애니메이션 타이밍/이징 미세조정

### 2단계 — 뒤로가기 1:1 스크럽 제스처
- 현재는 임계값(50px) 넘으면 back VT 실행(트리거형)
- 손가락 이동에 비례해 전환이 따라오는 **interruptible/scrubbable** 제스처로 고도화
  (`transition.ready` + `animation.currentTime` 제어 또는 커스텀 애니메이션)

### 3단계 — 요소 단위 View Transition
- 현재는 `root` 전체 전환만 지원
- 공유 요소(썸네일 → 상세 헤더 등)에 `view-transition-name`을 부여해
  네이티브 앱 같은 shared-element 전환 옵션 제공

### 4단계 — 폴백 애니메이션 개선
- VT 미지원 환경에서 현재는 무애니메이션 즉시 이동
- 선택적으로 CSS transform 기반 JS 폴백 애니메이션 제공(레거시 Safari 등)

### 5단계 — 문서화 & 배포
- README에 VT 전환/맥락 공유/브라우저 지원표/폴백 정책 명시
- CHANGELOG 작성 후 **semver 0.2.0(minor)** 배포 (`isInStackFrame` deprecated 고지)
- 데모를 GitHub Pages/Vercel 등에 배포해 라이브 데모 링크 제공(선택)

### 6단계 — CI
- `examples/demo` 빌드(`next build`)를 CI에 추가해 라이브러리 변경이
  실제 앱 컴파일을 깨지 않는지 지속 검증
