<script setup lang="ts">
withDefaults(
  defineProps<{
    href?: string;
    icon?: string;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    variant?: 'dark' | 'light';
  }>(),
  {
    href: undefined,
    icon: undefined,
    disabled: false,
    type: 'button',
    variant: 'dark',
  },
);

defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<template>
  <a
    v-if="href"
    class="pill-bubble"
    :class="[`pill-bubble--${variant}`, { 'pill-bubble--disabled': disabled }]"
    :href="disabled ? undefined : href"
    :aria-disabled="disabled"
  >
    <span v-if="icon" class="pill-bubble__icon" :class="icon" aria-hidden="true" />
    <slot />
  </a>
  <button
    v-else
    class="pill-bubble"
    :class="[`pill-bubble--${variant}`, { 'pill-bubble--disabled': disabled }]"
    :type="type"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <span v-if="icon" class="pill-bubble__icon" :class="icon" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
/* 简洁版：悬停 = 背景色/文字色平滑互换 + 轻微上浮 */
.pill-bubble {
  --pill-bg: #fff;
  --pill-text: #120f17;
  --pill-hover-bg: #120f17;
  --pill-hover-text: #fff;

  align-items: center;
  background: var(--pill-bg);
  border: 0;
  border-radius: 9999px;
  box-shadow: 0 16px 40px rgb(0 0 0 / 20%);
  color: var(--pill-text);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: clamp(0.95rem, 2vw, 1.05rem);
  font-weight: 800;
  gap: 0.45rem;
  justify-content: center;
  line-height: 1;
  min-block-size: 3.15rem;
  min-inline-size: 9rem;
  padding: 0 1.35rem;
  position: relative;
  text-decoration: none;
  transition:
    background-color 220ms ease,
    box-shadow 220ms ease,
    color 220ms ease,
    transform 220ms ease;
  white-space: nowrap;
}

.pill-bubble--dark {
  --pill-bg: #15101d;
  --pill-text: #fff;
  --pill-hover-bg: #fff;
  --pill-hover-text: #15101d;
}

.pill-bubble--light {
  --pill-bg: #fff;
  --pill-text: #17111f;
  --pill-hover-bg: #17111f;
  --pill-hover-text: #fff;
}

.pill-bubble__icon {
  block-size: 1.15rem;
  display: inline-block;
  inline-size: 1.15rem;
}

.pill-bubble:hover,
.pill-bubble:focus-visible {
  background: var(--pill-hover-bg);
  box-shadow: 0 18px 44px rgb(63 34 110 / 36%);
  color: var(--pill-hover-text);
  outline: none;
  transform: translateY(-2px);
}

.pill-bubble--disabled {
  cursor: not-allowed;
  opacity: 0.56;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .pill-bubble {
    transition: none;
  }
}
</style>
