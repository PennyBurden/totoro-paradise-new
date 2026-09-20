<script setup lang="ts">
/**
 * GlitchText —— React Bits GlitchText 的 Vue 移植版。
 * 排版(字号/字重/颜色/阴影)继承自上下文,本组件只负责故障动画,
 * 可直接放进标题等已有排版的元素内部。
 */
const props = withDefaults(
  defineProps<{
    speed?: number;
    enableShadows?: boolean;
    enableOnHover?: boolean;
    className?: string;
  }>(),
  {
    speed: 1,
    enableShadows: true,
    enableOnHover: false,
    className: '',
  },
);

const slots = useSlots();

const text = computed(() => {
  const slot = slots.default?.()[0]?.children;
  return typeof slot === 'string' ? slot.trim() : '';
});

const inlineStyles = computed(() => ({
  '--after-duration': `${props.speed * 3}s`,
  '--before-duration': `${props.speed * 2}s`,
  '--after-shadow': props.enableShadows ? '-5px 0 #ff335f' : 'none',
  '--before-shadow': props.enableShadows ? '5px 0 #00e5ff' : 'none',
}));

const hoverClass = computed(() => (props.enableOnHover ? 'enable-on-hover' : ''));
</script>

<template>
  <span
    class="glitch"
    :class="[hoverClass, className]"
    :style="inlineStyles"
    :data-text="text"
  ><slot /></span>
</template>

<style scoped>
.glitch {
  color: inherit;
  display: inline-block;
  font: inherit;
  letter-spacing: inherit;
  position: relative;
  text-shadow: inherit;
  user-select: none;
  white-space: nowrap;
}

.glitch::after,
.glitch::before {
  background-color: var(--glitch-bg, transparent);
  clip-path: inset(0 0 0 0);
  color: inherit;
  content: attr(data-text);
  inset-block-start: 0;
  overflow: hidden;
  position: absolute;
}

.glitch:not(.enable-on-hover)::after {
  animation: animate-glitch var(--after-duration, 3s) infinite linear alternate-reverse;
  inset-inline-start: 10px;
  text-shadow: var(--after-shadow, -10px 0 red);
}
.glitch:not(.enable-on-hover)::before {
  animation: animate-glitch var(--before-duration, 2s) infinite linear alternate-reverse;
  inset-inline-start: -10px;
  text-shadow: var(--before-shadow, 10px 0 cyan);
}

.glitch.enable-on-hover::after,
.glitch.enable-on-hover::before {
  animation: none;
  content: '';
  opacity: 0;
}

.glitch.enable-on-hover:hover::after {
  animation: animate-glitch var(--after-duration, 3s) infinite linear alternate-reverse;
  content: attr(data-text);
  inset-inline-start: 10px;
  opacity: 1;
  text-shadow: var(--after-shadow, -10px 0 red);
}
.glitch.enable-on-hover:hover::before {
  animation: animate-glitch var(--before-duration, 2s) infinite linear alternate-reverse;
  content: attr(data-text);
  inset-inline-start: -10px;
  opacity: 1;
  text-shadow: var(--before-shadow, 10px 0 cyan);
}

@keyframes animate-glitch {
  0% { clip-path: inset(20% 0 50% 0); }
  5% { clip-path: inset(10% 0 60% 0); }
  10% { clip-path: inset(15% 0 55% 0); }
  15% { clip-path: inset(25% 0 35% 0); }
  20% { clip-path: inset(30% 0 40% 0); }
  25% { clip-path: inset(40% 0 20% 0); }
  30% { clip-path: inset(10% 0 60% 0); }
  35% { clip-path: inset(15% 0 55% 0); }
  40% { clip-path: inset(25% 0 35% 0); }
  45% { clip-path: inset(30% 0 40% 0); }
  50% { clip-path: inset(20% 0 50% 0); }
  55% { clip-path: inset(10% 0 60% 0); }
  60% { clip-path: inset(15% 0 55% 0); }
  65% { clip-path: inset(25% 0 35% 0); }
  70% { clip-path: inset(30% 0 40% 0); }
  75% { clip-path: inset(40% 0 20% 0); }
  80% { clip-path: inset(20% 0 50% 0); }
  85% { clip-path: inset(10% 0 60% 0); }
  90% { clip-path: inset(15% 0 55% 0); }
  95% { clip-path: inset(25% 0 35% 0); }
  100% { clip-path: inset(30% 0 40% 0); }
}

@media (prefers-reduced-motion: reduce) {
  /* 减弱动态:停动画并整层隐藏,避免静止的完整重影 */
  .glitch::after,
  .glitch::before {
    animation: none;
    opacity: 0;
  }
}
</style>
