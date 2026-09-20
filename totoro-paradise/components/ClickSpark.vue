<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    sparkColor?: string;
    sparkSize?: number;
    sparkRadius?: number;
    sparkCount?: number;
    duration?: number;
    easing?: 'linear' | 'ease-in' | 'ease-in-out' | 'ease-out' | string;
    extraScale?: number;
  }>(),
  {
    sparkColor: '#fff',
    sparkSize: 10,
    sparkRadius: 15,
    sparkCount: 8,
    duration: 400,
    easing: 'ease-out',
    extraScale: 1,
  },
);

interface Spark {
  x: number;
  y: number;
  angle: number;
  startTime: number;
}

const canvasRef = ref<HTMLCanvasElement | null>(null);
const sparks = ref<Spark[]>([]);
let animationId = 0;
let resizeTimeout: ReturnType<typeof setTimeout> | undefined;
let resizeObserver: ResizeObserver | undefined;

const ease = (t: number) => {
  switch (props.easing) {
    case 'linear':
      return t;
    case 'ease-in':
      return t * t;
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    default:
      return t * (2 - t);
  }
};

const resizeCanvas = () => {
  const canvas = canvasRef.value;
  const parent = canvas?.parentElement;
  if (!canvas || !parent) return;

  const { width, height } = parent.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const targetWidth = Math.max(1, Math.floor(width * pixelRatio));
  const targetHeight = Math.max(1, Math.floor(height * pixelRatio));

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
};

const scheduleResize = () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(resizeCanvas, 100);
};

const draw = (timestamp: number) => {
  const canvas = canvasRef.value;
  const context = canvas?.getContext('2d');
  if (!canvas || !context) return;

  const pixelRatio = window.devicePixelRatio || 1;
  context.clearRect(0, 0, canvas.width, canvas.height);

  sparks.value = sparks.value.filter((spark) => {
    const elapsed = timestamp - spark.startTime;
    if (elapsed >= props.duration) return false;

    const progress = elapsed / props.duration;
    const eased = ease(progress);
    const distance = eased * props.sparkRadius * props.extraScale;
    const lineLength = props.sparkSize * (1 - eased);

    const x1 = (spark.x + distance * Math.cos(spark.angle)) * pixelRatio;
    const y1 = (spark.y + distance * Math.sin(spark.angle)) * pixelRatio;
    const x2 = (spark.x + (distance + lineLength) * Math.cos(spark.angle)) * pixelRatio;
    const y2 = (spark.y + (distance + lineLength) * Math.sin(spark.angle)) * pixelRatio;

    context.strokeStyle = props.sparkColor;
    context.lineWidth = 2 * pixelRatio;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();

    return true;
  });

  animationId = requestAnimationFrame(draw);
};

const handleClick = (event: MouseEvent) => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const now = performance.now();

  sparks.value.push(
    ...Array.from({ length: props.sparkCount }, (_, index) => ({
      x,
      y,
      angle: (2 * Math.PI * index) / props.sparkCount,
      startTime: now,
    })),
  );
};

onMounted(() => {
  const canvas = canvasRef.value;
  const parent = canvas?.parentElement;
  if (!canvas || !parent) return;

  resizeObserver = new ResizeObserver(scheduleResize);
  resizeObserver.observe(parent);
  resizeCanvas();
  animationId = requestAnimationFrame(draw);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  clearTimeout(resizeTimeout);
  cancelAnimationFrame(animationId);
});
</script>

<template>
  <div class="click-spark" @click="handleClick">
    <canvas ref="canvasRef" class="click-spark__canvas" aria-hidden="true" />
    <div class="click-spark__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.click-spark {
  min-height: 100%;
  position: relative;
}

.click-spark__canvas {
  display: block;
  inset: 0;
  mix-blend-mode: screen;
  pointer-events: none;
  position: absolute;
  user-select: none;
  z-index: 20;
}

.click-spark__content {
  position: relative;
  z-index: 1;
}
</style>
