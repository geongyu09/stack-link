export type PathTuple = [string, string]; // [현재 풀 경로, 이동할 경로]

export type StackAnimation = "slide" | "none" | "fade";
export type StackDirection = "forward" | "back";

export interface TransitionOptions {
  animation?: StackAnimation;
  duration?: number;
}

/**
 * 뒤로가기 제스처가 back View Transition을 손가락 위치에 맞춰 스크럽하고,
 * 손을 놓는 순간 그 지점에서 이어서 마무리(또는 취소)할 수 있게 하는 제어 핸들.
 */
export interface InteractiveBackController {
  /** 제스처 진행률(0~1)에 맞춰 전환 애니메이션의 currentTime을 세팅한다. */
  update: (progress: number) => void;
  /**
   * 제스처 종료. `commit === true`면 현재 지점에서 끝까지 재생해 뒤로가기를 확정하고,
   * `false`면 현재 지점에서 되감아 취소(원래 화면 복귀)한다.
   */
  finish: (commit: boolean) => void;
}

export interface StackContextType {
  history: PathTuple[];
  push: (path: PathTuple) => void;
  pop: () => void;
  isAnimating: boolean;
  setIsAnimating: (value: boolean) => void;
  handleGoBack: () => void;
  /** 다음 화면으로 View Transition 전환 후 라우팅 커밋 */
  runForward: (href: string, options?: TransitionOptions) => void;
  /** 이전 화면으로 View Transition 전환 후 router.back */
  runBack: (options?: TransitionOptions) => void;
  /**
   * 뒤로가기 제스처용. back View Transition을 시작하고 손가락 위치에 맞춰
   * 스크럽할 수 있는 컨트롤러를 반환한다. View Transition 미지원/모션 최소화/
   * 전환 진행 중이면 `null`을 반환하며, 호출부는 폴백 처리해야 한다.
   */
  startInteractiveBack: (
    options?: TransitionOptions,
  ) => InteractiveBackController | null;
}

export interface StackLinkParams {
  href: string;
  duration?: number;
  preLoad?: boolean;
  animation?: StackAnimation;
}
