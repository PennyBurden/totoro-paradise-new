<script setup lang="ts">
/**
 * StrokeText —— React Bits StrokeText 的 Vue 移植版。
 * SVG 描边书写 + 填充动画。依赖 gsap。
 *
 * 与原版的差异:
 *  - Vue 3.4 无 useId,改用组件实例 uid 生成 wipe clipPath id;
 *  - strokeDash 估算系数按 CJK 字形放大(汉字轮廓周长远大于拉丁字母,
 *    原版 fontSize*7 会导致描边中途"跳完");
 *  - trigger="scroll" 时按需动态加载 ScrollTrigger,减小首包。
 */
import { gsap } from 'gsap';

const props = withDefaults(
  defineProps<{
    text?: string;
    strokeColor?: string;
    fillColor?: string;
    strokeWidth?: number;
    drawDuration?: number;
    fillDelay?: number;
    stagger?: number;
    ease?: string;
    trigger?: 'mount' | 'hover' | 'scroll' | 'loop';
    fillMode?: 'fade' | 'wipe' | 'none';
    fontSize?: number;
    fontWeight?: number | string;
    letterSpacing?: number | string;
    reverse?: boolean;
    className?: string;
  }>(),
  {
    text: 'Draw Attention',
    strokeColor: '#A78BFA',
    fillColor: '#F8FAFC',
    strokeWidth: 1.4,
    drawDuration: 1.6,
    fillDelay: 0.2,
    stagger: 0.05,
    ease: 'power2.out',
    trigger: 'mount',
    fillMode: 'wipe',
    fontSize: 128,
    fontWeight: 800,
    letterSpacing: -4,
    reverse: false,
    className: '',
  },
);

const rootRef = ref<HTMLElement | null>(null);
const strokeTextRef = ref<SVGTextElement | null>(null);
const wipeRectRef = ref<SVGRectElement | null>(null);
const box = ref<{ x: number; y: number; width: number; height: number } | null>(null);

// Vue 3.4 没有 useId,用实例 uid 保证同页多实例 id 不冲突
const uid = getCurrentInstance()?.uid ?? Math.random().toString(36).slice(2, 8);
const wipeId = `stroke-text-wipe-${uid}`;

const characters = computed(() => Array.from(String(props.text ?? '')));
// CJK 复杂字形轮廓长,系数取 36 保证 dash 覆盖整条描边路径
const dash = Math.max(props.fontSize * 36, 200);

const fontStyle = computed(() => ({
  fontSize: `${props.fontSize}px`,
  fontWeight: String(props.fontWeight),
  letterSpacing: `${props.letterSpacing}px`,
}));

const viewBox = computed(() =>
  box.value
    ? `${box.value.x} ${box.value.y} ${box.value.width} ${box.value.height}`
    : `0 ${-props.fontSize} 600 ${props.fontSize * 1.3}`);

/* ---------- 测量文本 bbox,锁定 viewBox ---------- */

const measure = () => {
  const node = strokeTextRef.value;
  if (!node) return;
  let bbox: DOMRect;
  try { bbox = node.getBBox(); } catch { return; }
  if (!bbox || !bbox.width) return;
  const pad = Math.max(Number(props.strokeWidth) || 1, props.fontSize * 0.1);
  const next = { x: bbox.x - pad, y: bbox.y - pad, width: bbox.width + pad * 2, height: bbox.height + pad * 2 };
  const prev = box.value;
  if (prev && Math.abs(prev.x - next.x) < 0.5 && Math.abs(prev.width - next.width) < 0.5 && Math.abs(prev.y - next.y) < 0.5) return;
  box.value = next;
};

onMounted(() => {
  measure();
  document.fonts?.ready?.then(measure).catch(() => {});
});

watch(
  [characters, () => props.fontSize, () => props.fontWeight, () => props.letterSpacing, () => props.strokeWidth],
  measure,
  { flush: 'post' },
);

/* ---------- gsap 时间线 ---------- */

let cleanup: (() => void) | null = null;

const runAnimation = () => {
  cleanup?.();
  cleanup = null;

  const root = rootRef.value;
  if (typeof window === 'undefined' || !root || !box.value) return;

  const strokes = gsap.utils.toArray<SVGElement>(root.querySelectorAll('[data-stroke-char]'));
  const fills = gsap.utils.toArray<SVGElement>(root.querySelectorAll('[data-fill-char]'));
  const wipe = wipeRectRef.value;
  if (!strokes.length) return;

  const fillEnabled = props.fillMode !== 'none';
  const useWipe = fillEnabled && props.fillMode === 'wipe';
  const fillDuration = Math.max(0.4, props.drawDuration * 0.5);
  const staggerConfig: number | { each: number; from: string } = props.reverse ? { each: props.stagger, from: 'end' } : props.stagger;
  const targets = [...strokes, ...fills, wipe].filter(Boolean);

  const setStart = () => {
    gsap.killTweensOf(targets);
    gsap.set(strokes, { strokeDasharray: dash, strokeDashoffset: dash });
    gsap.set(fills, { opacity: useWipe ? 1 : 0 });
    if (wipe) gsap.set(wipe, { attr: { width: 0 } });
  };

  const setEnd = () => {
    gsap.killTweensOf(targets);
    gsap.set(strokes, { strokeDasharray: dash, strokeDashoffset: 0 });
    gsap.set(fills, { opacity: fillEnabled ? 1 : 0 });
    if (wipe) gsap.set(wipe, { attr: { width: fillEnabled ? box.value!.width : 0 } });
  };

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    setEnd();
    cleanup = () => gsap.killTweensOf(targets);
    return;
  }

  const build = () => {
    setStart();
    const tl = gsap.timeline({
      paused: true,
      repeat: props.trigger === 'loop' ? -1 : 0,
      repeatDelay: props.trigger === 'loop' ? 0.9 : 0,
      defaults: { overwrite: 'auto' },
    });

    tl.to(strokes, { strokeDashoffset: 0, duration: props.drawDuration, ease: props.ease, stagger: staggerConfig }, 0);

    if (useWipe && wipe) {
      tl.to(wipe, { attr: { width: box.value!.width }, duration: fillDuration, ease: 'power2.inOut' }, props.drawDuration + props.fillDelay);
    } else if (fillEnabled) {
      tl.to(fills, { opacity: 1, duration: fillDuration, ease: 'power2.out', stagger: staggerConfig }, props.drawDuration + props.fillDelay);
    }

    return tl;
  };

  let timeline: gsap.core.Timeline | null = null;
  let scrollTrigger: { kill: () => void } | null = null;
  let removeHover: (() => void) | null = null;

  if (props.trigger === 'hover') {
    setEnd();
    const play = () => {
      timeline?.kill();
      timeline = build();
      timeline.play(0);
    };
    root.addEventListener('pointerenter', play);
    removeHover = () => root.removeEventListener('pointerenter', play);
  } else {
    timeline = build();
    if (props.trigger === 'scroll') {
      // 按需加载 ScrollTrigger,避免不用时进包
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        gsap.registerPlugin(ScrollTrigger);
        scrollTrigger = ScrollTrigger.create({
          trigger: root,
          start: 'top 82%',
          once: true,
          onEnter: () => timeline?.play(0),
        });
      }).catch(() => { timeline?.play(0); });
    } else {
      timeline.play(0);
    }
  }

  cleanup = () => {
    removeHover?.();
    scrollTrigger?.kill();
    timeline?.kill();
    gsap.killTweensOf(targets);
  };
};

watch(
  [box, () => props.drawDuration, () => props.fillDelay, () => props.stagger, () => props.ease, () => props.trigger, () => props.fillMode, () => props.reverse],
  runAnimation,
  { flush: 'post' },
);

onBeforeUnmount(() => cleanup?.());
</script>

<template>
  <span
    ref="rootRef"
    class="stroke-text"
    :class="[trigger === 'hover' ? 'stroke-text--hover' : '', className]"
    :style="{ '--stroke-text-height': `${Math.round(fontSize * 1.3)}px` }"
    role="img"
    :aria-label="String(text ?? '')"
  >
    <svg class="stroke-text__svg" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs v-if="fillMode === 'wipe' && box">
        <clipPath :id="wipeId" clipPathUnits="userSpaceOnUse">
          <rect ref="wipeRectRef" :x="box.x" :y="box.y" width="0" :height="box.height" />
        </clipPath>
      </defs>

      <text
        ref="strokeTextRef"
        class="stroke-text__stroke"
        x="0"
        y="0"
        fill="none"
        :stroke="strokeColor"
        :stroke-width="strokeWidth"
        stroke-linejoin="round"
        stroke-linecap="round"
        :style="fontStyle"
      >
        <tspan v-for="(char, i) in characters" :key="`s-${i}`" data-stroke-char="">{{ char }}</tspan>
      </text>

      <text
        class="stroke-text__fill"
        x="0"
        y="0"
        :fill="fillColor"
        stroke="none"
        :style="fontStyle"
        :clip-path="fillMode === 'wipe' && box ? `url(#${wipeId})` : undefined"
      >
        <tspan v-for="(char, i) in characters" :key="`f-${i}`" data-fill-char="">{{ char }}</tspan>
      </text>
    </svg>
  </span>
</template>

<style scoped>
.stroke-text {
  display: block;
  line-height: 0;
  width: 100%;
}

.stroke-text--hover {
  cursor: pointer;
}

.stroke-text__svg {
  display: block;
  height: var(--stroke-text-height, 160px);
  width: 100%;
}

.stroke-text__stroke,
.stroke-text__fill {
  user-select: none;
}
</style>
