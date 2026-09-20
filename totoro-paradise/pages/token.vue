<script setup lang="ts">
import type { SchoolItem } from '~~/src/types/responseTypes/GetSchoolListResponse';
import TotoroApiWrapper, { setTotoroContext } from '~/src/wrappers/TotoroApiWrapper';
import { pickDevice } from '~~/src/utils/device';
import { persistSession } from '~/composables/useSession';

definePageMeta({ middleware: 'auth' });
const router = useRouter();
const session = useSession();
const schoolList = ref<SchoolItem[]>([]);
const selectedSchool = ref<SchoolItem | null>(null);
const token = ref('');
const message = ref('');
const loading = ref(false);
const schoolsLoading = ref(true);
const showIdHelp = ref(false);
const helpPlatform = ref<'windows' | 'mac'>('windows');
const authStatus = ref<{ loggedIn: boolean; remaining: number; totalRuns: number } | null>(null);
// 账号登录功能开关(false 时隐藏剩余次数等账号 UI)
const authEnabled = useRuntimeConfig().public.authEnabled;

// Esc 关闭帮助弹窗（Vue 3.4 不支持 @keydown.escape.window 修饰符，改为手动监听）
const onMaskKeydown = (e: KeyboardEvent) => { if (e.key === 'Escape' && showIdHelp.value) showIdHelp.value = false; };
onMounted(() => window.addEventListener('keydown', onMaskKeydown));
onUnmounted(() => window.removeEventListener('keydown', onMaskKeydown));

const completeLogin = async (tkn: string, host: string) => {
  loading.value = true;
  message.value = message.value || '';
  try {
    if (!session.value.device) session.value.device = pickDevice();
    setTotoroContext({ token: tkn, host, ua: session.value.device.ua });
    const info = await TotoroApiWrapper.getStudentInfoByToken(tkn);
    if (`${info.code}` !== '0' || !info.obj?.snCode) {
      message.value = info.message ?? info.msg ?? '龙猫ID无效或已过期';
      return;
    }
    const matchedHost = schoolList.value.find(s => s.schoolCode === info.obj?.schoolCode)?.domainUrl ?? host;
    if (matchedHost !== host) setTotoroContext({ host: matchedHost });
    session.value = { ...session.value, token: tkn, host: matchedHost, schoolCode: info.obj?.schoolCode ?? '', schoolName: info.obj?.schoolName ?? '', userInfo: info.obj! };
    const breq = { snCode: info.obj!.snCode, token: tkn };
    await Promise.allSettled([
      TotoroApiWrapper.getMornSignPaper(breq),
      TotoroApiWrapper.getAppFrontPage(breq),
      TotoroApiWrapper.selectSunRunNote(),
    ]);
    persistSession(session.value);
    router.push('/scanned');
  } catch (e) {
    console.error(e);
    message.value = '龙猫服务器错误';
  } finally { loading.value = false; }
};

onMounted(async () => {
  // 已绑定龙猫ID且非重新绑定(无 hash token)时直达任务页
  const hashRebind = /[#&]token=/.test(location.hash);
  if (session.value.userInfo && !hashRebind) {
    await navigateTo('/scanned');
    return;
  }
  const [statusResult, schoolResult] = await Promise.allSettled([
    authEnabled
      ? $fetch<{ loggedIn: boolean; remaining: number; totalRuns: number }>('/api/auth/status')
      : Promise.resolve({ loggedIn: false, remaining: 0, totalRuns: 0 }),
    $fetch<{ body: SchoolItem[] }>('/api/schoolList'),
  ]);
  if (statusResult.status === 'fulfilled' && authEnabled) authStatus.value = statusResult.value;
  if (schoolResult.status === 'fulfilled') {
    schoolList.value = schoolResult.value.body ?? [];
    if (schoolList.value.length === 1) selectedSchool.value = schoolList.value[0]!;
  } else {
    console.error(schoolResult.reason);
    message.value = '学校列表获取失败，请刷新页面重试';
  }
  schoolsLoading.value = false;
  const hashMatch = /[#&]token=([^&]+)/.exec(location.hash);
  if (hashMatch) {
    const hashToken = decodeURIComponent(hashMatch[1]!);
    history.replaceState(null, '', location.pathname);
    if (/^[A-Za-z0-9._+/=-]+$/.test(hashToken)) {
      token.value = hashToken;
      message.value = '已获取龙猫ID，正在自动登录…';
      await completeLogin(hashToken, 'https://wxxcx.xtotoro.com');
    }
  }
});

const handleLogin = async () => {
  if (!selectedSchool.value) { message.value = '请先选择学校'; return; }
  if (!token.value.trim()) { message.value = '请填写龙猫ID'; return; }
  message.value = '';
  await completeLogin(token.value.trim(), selectedSchool.value.domainUrl);
};
</script>

<template>
  <div class="tp-page">
    <header class="tp-nav">
      <NuxtLink to="/" class="tp-back">‹ 返回首页</NuxtLink>
      <div class="tp-nav-side">
        <button type="button" class="tp-quiet" @click="showIdHelp = true">龙猫ID获取</button>
        <NuxtLink v-if="authEnabled" to="/account" class="tp-badge balance">剩余 {{ authStatus?.remaining ?? '—' }} 次</NuxtLink>
      </div>
    </header>

    <main class="page-main">
      <div class="heading tp-rise">
          <h1 class="tp-title">绑定龙猫ID</h1>
          <p class="tp-subtitle">选择学校，填写龙猫ID后即可进入任务页。</p>
        </div>

        <section class="tp-card tp-card--pad form-card tp-rise-2">
          <div class="field-group">
            <label class="field-label">学校</label>
            <VSelect
              v-model="selectedSchool"
              :items="schoolList"
              item-title="schoolName"
              item-value="schoolCode"
              return-object
              variant="solo-filled"
              flat
              hide-details="auto"
              placeholder="请选择学校"
              aria-label="学校"
              :loading="schoolsLoading"
              :disabled="loading"
              class="tp-vselect"
            />
          </div>

          <div class="field-group">
            <div class="label-row">
              <label class="field-label" for="token-input">龙猫ID</label>
              <button type="button" class="how-link" @click="showIdHelp = true">如何获取？</button>
            </div>
            <textarea
              id="token-input"
              v-model="token"
              class="tp-textarea"
              rows="4"
              placeholder="请粘贴龙猫ID"
              :disabled="loading"
            />
          </div>

          <div v-if="message" class="tp-msg tp-msg--err form-msg" role="alert">
            <VIcon icon="mdi-alert-circle-outline" size="18" />
            <span>{{ message }}</span>
          </div>

          <button
            type="button"
            class="tp-cta tp-cta--block submit-btn"
            :disabled="loading || schoolsLoading || !selectedSchool || !token.trim()"
            @click="handleLogin"
          >
            <span v-if="loading" class="btn-spinner" />
            {{ loading ? '正在验证…' : '确认绑定' }}
          </button>

          <p class="tp-note form-note"><VIcon icon="mdi-lock-outline" size="14" />龙猫ID仅保存在当前浏览器</p>
        </section>
    </main>

    <Transition name="pop">
      <div v-if="showIdHelp" class="tp-mask" @click.self="showIdHelp = false">
        <section class="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-dialog-title">
          <button type="button" class="close-btn" aria-label="关闭" @click="showIdHelp = false">
            <VIcon icon="mdi-close" size="20" />
          </button>
          <h2 id="help-dialog-title" class="help-title">龙猫ID获取</h2>
          <p class="help-intro">选择电脑系统，按步骤获取并填写龙猫ID。</p>
          <div class="platform-tabs">
            <button type="button" :class="{ active: helpPlatform === 'windows' }" @click="helpPlatform = 'windows'">Windows</button>
            <button type="button" :class="{ active: helpPlatform === 'mac' }" @click="helpPlatform = 'mac'">macOS</button>
          </div>
          <a
            v-if="helpPlatform === 'windows'"
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
          <ol class="steps">
            <li>
              <span>1</span>
              <p v-if="helpPlatform === 'windows'">点击上方按钮下载工具，然后双击 <code>龙猫ID工具-便携版.exe</code> 运行。</p>
              <p v-else>将收到的工具压缩包解压，然后双击 <code>启动.command</code>。</p>
            </li>
            <li>
              <span>2</span>
              <p>在电脑微信中打开“龙猫体育锻炼”小程序，等待工具提示获取成功。</p>
            </li>
            <li>
              <span>3</span>
              <p>复制窗口中显示的龙猫ID，粘贴到当前页面；也可以从 <code>龙猫ID.txt</code> 中复制。</p>
            </li>
          </ol>
          <div class="tool-note">
            <b>工具说明</b>
            <p>运行期间会临时使用本机代理，仅读取龙猫相关域名。完成后会恢复网络设置，在窗口中显示龙猫ID，并保存到工具目录下的 <code>龙猫ID.txt</code>。工具不会自动打开网页。</p>
          </div>
          <div class="help-fallback">
            <b>遇到问题？</b>
            <p>如果一直没有获取成功，请确认小程序是在电脑微信中打开，并关闭后重试。如果网络异常，{{ helpPlatform === 'windows' ? '前往 Windows 设置 → 网络和 Internet → 代理，关闭“使用代理服务器”' : '前往系统设置 → 网络 → 详细信息 → 代理，关闭“网页代理”和“安全网页代理”' }}。</p>
          </div>
          <button type="button" class="tp-cta tp-cta--block done-btn" @click="showIdHelp = false">我知道了</button>
        </section>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ---------- 导航 ---------- */

.tp-nav .balance {
  text-decoration: none;
}

/* ---------- 主体布局（iPhone 风：居中排版 + 点击火花） ---------- */

.page-main {
  padding: 46px 0 72px;
}

.heading {
  margin-bottom: 30px;
  text-align: center;
}

/* iOS 大标题：更大、负字距、副标题居中 */
.heading .tp-title {
  font-size: clamp(30px, 6vw, 36px);
  letter-spacing: -0.025em;
}

.heading .tp-subtitle {
  margin-top: 8px;
}

/* ---------- 表单（iOS 分组列表质感：居中 + 发丝分隔线） ---------- */

.field-group + .field-group {
  border-top: 1px solid var(--tp-separator);
  margin-top: 22px;
  padding-top: 22px;
}

.field-label {
  color: var(--tp-text);
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px;
  text-align: center;
}

.label-row {
  align-items: baseline;
  display: flex;
  gap: 10px;
  justify-content: center;
}

.how-link {
  background: transparent;
  border: 0;
  color: var(--tp-blue);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  /* 负边距抵消 padding，视觉位置不变、触控区扩大 */
  margin: -8px -4px;
  padding: 8px 4px;
}
.how-link:hover { text-decoration: underline; }

/* Vuetify VSelect 与 kit 输入控件对齐（底色/圆角由全局 .tp-vselect 提供）；
   选择文本居中，右端箭头保留（iOS 选择器形态） */
.tp-vselect :deep(.v-field) { cursor: pointer; }
.tp-vselect :deep(.v-field__input) { font-size: 15px; justify-content: center; text-align: center; }
.tp-vselect :deep(.v-field__append-inner) { color: var(--tp-text-3); }
.tp-vselect :deep(.v-field):focus-within {
  box-shadow: 0 0 0 2px var(--tp-blue) !important;
}

/* 龙猫ID 多行输入：内容与占位符居中 */
.form-card .tp-textarea {
  text-align: center;
}

.form-msg {
  align-items: center;
  justify-content: center;
  margin-top: 18px;
  text-align: center;
}

.submit-btn {
  gap: 8px;
  margin-top: 22px;
}

.form-note {
  justify-content: center;
  margin-top: 16px;
  text-align: center;
}

.btn-spinner {
  animation: token-spin 0.9s linear infinite;
  border: 2px solid var(--tp-separator);
  border-radius: 50%;
  border-top-color: currentColor;
  box-sizing: content-box;
  height: 14px;
  width: 14px;
}
@keyframes token-spin { to { transform: rotate(360deg); } }

/* ---------- 帮助弹窗 ---------- */

.help-modal {
  background: var(--tp-surface);
  border-radius: var(--tp-radius-card);
  box-shadow: var(--tp-shadow-float);
  max-height: calc(100vh - 48px);
  max-height: calc(100dvh - 48px);
  max-width: 520px;
  overflow-y: auto;
  padding: 30px 30px 26px;
  position: relative;
  width: 100%;
}

.close-btn {
  align-items: center;
  background: var(--tp-fill);
  border: 0;
  border-radius: 50%;
  color: var(--tp-text-2);
  cursor: pointer;
  display: flex;
  height: 44px;
  justify-content: center;
  position: absolute;
  right: 14px;
  top: 14px;
  transition: background var(--tp-dur) ease, color var(--tp-dur) ease;
  width: 44px;
}
.close-btn:hover {
  background: var(--tp-fill-hover);
  color: var(--tp-text);
}

.help-title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
  padding-right: 52px;
}

.help-intro {
  color: var(--tp-text-2);
  font-size: 13px;
  margin: 6px 0 20px;
}

/* iOS 分段控件 */
.platform-tabs {
  background: var(--tp-fill);
  border-radius: 10px;
  display: grid;
  gap: 4px;
  grid-template-columns: 1fr 1fr;
  margin-bottom: 18px;
  padding: 4px;
}

.platform-tabs button {
  background: transparent;
  border: 0;
  border-radius: 7px;
  color: var(--tp-text-2);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  min-height: 36px;
  transition:
    background var(--tp-dur) var(--tp-ease),
    color var(--tp-dur) var(--tp-ease),
    box-shadow var(--tp-dur) var(--tp-ease);
}

.platform-tabs button.active {
  background: var(--tp-surface);
  box-shadow: var(--tp-shadow-card);
  color: var(--tp-text);
  font-weight: 700;
}

.tool-download {
  align-items: center;
  background: rgba(0, 113, 227, 0.08);
  border: 1px solid rgba(0, 113, 227, 0.16);
  border-radius: 12px;
  color: var(--tp-blue);
  display: flex;
  gap: 12px;
  margin: 0 0 12px;
  padding: 12px 14px;
  text-decoration: none;
  transition: background var(--tp-dur) var(--tp-ease), transform var(--tp-dur) var(--tp-ease);
}

.tool-download:hover {
  background: rgba(0, 113, 227, 0.13);
  transform: translateY(-1px);
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

/* 有序步骤 */
.steps {
  list-style: none;
  margin: 0;
  padding: 0;
}

.steps li {
  align-items: flex-start;
  display: grid;
  gap: 12px;
  grid-template-columns: 26px 1fr;
  padding: 9px 0;
}

.steps li > span {
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

.steps li > p {
  color: var(--tp-text-2);
  font-size: 13px;
  line-height: 1.65;
  margin: 3px 0 0;
}

.steps code,
.tool-note code,
.help-fallback code {
  background: var(--tp-fill);
  border-radius: 5px;
  color: var(--tp-blue);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  padding: 2px 5px;
}

/* 工具说明 / 故障排查 */
.tool-note,
.help-fallback {
  border-top: 1px solid var(--tp-separator);
  margin-top: 16px;
  padding-top: 15px;
}

.tool-note b,
.help-fallback b {
  color: var(--tp-text);
  display: block;
  font-size: 13px;
  margin-bottom: 5px;
}

.tool-note p,
.help-fallback p {
  color: var(--tp-text-2);
  font-size: 12px;
  line-height: 1.65;
  margin: 0;
}

.done-btn { margin-top: 18px; }

/* 弹窗过渡：scale + fade (260ms) */
.pop-enter-active,
.pop-leave-active {
  transition: opacity 260ms var(--tp-ease);
}

.pop-enter-active .help-modal,
.pop-leave-active .help-modal {
  transition: transform 260ms var(--tp-ease);
}

.pop-enter-from,
.pop-leave-to { opacity: 0; }

.pop-enter-from .help-modal,
.pop-leave-to .help-modal { transform: scale(0.94) translateY(12px); }

/* ---------- 移动端 ---------- */

@media (max-width: 560px) {
  .tp-nav { padding: 8px 14px; }
  .brand { font-size: 16px; }
  .page-main { padding: 32px 0 56px; }
  .heading { margin-bottom: 22px; }
  .heading-icon {
    height: 46px;
    margin-bottom: 14px;
    width: 46px;
  }
  .form-card { padding: 20px 16px; }
  .field-group + .field-group { margin-top: 18px; }
  .help-modal { padding: 24px 20px 20px; }
}
</style>
