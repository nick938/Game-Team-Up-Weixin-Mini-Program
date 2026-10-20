<script setup lang="ts">
defineOptions({ name: 'ReactionEffect' });
defineProps<{ kind: 'like' | 'dislike' | 'love' | 'next' }>();
// Fixed trajectories keep each burst small and deterministic on all targets.
const stars = [
  [-30, -17, 9, -75],
  [-20, -33, 12, 60],
  [-4, -37, 8, -90],
  [15, -32, 10, 85],
  [30, -16, 8, -60],
  [34, 5, 11, 75],
  [20, 25, 8, 100],
  [0, 29, 10, -70],
  [-20, 23, 7, 80],
  [-33, 5, 11, -95],
];
const hearts = [
  [-15, -35, 9, -14],
  [2, -48, 15, 10],
  [18, -32, 11, 20],
];
function particleStyle(particle: number[], index: number) {
  return {
    '--fx-x': `${particle[0]}px`,
    '--fx-y': `${particle[1]}px`,
    '--fx-rotation': `${particle[3]}deg`,
    width: `${particle[2]}px`,
    height: `${particle[2]}px`,
    animationDelay: `${(index % 3) * 20}ms`,
  };
}
</script>
<template>
  <view class="reaction-effect" aria-hidden="true">
    <template v-if="kind === 'like'">
      <image
        v-for="(star, index) in stars"
        :key="index"
        class="effect-particle star-particle"
        :style="particleStyle(star, index)"
        :src="`/static/images/reactions/star-${index % 3 === 0 ? 'gold' : 'purple'}.png`"
        mode="aspectFit"
      />
    </template>
    <template v-else-if="kind === 'love'">
      <image
        v-for="(heart, index) in hearts"
        :key="index"
        class="effect-particle heart-particle"
        :style="particleStyle(heart, index)"
        src="/static/images/reactions/heart.png"
        mode="aspectFit"
      />
    </template>
    <view v-else-if="kind === 'dislike'" class="press-lines"><view /><view /><view /></view>
    <view v-else-if="kind === 'next'" class="pigeon-flight"
      ><view class="pigeon-frame">
        <image
          class="pigeon-sprite"
          src="/static/images/reactions/pigeon-sprite.png"
          mode="scaleToFill"
        /> </view
    ></view>
  </view>
</template>
<style scoped>
.reaction-effect {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
  z-index: 2;
  pointer-events: none;
}
.effect-particle {
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
  pointer-events: none;
}
.star-particle {
  animation: star-burst 510ms ease-out both;
}
.heart-particle {
  animation: heart-float 460ms ease-out both;
}
@keyframes star-burst {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.25) rotate(0);
  }
  12% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.05) rotate(0);
  }
  75% {
    opacity: 0.85;
    transform: translate(calc(var(--fx-x) - 50%), calc(var(--fx-y) - 50%)) scale(0.8)
      rotate(var(--fx-rotation));
  }
  100% {
    opacity: 0;
    transform: translate(calc(var(--fx-x) - 50%), calc(var(--fx-y) - 50%)) scale(0.1)
      rotate(var(--fx-rotation));
  }
}
@keyframes heart-float {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.35);
  }
  20% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(calc(var(--fx-x) - 50%), calc(var(--fx-y) - 50%)) scale(0.85)
      rotate(var(--fx-rotation));
  }
}
.press-lines {
  position: absolute;
  top: 9px;
  left: -13px;
  width: 26px;
  display: flex;
  justify-content: space-between;
  animation: press-traces 300ms ease-out both;
}
.press-lines view {
  width: 2px;
  height: 6px;
  border-radius: 2px;
  background: #ab9bd6;
}
.press-lines view:first-child {
  transform: rotate(30deg);
}
.press-lines view:last-child {
  transform: rotate(-30deg);
}
@keyframes press-traces {
  0%,
  100% {
    opacity: 0;
    transform: translateY(0) scale(0.65);
  }
  35% {
    opacity: 1;
    transform: translateY(5px) scale(1);
  }
}
.pigeon-flight {
  position: absolute;
  left: -19px;
  top: -19px;
  width: 38px;
  height: 38px;
  animation: pigeon-flight 750ms ease-out both;
}
.pigeon-frame {
  width: 38px;
  height: 38px;
  overflow: hidden;
}
.pigeon-sprite {
  display: block;
  max-width: none;
  width: 152px;
  height: 38px;
  animation: pigeon-flap 320ms steps(4, end) infinite;
}
@keyframes pigeon-flap {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-152px);
  }
}
@keyframes pigeon-flight {
  0% {
    opacity: 0;
    transform: translate(-10px, 3px) scale(0.45) rotate(-8deg);
  }
  15% {
    opacity: 1;
    transform: translate(-8px, -5px) scale(1.05) rotate(-4deg);
  }
  50% {
    opacity: 1;
    transform: translate(1px, -26px) scale(1) rotate(2deg);
  }
  100% {
    opacity: 0;
    transform: translate(18px, -54px) scale(0.6) rotate(8deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .reaction-effect {
    display: none;
  }
  .effect-particle,
  .pigeon-flight,
  .pigeon-sprite,
  .press-lines {
    animation: none !important;
  }
}
</style>
