/** Distance covered by one step, in metres. Longer when running. */
export const WALK_STRIDE = 0.8
export const RUN_STRIDE = 1.15
/** Peak height of the bob and side-to-side sway, in metres. */
export const BOB_HEIGHT = 0.022
export const SWAY_WIDTH = 0.012

/**
 * Camera offset for a walking cycle. `phase` advances by π per step, so the
 * head dips once per footfall and sways left and right once per two steps.
 * `amount` (0–1) fades the effect in and out when starting and stopping.
 */
export function headBobOffset(phase: number, amount: number) {
  const s = Math.sin(phase)
  return {
    up: -BOB_HEIGHT * amount * s * s,
    side: SWAY_WIDTH * amount * Math.cos(phase),
  }
}
