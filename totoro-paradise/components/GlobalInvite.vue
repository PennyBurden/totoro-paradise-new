<script setup lang="ts">
/**
 * 全局邀请入口：悬浮钮 + 分享海报弹窗（app.vue 全站挂载，与 GlobalHelp 并排）。
 * - 纯前端分享号召：无邀请码、无统计、无奖励，二维码只编码站点地址
 * - 老用户零打扰：无常驻气泡、不写任何本地存储；海报首次打开弹窗时才生成并缓存
 * - ?invite=1 / #invite 深链自动打开弹窗（仅供测试与手动链接；二维码不带该参数，
 *   扫码进来的是新访客，不该看到邀请弹窗）
 * - 层级：悬浮钮 40（与帮助钮同层水平并排）、本弹窗 60（对齐 GlobalHelp 约定）
 */
import { buildInvitePoster } from '~/utils/invite-poster';

/**
 * 站点分享地址：默认当前 origin；将来部署正式域名后可在 nuxt.config 的
 * runtimeConfig.public 加 shareUrl 一行覆盖（dev 期二维码编码 localhost 属预期限制）。
 */
const shareUrl = (useRuntimeConfig().public as { shareUrl?: string }).shareUrl || location.origin;

const open = ref(false);
const canShare = ref(false);
/** 微信内置浏览器：无 navigator.share、a[download] 无效 → 主 CTA 换成长按引导 */
const isWechat = ref(false);
const poster = ref<{ dataUrl: string } | null>(null);
/** 海报生成失败：隐藏预览与保存/分享钮，复制链接仍可用 */
const posterFailed = ref(false);
const feedback = ref<{ type: 'ok' | 'err'; text: string } | null>(null);
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
/** 进行中的海报生成（防弱网下关-开弹窗并发跑两份 1500×2000 合成） */
let posterPromise: Promise<void> | undefined;
/** 弹窗内关闭钮 / 悬浮钮引用：开弹窗聚焦前者（Tab 不再穿透到背景），关弹窗焦点归位 */
const closeEl = ref<HTMLButtonElement | null>(null);
const fabEl = ref<HTMLButtonElement | null>(null);
/** 背景滚动锁：开弹窗锁 html 滚动，关弹窗还原 */
let savedOverflow = '';

/* 行内反馈 3 秒自动消失；新反馈/关弹窗时清掉旧计时器防串台 */
const showFeedback = (type: 'ok' | 'err', text: string) => {
  clearTimeout(feedbackTimer);
  feedback.value = { type, text };
  feedbackTimer = setTimeout(() => { feedback.value = null; }, 3000);
};
const clearFeedback = () => {
  clearTimeout(feedbackTimer);
  feedback.value = null;
};

const openModal = () => {
  open.value = true;
  savedOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden'; /* 锁背景滚动 */
  nextTick(() => closeEl.value?.focus());
  /* 缓存进行中的 Promise：结果只算一次，弱网下反复开关弹窗不会并发合成 */
  if (!posterPromise && !posterFailed.value) {
    posterPromise = buildInvitePoster(shareUrl)
      .then((p) => { poster.value = p; })
      .catch(() => { posterFailed.value = true; });
  }
};
const closeModal = () => {
  open.value = false;
  document.documentElement.style.overflow = savedOverflow;
  clearFeedback();
  nextTick(() => fabEl.value?.focus());
};

/* Esc 关闭弹窗（Vue 3.4 不支持 @keydown.escape.window 修饰符，改为手动监听，与页面弹窗同款成对增删） */
const onKeydown = (e: KeyboardEvent) => { if (e.key === 'Escape' && open.value) closeModal(); };

/* execCommand 同步复制（离屏 textarea）。微信 iOS 的 execCommand 依赖用户手势，
   必须在点击的同步调用栈里执行，不能出现在任何 await 之后 */
const copyViaExecCommand = (text: string): boolean => {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0'; /* 不触发滚动、不闪现 */
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
};

/* 复制文本：clipboard API + execCommand 降级。微信内直接走 execCommand——
   HTTPS 下 clipboard API 虽存在但 iOS 微信里异步降级会丢手势，同步路径最稳 */
const copyText = async (text: string): Promise<boolean> => {
  if (isWechat.value) return copyViaExecCommand(text);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* 权限拒绝等 → 走降级 */ }
  return copyViaExecCommand(text);
};

const copyLink = async () => {
  const ok = await copyText(shareUrl);
  showFeedback(ok ? 'ok' : 'err', ok ? '链接已复制' : '复制失败，请手动复制上方链接');
};

/* 保存海报（微信等不支持 a[download] 的环境为静默无操作，长按海报提示已在弹窗内常驻） */
const downloadPoster = () => {
  if (!poster.value) return;
  const a = document.createElement('a');
  a.href = poster.value.dataUrl;
  a.download = '龙猫跑轮-邀请海报.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
};

/* 系统分享：优先带海报图文件（iOS 等可直接存图/发图），不支持时退回文本 + 链接。
   Blob 从 dataUrl 现取，不常驻 canvas 位图（能走到这里的环境 fetch data: 必可用） */
const share = async () => {
  const p = poster.value;
  if (!p) return;
  try {
    const blob = await (await fetch(p.dataUrl)).blob();
    const file = new File([blob], '龙猫跑轮-邀请海报.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: '龙猫跑轮', text: '把每一次校园跑变简单。' });
    } else {
      await navigator.share({ title: '龙猫跑轮', text: '把每一次校园跑变简单。', url: shareUrl });
    }
  } catch (e) {
    /* 用户取消分享（AbortError）静默 */
    if ((e as DOMException)?.name !== 'AbortError') showFeedback('err', '分享未完成，可以长按海报保存图片');
  }
};

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  // 微信内置浏览器无 navigator.share、a[download] 无效 → 按钮不渲染，长按海报为主路径
  canShare.value = typeof navigator.share === 'function';
  isWechat.value = /MicroMessenger/i.test(navigator.userAgent);
  // ?invite=1 / #invite 深链：自动开弹窗，并从地址栏清掉参数避免刷新重复弹出。
  // 与 help 深链互斥：help=1/#help 同时出现时让给先挂载的 GlobalHelp，避免两个 z-60 弹窗叠开
  const url = new URL(location.href);
  const viaSearch = url.searchParams.get('invite') === '1';
  const viaHash = url.hash === '#invite' || url.hash.startsWith('#invite&');
  const helpWanted = url.searchParams.has('help') || url.hash.startsWith('#help');
  if ((viaSearch || viaHash) && !helpWanted) {
    openModal();
    if (viaSearch) url.searchParams.delete('invite');
    if (viaHash) url.hash = '';
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
});
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  if (open.value) document.documentElement.style.overflow = savedOverflow; /* 弹窗开着被卸载时还原滚动锁 */
  clearFeedback();
});
</script>

<template>
  <!-- 悬浮邀请钮（弹窗打开时隐藏；与帮助钮水平并排在其左侧） -->
  <button v-if="!open" ref="fabEl" type="button" class="gi-fab" aria-label="邀请同学" @click="openModal">
    <VIcon icon="mdi-share-variant" size="26" />
  </button>

  <!-- 分享海报弹窗 -->
  <Transition name="pop">
    <div v-if="open" class="gi-mask" @click.self="closeModal">
      <section class="gi-modal" role="dialog" aria-modal="true" aria-labelledby="gi-title">
        <button ref="closeEl" type="button" class="gi-close" aria-label="关闭" @click="closeModal">
          <VIcon icon="mdi-close" size="20" />
        </button>

        <h2 id="gi-title" class="gi-title">邀请同学一起跑</h2>
        <p class="gi-sub">把龙猫跑轮分享给身边同学</p>

        <!-- 海报预览（勿加 user-select / touch-callout 抑制：微信长按识别/保存依赖系统菜单） -->
        <div v-if="poster" class="gi-poster-wrap">
          <img class="gi-poster" :src="poster.dataUrl" alt="龙猫跑轮邀请海报，含二维码与站点地址">
        </div>
        <p v-else-if="posterFailed" class="tp-msg tp-msg--err gi-poster-fail">海报生成失败，可直接复制下方链接分享</p>
        <div v-else class="gi-poster-loading" role="status" aria-label="海报生成中"><span class="tp-spinner" /></div>

        <!-- 复制链接行 -->
        <div class="gi-link-row">
          <span class="gi-link-text">{{ shareUrl }}</span>
          <button type="button" class="tp-cta tp-cta--sm" @click="copyLink">复制链接</button>
        </div>

        <!-- 行内反馈（3 秒自动消失） -->
        <p v-if="feedback" class="tp-msg gi-feedback" :class="feedback.type === 'ok' ? 'tp-msg--ok' : 'tp-msg--err'" role="status">
          {{ feedback.text }}
        </p>

        <!-- 底部操作：微信内 a[download] 是静默无效操作，主 CTA 换成长按引导，避免死按钮 -->
        <button v-if="poster && !isWechat" type="button" class="tp-cta tp-cta--block gi-save" @click="downloadPoster">保存海报图片</button>
        <p v-if="poster && isWechat" class="gi-wechat-cta">
          <VIcon icon="mdi-gesture-tap-hold" size="20" />
          <span>长按上方海报，保存图片或识别二维码</span>
        </p>
        <button v-if="canShare && poster" type="button" class="gi-share" @click="share">分享…</button>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
/* ---------- 悬浮邀请钮（与帮助钮并排在其左侧，避开帮助首访气泡区） ---------- */

.gi-fab {
  align-items: center;
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  backdrop-filter: blur(16px) saturate(160%);
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--tp-separator);
  border-radius: 50%;
  box-shadow: var(--tp-shadow-card);
  color: var(--tp-blue);
  cursor: pointer;
  display: flex;
  height: 48px;
  justify-content: center;
  padding: 0;
  position: fixed;
  right: 82px;
  bottom: 22px;
  transition: transform var(--tp-dur) var(--tp-ease), box-shadow var(--tp-dur) var(--tp-ease);
  width: 48px;
  z-index: 40;
}

.gi-fab:hover {
  box-shadow: var(--tp-shadow-card-hover);
  transform: translateY(-2px);
}

.gi-fab:active { transform: scale(0.96); }

/* 焦点环沿用 kit 规范（全局 button:focus-visible 已覆盖 3px 蓝描边，此处只补偏移） */
.gi-fab:focus-visible { outline-offset: 0; }

/* ---------- 弹窗遮罩（视觉同 tp-mask，层级同 GlobalHelp：页面弹窗 50 < 本弹窗 60） ---------- */

.gi-mask {
  align-items: center;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  background: rgba(0, 0, 0, 0.28);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 24px;
  position: fixed;
  z-index: 60;
}

/* ---------- 弹窗卡片 ---------- */

.gi-modal {
  background: var(--tp-surface);
  border-radius: var(--tp-radius-card);
  box-shadow: var(--tp-shadow-float);
  max-height: calc(100vh - 48px);
  max-height: calc(100dvh - 48px);
  max-width: 432px;
  overflow-y: auto;
  padding: 28px 28px 24px;
  position: relative;
  width: 100%;
}

/* 关闭钮 sticky：矮屏弹窗内部滚动时贴住可视区顶，不随内容滚出视口
   （负 margin 抵消弹窗 padding，视觉位置与原 absolute 一致） */
.gi-close {
  align-items: center;
  background: var(--tp-fill);
  border: 0;
  border-radius: 50%;
  color: var(--tp-text-2);
  cursor: pointer;
  display: flex;
  height: 44px;
  justify-content: center;
  margin: -14px -14px 0 auto;
  padding: 0;
  position: sticky;
  top: 14px;
  transition: background var(--tp-dur) ease, color var(--tp-dur) ease;
  width: 44px;
  z-index: 1;
}

.gi-close:hover {
  background: var(--tp-fill-hover);
  color: var(--tp-text);
}

.gi-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
  padding-right: 52px;
}

.gi-sub {
  color: var(--tp-text-2);
  font-size: 13px;
  margin: 6px 0 18px;
}

/* ---------- 海报预览 ---------- */

.gi-poster-wrap { margin: 2px 0 0; }

.gi-poster {
  border: 1px solid var(--tp-separator);
  border-radius: 16px;
  box-shadow: var(--tp-shadow-card);
  display: block;
  margin: 0 auto;
  max-width: 300px;
  width: 100%;
}

.gi-poster-loading {
  align-items: center;
  display: flex;
  justify-content: center;
  min-height: 220px;
}

.gi-poster-fail { margin: 0; }

/* 微信内主操作引导（替代无效的保存按钮） */
.gi-wechat-cta {
  align-items: center;
  background: var(--tp-fill);
  border-radius: var(--tp-radius-control);
  color: var(--tp-text);
  display: flex;
  font-size: 14px;
  font-weight: 600;
  gap: 8px;
  justify-content: center;
  margin: 16px 0 0;
  padding: 13px 14px;
}

/* ---------- 复制链接行 ---------- */

.gi-link-row {
  align-items: center;
  background: var(--tp-fill);
  border-radius: var(--tp-radius-control);
  display: flex;
  gap: 10px;
  margin-top: 14px;
  padding: 6px 6px 6px 14px;
}

.gi-link-text {
  color: var(--tp-text-2);
  flex: 1;
  font-size: 13px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gi-link-row .tp-cta { flex: none; }

/* ---------- 反馈与底部操作 ---------- */

.gi-feedback { margin: 11px 0 0; }

.gi-save { margin-top: 16px; }

.gi-share {
  background: transparent;
  border: 0;
  color: var(--tp-blue);
  cursor: pointer;
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin: 12px auto 0;
  padding: 6px;
  text-align: center;
}

.gi-share:hover { text-decoration: underline; }

/* ---------- 弹窗过渡（scale + fade，同 GlobalHelp pop） ---------- */

.pop-enter-active,
.pop-leave-active { transition: opacity 260ms var(--tp-ease); }

.pop-enter-active .gi-modal,
.pop-leave-active .gi-modal { transition: transform 260ms var(--tp-ease); }

.pop-enter-from,
.pop-leave-to { opacity: 0; }

.pop-enter-from .gi-modal,
.pop-leave-to .gi-modal { transform: scale(0.94) translateY(12px); }

/* ---------- 移动端 ---------- */

@media (max-width: 560px) {
  .gi-fab {
    right: 76px;
    bottom: 16px;
  }

  .gi-mask { padding: 16px; }

  .gi-modal { padding: 24px 20px 20px; }

  /* 弹窗 padding 更窄，关闭钮负 margin 相应收小保持视觉边距 */
  .gi-close { margin: -10px -6px 0 auto; top: 10px; }
}
</style>
