<script setup lang="ts">
/**
 * 使用说明（完整版）：快速开始 / 页面流程 / 常见问题 / 工具下载。
 * 事实与 pages/token.vue 帮助弹窗、pages/scanned.vue、pages/run/[route].vue 及 README 保持一致。
 */
const authEnabled = useRuntimeConfig().public.authEnabled;

/* ---------- 锚点导航 ---------- */
const anchors = [
  { id: 'quickstart', label: '快速开始' },
  { id: 'flow', label: '页面流程' },
  { id: 'faq', label: '常见问题' },
  { id: 'tool', label: '工具下载' },
];

/* ---------- 快速开始三步（与首页 hero 面板、全局帮助弹窗同源文案） ---------- */
const steps = [
  { icon: '/images/mobile-phone-3d.png', t: '注册小程序', d: '打开微信，搜索「龙猫体育锻炼」小程序；先在手机端完成注册并上传人脸信息。' },
  { icon: '/images/key-3d.png', t: '获取龙猫ID', d: '在电脑上运行「获取龙猫ID」工具，获取成功后复制终端中显示的龙猫ID。' },
  { icon: '/images/person-running-3d.png', t: '登录开跑', d: `回到本站${authEnabled ? '登录账号，' : ''}粘贴龙猫ID完成绑定，开始你的校园跑。` },
];

/* ---------- 页面流程（按真实页面行为描述；个人中心仅登录功能开启时存在） ---------- */
const flow = computed(() => {
  const list = [
    { t: '绑定龙猫ID', d: '进入绑定页，选择学校、粘贴龙猫ID后点击「确认绑定」，验证通过自动进入任务页。龙猫ID仅保存在当前浏览器。' },
    { t: '任务页', d: '查看今日任务的里程、用时、时段等要求，选择路线（也可随机选择）后点击「开始跑步」；校园未设路线（自由跑）时无需选择，直接开始。地图路线仅为示意。' },
    { t: '跑步页', d: '再次确认信息后点击「确认开跑」。跑步由服务器自动完成，开始后可关闭本页；完成后成绩自动提交，去小程序即可查看记录。' },
  ];
  if (authEnabled) {
    list.push({ t: '个人中心', d: '查看剩余次数，输入充值码（形如 TP-XXXXX-XXXXX）兑换次数；每次成功提交成绩消耗 1 次。' });
  }
  return list;
});

/* ---------- 常见问题（事实取自 README 与页面代码，不虚构） ---------- */
const faqs = computed(() => {
  const list = [
    { q: '龙猫ID无效或过期怎么办？', a: '绑定页提示「龙猫ID无效或已过期」时，用「获取龙猫ID」工具重新获取一个，回到绑定页重新粘贴绑定即可。' },
    { q: '获取工具一直不成功怎么办？', a: '确认「龙猫体育锻炼」小程序是在电脑版微信中打开，关闭小程序后重试；仍不成功请检查系统代理是否已恢复（见下方工具说明）。' },
    { q: '用什么浏览器？', a: '建议使用电脑版 Chrome 或 Edge 浏览器访问本站；页面显示异常时，先更换浏览器再重试。' },
    { q: '手机能用吗？', a: '不建议。「获取龙猫ID」工具只有 Windows / macOS 电脑版本，整个流程建议在电脑上完成。' },
    { q: '学校开启人脸核验有什么影响？', a: '本工具无法完成跑前人脸校验和中途随机人脸抽查。若学校开启了人脸核验，成绩可能被服务端标记为「人脸异常」或判定无效；该配置只记录在浏览器控制台日志中，流程本身不会被阻断。' },
  ];
  if (authEnabled) {
    list.push({ q: '次数怎么计算、怎么兑换？', a: '每次成功提交成绩消耗 1 次。购买后获得的充值码（形如 TP-XXXXX-XXXXX）在「个人中心」输入兑换，次数自动充入账户。' });
  }
  return list;
});
</script>

<template>
  <div class="tp-page">
    <nav class="tp-nav">
      <div class="tp-nav-side">
        <NuxtLink to="/" class="tp-back">‹ 返回首页</NuxtLink>
      </div>
    </nav>

    <header class="guide-hero tp-rise">
      <h1 class="tp-title">使用说明</h1>
      <p class="tp-subtitle">注册小程序、获取龙猫ID、登录开跑</p>
    </header>

    <!-- 锚点导航：页内快速跳转（html 已 scroll-behavior:smooth） -->
    <nav class="anchor-nav tp-rise" aria-label="页面目录">
      <a v-for="a in anchors" :key="a.id" :href="`#${a.id}`" class="anchor-chip">{{ a.label }}</a>
    </nav>

    <!-- 快速开始 -->
    <section id="quickstart" class="guide-section" aria-label="快速开始">
      <h2 class="guide-sec-title">快速开始</h2>
      <div class="guide-steps">
        <article v-for="(s, i) in steps" :key="s.t" class="tp-card tp-card--pad guide-step">
          <img class="guide-step__icon" :src="s.icon" alt="" width="64" height="64" draggable="false">
          <div class="guide-step__body">
            <p class="guide-step__eyebrow">第 {{ i + 1 }} 步</p>
            <h3 class="guide-step__name">{{ s.t }}</h3>
            <p class="guide-step__desc">{{ s.d }}</p>
          </div>
        </article>
      </div>
    </section>

    <!-- 页面流程 -->
    <section id="flow" class="guide-section" aria-label="页面流程">
      <h2 class="guide-sec-title">页面流程</h2>
      <ol class="flow-list">
        <li v-for="(f, i) in flow" :key="f.t" class="tp-card tp-card--pad flow-card">
          <span class="flow-no" aria-hidden="true">{{ i + 1 }}</span>
          <div class="flow-body">
            <h3 class="flow-name">{{ f.t }}</h3>
            <p class="flow-desc">{{ f.d }}</p>
          </div>
        </li>
      </ol>
    </section>

    <!-- 常见问题 -->
    <section id="faq" class="guide-section" aria-label="常见问题">
      <h2 class="guide-sec-title">常见问题</h2>
      <section class="tp-card tp-card--pad faq-card">
        <div v-for="f in faqs" :key="f.q" class="faq-item">
          <h3 class="faq-q">{{ f.q }}</h3>
          <p class="faq-a">{{ f.a }}</p>
        </div>
      </section>
    </section>

    <!-- 获取龙猫ID 工具 -->
    <section id="tool" class="guide-section" aria-label="获取龙猫ID工具">
      <h2 class="guide-sec-title">获取龙猫ID 工具</h2>
      <section class="tp-card tp-card--pad tool-card">
        <a
          class="tool-download"
          href="/downloads/totoro-id-tool-windows.exe"
          download="龙猫ID工具-便携版.exe"
        >
          <span class="tool-download__icon"><VIcon icon="mdi-download" size="22" /></span>
          <span class="tool-download__text">
            <b>下载 Windows 便携版</b>
            <small>约 71 MB · EXE 文件</small>
          </span>
          <VIcon icon="mdi-chevron-right" size="20" />
        </a>
        <p class="tool-mac">macOS：使用收到的工具压缩包，解压后双击 <code>启动.command</code>。</p>
        <ol class="tool-steps">
          <li>
            <span>1</span>
            <p>Windows 双击 <code>龙猫ID工具-便携版.exe</code> 运行；macOS 双击 <code>启动.command</code>。</p>
          </li>
          <li>
            <span>2</span>
            <p>在电脑微信中打开「龙猫体育锻炼」小程序，等待工具提示获取成功。</p>
          </li>
          <li>
            <span>3</span>
            <p>复制窗口中显示的龙猫ID，粘贴到绑定页；也可以从工具目录下的 <code>龙猫ID.txt</code> 中复制。</p>
          </li>
        </ol>
        <div class="tool-note">
          <b>工具说明</b>
          <p>运行期间会临时使用本机代理，仅读取龙猫相关域名。完成后会恢复网络设置，在窗口中显示龙猫ID，并保存到工具目录下的 <code>龙猫ID.txt</code>。工具不会自动打开网页。</p>
        </div>
        <div class="tool-fallback">
          <b>遇到问题？</b>
          <p>如果一直没有获取成功，请确认小程序是在电脑微信中打开，并关闭后重试。如果网络异常：Windows 前往「设置 → 网络和 Internet → 代理」，关闭「使用代理服务器」；macOS 前往「系统设置 → 网络 → 详细信息 → 代理」，关闭「网页代理」和「安全网页代理」。</p>
        </div>
      </section>
    </section>

    <p class="guide-note tp-rise" role="note">本项目仅供学习交流，禁止用于任何其他用途</p>

    <NuxtLink to="/" class="tp-cta tp-cta--block guide-cta">前往首页</NuxtLink>
  </div>
</template>

<style scoped>
/* ---------- 头部 ---------- */

.guide-hero {
  margin: 46px 2px 22px;
}

/* ---------- 锚点导航（小胶囊一排，可换行） ---------- */

.anchor-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 28px;
}

.anchor-chip {
  background: var(--tp-fill);
  border-radius: 999px;
  color: var(--tp-text);
  font-size: 13px;
  font-weight: 600;
  padding: 9px 16px;
  text-decoration: none;
  transition: background 150ms ease;
}

.anchor-chip:hover { background: var(--tp-fill-hover); }

.anchor-chip:focus-visible {
  outline: 3px solid var(--tp-blue);
  outline-offset: 2px;
}

/* ---------- 分节（锚点目标避开吸顶导航） ---------- */

.guide-section {
  margin-bottom: 34px;
  scroll-margin-top: 72px;
}

.guide-sec-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 2px 14px;
}

/* ---------- 快速开始三步卡片 ---------- */

.guide-steps {
  margin-bottom: 0;
}

.guide-step {
  align-items: center;
  animation: tp-rise 480ms var(--tp-ease) both;
  display: flex;
  gap: 20px;
}

.guide-step:nth-child(2) { animation-delay: 80ms; }
.guide-step:nth-child(3) { animation-delay: 160ms; }

.guide-step__icon {
  flex: none;
  height: 64px;
  width: 64px;
}

.guide-step__body { min-width: 0; }

.guide-step__eyebrow {
  color: var(--tp-blue);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  margin: 0 0 4px;
  text-transform: uppercase;
}

.guide-step__name {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0 0 5px;
}

.guide-step__desc {
  color: var(--tp-text-2);
  font-size: 14px;
  line-height: 1.55;
  margin: 0;
}

/* ---------- 页面流程（编号卡片链路） ---------- */

.flow-list {
  display: grid;
  gap: 12px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.flow-card {
  align-items: flex-start;
  display: flex;
  gap: 14px;
  margin-bottom: 0;
}

.flow-no {
  align-items: center;
  background: var(--tp-blue);
  border-radius: 50%;
  color: var(--tp-surface);
  display: flex;
  flex: none;
  font-size: 13px;
  font-weight: 700;
  height: 28px;
  justify-content: center;
  margin-top: 2px;
  width: 28px;
}

.flow-body { min-width: 0; }

.flow-name {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0 0 4px;
}

.flow-desc {
  color: var(--tp-text-2);
  font-size: 13.5px;
  line-height: 1.6;
  margin: 0;
}

/* ---------- 常见问题（iOS 分组列表：一张卡 + 发丝分隔线） ---------- */

.faq-item + .faq-item {
  border-top: 1px solid var(--tp-separator);
  margin-top: 16px;
  padding-top: 16px;
}

.faq-q {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0 0 6px;
}

.faq-a {
  color: var(--tp-text-2);
  font-size: 13.5px;
  line-height: 1.65;
  margin: 0;
}

/* ---------- 获取龙猫ID 工具卡（质感对齐 token 页帮助弹窗） ---------- */

.tool-download {
  align-items: center;
  background: rgba(0, 113, 227, 0.08);
  border: 1px solid rgba(0, 113, 227, 0.16);
  border-radius: 12px;
  color: var(--tp-blue);
  display: flex;
  gap: 12px;
  margin: 0 0 10px;
  padding: 12px 14px;
  text-decoration: none;
  transition: background var(--tp-dur) var(--tp-ease), transform var(--tp-dur) var(--tp-ease);
}

.tool-download:hover {
  background: rgba(0, 113, 227, 0.13);
  transform: translateY(-1px);
}

.tool-download:focus-visible {
  outline: 3px solid var(--tp-blue);
  outline-offset: 2px;
}

.tool-download__icon {
  align-items: center;
  background: var(--tp-blue);
  border-radius: 9px;
  color: white;
  display: flex;
  flex: 0 0 38px;
  height: 38px;
  justify-content: center;
}

.tool-download__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.tool-download__text b {
  font-size: 13px;
  font-weight: 700;
}

.tool-download__text small {
  color: var(--tp-text-2);
  font-size: 11px;
}

.tool-mac {
  color: var(--tp-text-2);
  font-size: 13px;
  line-height: 1.6;
  margin: 0 0 6px;
}

.tool-mac code,
.tool-steps code,
.tool-note code,
.tool-fallback code {
  background: var(--tp-fill);
  border-radius: 5px;
  color: var(--tp-blue);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  padding: 2px 5px;
}

.tool-steps {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
}

.tool-steps li {
  align-items: flex-start;
  display: grid;
  gap: 12px;
  grid-template-columns: 26px 1fr;
  padding: 9px 0;
}

.tool-steps li > span {
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

.tool-steps li > p {
  color: var(--tp-text-2);
  font-size: 13px;
  line-height: 1.65;
  margin: 3px 0 0;
}

/* 工具说明 / 故障排查 */
.tool-note,
.tool-fallback {
  border-top: 1px solid var(--tp-separator);
  margin-top: 14px;
  padding-top: 14px;
}

.tool-note b,
.tool-fallback b {
  color: var(--tp-text);
  display: block;
  font-size: 13px;
  margin-bottom: 5px;
}

.tool-note p,
.tool-fallback p {
  color: var(--tp-text-2);
  font-size: 12.5px;
  line-height: 1.65;
  margin: 0;
}

/* ---------- 免责声明 ---------- */

.guide-note {
  background: var(--tp-fill);
  border-radius: var(--tp-radius-control);
  color: var(--tp-text-2);
  font-size: 13px;
  margin: 0 0 22px;
  padding: 13px 16px;
  text-align: center;
}

/* ---------- 底部 CTA ---------- */

.guide-cta {
  animation: tp-rise 480ms var(--tp-ease) 240ms both;
}

/* ---------- 移动端 ---------- */

@media (max-width: 560px) {
  .guide-hero {
    margin: 30px 2px 18px;
  }

  .anchor-nav {
    margin-bottom: 22px;
  }

  .guide-section {
    margin-bottom: 26px;
    scroll-margin-top: 66px;
  }

  .guide-sec-title {
    font-size: 18px;
    margin-bottom: 11px;
  }

  .guide-step {
    gap: 14px;
    padding: 18px 16px;
  }

  .guide-step__icon {
    height: 48px;
    width: 48px;
  }

  .guide-step__name {
    font-size: 17px;
  }

  .guide-step__desc {
    font-size: 13px;
  }

  .flow-card {
    gap: 12px;
    padding: 16px;
  }

  .faq-item + .faq-item {
    margin-top: 13px;
    padding-top: 13px;
  }

  .faq-q { font-size: 14.5px; }

  .faq-a { font-size: 13px; }

  .tool-card { padding: 18px 16px 16px; }
}
</style>
