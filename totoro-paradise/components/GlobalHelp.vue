<script setup lang="ts">
/**
 * 全局帮助入口：右下角悬浮钮 + 快速引导弹窗（app.vue 全站挂载）。
 * - 老用户零打扰：无强制弹窗、不遮挡内容；首访气泡非阻塞，点过一次即永久消失
 * - 新用户一眼可见：48px 玻璃圆钮常驻右下角，首访气泡引导点开
 * - ?help=1 / #help 深链自动打开弹窗，并清掉地址栏参数
 * - 层级：悬浮钮 40（低于既有页面弹窗 50）、本弹窗 60（高于页面弹窗 50）
 */
const authEnabled = useRuntimeConfig().public.authEnabled;

/** 首访气泡标记：存在即不再显示 */
const NUDGE_KEY = 'totoroHelpNudged';
const open = ref(false);
const nudge = ref(false);

/* 写入"已见过帮助"标记（隐私模式等异常静默跳过） */
const markSeen = () => {
  try { localStorage.setItem(NUDGE_KEY, '1'); } catch { /* 隐私模式静默跳过 */ }
};

const openModal = () => { markSeen(); nudge.value = false; open.value = true; };
const closeModal = () => { open.value = false; };
const dismissNudge = () => { markSeen(); nudge.value = false; };

/* Esc 关闭弹窗（Vue 3.4 不支持 @keydown.escape.window 修饰符，改为手动监听，与页面弹窗同款成对增删） */
const onKeydown = (e: KeyboardEvent) => { if (e.key === 'Escape' && open.value) closeModal(); };

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  // 首访气泡：本地无标记才显示（弹窗未开由模板 v-if 保证）
  try { nudge.value = !localStorage.getItem(NUDGE_KEY); } catch { nudge.value = false; }
  // ?help=1 / #help 深链：自动开弹窗，并从地址栏清掉参数避免刷新重复弹出
  const url = new URL(location.href);
  const viaSearch = url.searchParams.get('help') === '1';
  const viaHash = url.hash === '#help' || url.hash.startsWith('#help&');
  if (viaSearch || viaHash) {
    openModal();
    if (viaSearch) url.searchParams.delete('help');
    if (viaHash) url.hash = '';
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
});
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <!-- 首访气泡（非阻塞，点 × 或打开过帮助即永久消失） -->
  <Transition name="nudge">
    <div v-if="!open && nudge" class="help-nudge" role="status" @click="openModal">
      <p class="help-nudge__text">不会使用？点这里查看说明</p>
      <button type="button" class="help-nudge__close" aria-label="关闭提示" @click.stop="dismissNudge">
        <VIcon icon="mdi-close" size="14" />
      </button>
      <span class="help-nudge__arrow" aria-hidden="true" />
    </div>
  </Transition>

  <!-- 悬浮帮助钮（弹窗打开时隐藏） -->
  <button v-if="!open" type="button" class="help-fab" aria-label="使用说明" @click="openModal">
    <VIcon icon="mdi-help-circle-outline" size="26" />
  </button>

  <!-- 快速引导弹窗 -->
  <Transition name="pop">
    <div v-if="open" class="gh-mask" @click.self="closeModal">
      <section class="gh-modal" role="dialog" aria-modal="true" aria-labelledby="gh-title">
        <button type="button" class="gh-close" aria-label="关闭" @click="closeModal">
          <VIcon icon="mdi-close" size="20" />
        </button>

        <h2 id="gh-title" class="gh-title">使用说明</h2>
        <p class="gh-sub">三步开始你的校园跑</p>

        <!-- 三步（蓝色编号圆点，质感对齐 token 页帮助弹窗） -->
        <ol class="gh-steps">
          <li>
            <span>1</span>
            <p><b>注册小程序</b>：打开微信，搜索「龙猫体育锻炼」小程序，先在手机端完成注册并上传人脸信息。</p>
          </li>
          <li>
            <span>2</span>
            <div class="gh-step-body">
              <p><b>获取龙猫ID</b>：在电脑上运行「获取龙猫ID」工具。</p>
              <a class="gh-dl" href="/downloads/totoro-id-tool-windows.exe" download="龙猫ID工具-便携版.exe">
                <VIcon icon="mdi-download" size="17" />
                <span>下载 Windows 便携版</span>
              </a>
              <p class="gh-mac">macOS：使用收到的压缩包，解压后双击 <code>启动.command</code></p>
            </div>
          </li>
          <li>
            <span>3</span>
            <p><b>登录开跑</b>：{{ authEnabled ? '登录账号，' : '' }}回本站粘贴龙猫ID完成绑定，进入任务页选择任务开始。</p>
          </li>
        </ol>

        <!-- 简版 FAQ -->
        <div class="gh-faq">
          <p class="gh-faq-label">常见问题</p>
          <dl class="gh-faq-list">
            <div class="gh-faq-item">
              <dt>龙猫ID无效或过期？</dt>
              <dd>用「获取龙猫ID」工具重新获取即可。</dd>
            </div>
            <div class="gh-faq-item">
              <dt>工具一直获取不成功？</dt>
              <dd>确认小程序是在电脑版微信打开，并检查系统代理是否已恢复。</dd>
            </div>
            <div class="gh-faq-item">
              <dt>页面显示异常？</dt>
              <dd>建议使用电脑版 Chrome / Edge 浏览器。</dd>
            </div>
          </dl>
        </div>

        <!-- 底部操作 -->
        <button type="button" class="tp-cta tp-cta--block gh-done" @click="closeModal">我知道了</button>
        <NuxtLink to="/guide" class="gh-full" @click="closeModal">查看完整使用说明 →</NuxtLink>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
/* ---------- 悬浮帮助钮 ---------- */

.help-fab {
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
  right: 22px;
  bottom: 22px;
  transition: transform var(--tp-dur) var(--tp-ease), box-shadow var(--tp-dur) var(--tp-ease);
  width: 48px;
  z-index: 40;
}

.help-fab:hover {
  box-shadow: var(--tp-shadow-card-hover);
  transform: translateY(-2px);
}

.help-fab:active { transform: scale(0.96); }

/* 焦点环沿用 kit 规范（全局 button:focus-visible 已覆盖 3px 蓝描边，此处只补偏移） */
.help-fab:focus-visible { outline-offset: 0; }

/* ---------- 首访气泡 ---------- */

.help-nudge {
  align-items: center;
  animation: gh-nudge-in 420ms var(--tp-ease) 500ms both;
  background: var(--tp-surface);
  border: 1px solid var(--tp-separator);
  border-radius: 14px;
  box-shadow: var(--tp-shadow-card);
  color: var(--tp-text);
  cursor: pointer;
  display: flex;
  gap: 6px;
  max-width: 252px;
  padding: 10px 10px 10px 14px;
  position: fixed;
  right: 22px;
  bottom: 86px;
  z-index: 40;
}

.help-nudge__text {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.45;
  margin: 0;
}

.help-nudge__close {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 50%;
  color: var(--tp-text-3);
  cursor: pointer;
  display: flex;
  flex: none;
  height: 24px;
  justify-content: center;
  padding: 0;
  transition: color var(--tp-dur) ease, background var(--tp-dur) ease;
  width: 24px;
}

.help-nudge__close:hover {
  background: var(--tp-fill);
  color: var(--tp-text);
}

/* 小箭头：指向下方悬浮钮 */
.help-nudge__arrow {
  background: var(--tp-surface);
  border-left: 1px solid var(--tp-separator);
  border-bottom: 1px solid var(--tp-separator);
  height: 10px;
  position: absolute;
  right: 17px;
  bottom: -6px;
  transform: rotate(45deg);
  width: 10px;
}

@keyframes gh-nudge-in {
  from { opacity: 0; transform: translateY(10px) scale(0.96); }
  to { opacity: 1; transform: none; }
}

/* 消失时淡出下移（出现动画由上方 keyframes 负责） */
.nudge-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.nudge-leave-to { opacity: 0; transform: translateY(6px); }

@media (prefers-reduced-motion: reduce) {
  .help-nudge { animation: none; }
}

/* ---------- 弹窗遮罩（视觉同 tp-mask，层级更高：页面弹窗 50 < 本弹窗 60） ---------- */

.gh-mask {
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

/* ---------- 弹窗卡片（质感对齐 token 页 help-modal） ---------- */

.gh-modal {
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

.gh-close {
  align-items: center;
  background: var(--tp-fill);
  border: 0;
  border-radius: 50%;
  color: var(--tp-text-2);
  cursor: pointer;
  display: flex;
  height: 44px;
  justify-content: center;
  padding: 0;
  position: absolute;
  right: 14px;
  top: 14px;
  transition: background var(--tp-dur) ease, color var(--tp-dur) ease;
  width: 44px;
}

.gh-close:hover {
  background: var(--tp-fill-hover);
  color: var(--tp-text);
}

.gh-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
  padding-right: 52px;
}

.gh-sub {
  color: var(--tp-text-2);
  font-size: 13px;
  margin: 6px 0 18px;
}

/* ---------- 三步（编号圆点对齐 token 页 .steps） ---------- */

.gh-steps {
  list-style: none;
  margin: 0;
  padding: 0;
}

.gh-steps li {
  align-items: flex-start;
  display: grid;
  gap: 12px;
  grid-template-columns: 26px 1fr;
  padding: 9px 0;
}

.gh-steps li > span {
  align-items: center;
  background: var(--tp-blue);
  border-radius: 50%;
  color: var(--tp-surface);
  display: flex;
  font-size: 11px;
  font-weight: 700;
  height: 26px;
  justify-content: center;
  width: 26px;
}

.gh-steps li > p,
.gh-step-body > p {
  color: var(--tp-text-2);
  font-size: 13px;
  line-height: 1.65;
  margin: 3px 0 0;
}

.gh-steps b {
  color: var(--tp-text);
  font-weight: 600;
}

.gh-step-body { min-width: 0; }

/* 步骤 2 内的下载链与 macOS 备注 */
.gh-dl {
  align-items: center;
  background: rgba(0, 113, 227, 0.08);
  border: 1px solid rgba(0, 113, 227, 0.16);
  border-radius: 10px;
  color: var(--tp-blue);
  display: inline-flex;
  font-size: 12.5px;
  font-weight: 600;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 12px;
  text-decoration: none;
  transition: background var(--tp-dur) var(--tp-ease);
}

.gh-dl:hover { background: rgba(0, 113, 227, 0.13); }

.gh-dl:focus-visible {
  outline: 3px solid var(--tp-blue);
  outline-offset: 2px;
}

.gh-mac {
  color: var(--tp-text-3);
  font-size: 12px;
  margin-top: 7px;
}

.gh-mac code,
.gh-steps code {
  background: var(--tp-fill);
  border-radius: 5px;
  color: var(--tp-blue);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11.5px;
  padding: 2px 5px;
}

/* ---------- 简版 FAQ ---------- */

.gh-faq {
  border-top: 1px solid var(--tp-separator);
  margin-top: 14px;
  padding-top: 13px;
}

.gh-faq-label {
  color: var(--tp-text-2);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  margin: 0 0 4px;
}

.gh-faq-list { margin: 0; }

.gh-faq-item + .gh-faq-item {
  border-top: 1px solid var(--tp-separator);
  margin-top: 11px;
  padding-top: 11px;
}

.gh-faq-item dt {
  color: var(--tp-text);
  font-size: 13px;
  font-weight: 600;
}

.gh-faq-item dd {
  color: var(--tp-text-2);
  font-size: 12.5px;
  line-height: 1.6;
  margin: 3px 0 0;
}

/* ---------- 底部操作 ---------- */

.gh-done { margin-top: 18px; }

.gh-full {
  color: var(--tp-blue);
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-top: 12px;
  padding: 6px;
  text-align: center;
  text-decoration: none;
}

.gh-full:hover { text-decoration: underline; }

/* ---------- 弹窗过渡（scale + fade，同 token 页 pop） ---------- */

.pop-enter-active,
.pop-leave-active { transition: opacity 260ms var(--tp-ease); }

.pop-enter-active .gh-modal,
.pop-leave-active .gh-modal { transition: transform 260ms var(--tp-ease); }

.pop-enter-from,
.pop-leave-to { opacity: 0; }

.pop-enter-from .gh-modal,
.pop-leave-to .gh-modal { transform: scale(0.94) translateY(12px); }

/* ---------- 移动端 ---------- */

@media (max-width: 560px) {
  .help-fab {
    right: 16px;
    bottom: 16px;
  }

  .help-nudge {
    right: 16px;
    bottom: 78px;
    max-width: min(252px, calc(100vw - 32px));
  }

  .gh-mask { padding: 16px; }

  .gh-modal { padding: 24px 20px 20px; }
}
</style>
