export interface CapsuleRect {
  top: number;
  bottom: number;
  left: number;
  height: number;
}

export function homeNavigationMetrics(statusBarHeight = 0, windowWidth = 375, capsule?: CapsuleRect) {
  const status = Math.max(0, statusBarHeight);
  const validCapsule = capsule && capsule.height > 0 && capsule.top >= status && capsule.left > 0;
  const height = validCapsule ? capsule.height + (capsule.top - status) * 2 : 48;
  return {
    status,
    height: Math.max(44, height),
    right: validCapsule ? Math.max(16, windowWidth - capsule.left + 12) : 16,
    total: status + Math.max(44, height),
  };
}
