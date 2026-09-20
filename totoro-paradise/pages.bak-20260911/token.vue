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
  const [statusResult, schoolResult] = await Promise.allSettled([
    $fetch<{ loggedIn: boolean; remaining: number; totalRuns: number }>('/api/auth/status'),
    $fetch<{ body: SchoolItem[] }>('/api/schoolList'),
  ]);
  if (statusResult.status === 'fulfilled') authStatus.value = statusResult.value;
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
  <div class="id-page">
    <header class="topbar">
      <NuxtLink to="/" class="brand">龙猫跑轮</NuxtLink>
      <div class="top-actions">
        <button class="help-link" @click="showIdHelp = true">龙猫ID获取</button>
        <NuxtLink to="/account" class="balance">剩余 {{ authStatus?.remaining ?? '—' }} 次</NuxtLink>
      </div>
    </header>

    <main class="page-main">
      <div class="heading">
        <span class="icon"><VIcon icon="mdi-link-variant" size="24" /></span>
        <h1>绑定龙猫ID</h1>
        <p>选择学校，填写龙猫ID后即可进入任务页。</p>
      </div>

      <section class="form-card">
        <div class="field-group">
          <label>学校</label>
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
            :loading="schoolsLoading"
            :disabled="loading"
            class="simple-select"
          />
        </div>

        <div class="field-group">
          <div class="label-row">
            <label>龙猫ID</label>
            <button @click="showIdHelp = true">如何获取？</button>
          </div>
          <textarea
            v-model="token"
            rows="4"
            placeholder="请粘贴龙猫ID"
            :disabled="loading"
          />
        </div>

        <div v-if="message" class="message">
          <VIcon icon="mdi-alert-circle-outline" size="18" />
          {{ message }}
        </div>

        <button
          class="submit"
          :disabled="loading || schoolsLoading || !selectedSchool || !token.trim()"
          @click="handleLogin"
        >
          <span v-if="loading" class="spinner" />
          {{ loading ? '正在验证…' : '确认绑定' }}
        </button>
        <p class="privacy"><VIcon icon="mdi-lock-outline" size="14" />龙猫ID仅保存在当前浏览器</p>
      </section>
    </main>

    <Transition name="fade">
      <div v-if="showIdHelp" class="modal-mask" @click.self="showIdHelp = false">
        <section class="help-modal" role="dialog" aria-modal="true">
          <button class="close" aria-label="关闭" @click="showIdHelp = false"><VIcon icon="mdi-close" size="18" /></button>
          <h2>龙猫ID获取</h2>
          <p class="help-intro">选择电脑系统，按步骤获取并填写龙猫ID。</p>
          <div class="platform-tabs">
            <button :class="{ active: helpPlatform === 'windows' }" @click="helpPlatform = 'windows'">Windows</button>
            <button :class="{ active: helpPlatform === 'mac' }" @click="helpPlatform = 'mac'">macOS</button>
          </div>
          <ol>
            <li>
              <span>1</span>
              <p>将收到的工具压缩包解压，然后双击 <code>{{ helpPlatform === 'windows' ? '启动.bat' : '启动.command' }}</code>。</p>
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
          <button class="done" @click="showIdHelp = false">我知道了</button>
        </section>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.id-page { background: #f5f5f7; color: #1d1d1f; min-height: 100vh; }
.topbar { align-items: center; display: flex; height: 68px; justify-content: space-between; margin: auto; max-width: 1040px; padding: 0 24px; }
.brand { color: #1d1d1f; font-size: 16px; font-weight: 700; text-decoration: none; }
.top-actions { align-items: center; display: flex; gap: 10px; }
.help-link { background: transparent; border: 0; color: #007aff; cursor: pointer; font-size: 13px; }
.balance { background: #fff; border: 1px solid #e5e5ea; border-radius: 999px; color: #555; font-size: 12px; padding: 8px 13px; text-decoration: none; }
.page-main { margin: 0 auto; max-width: 560px; padding: 72px 24px 100px; }
.heading { margin-bottom: 26px; text-align: center; }
.icon { align-items: center; background: #007aff; border-radius: 14px; color: #fff; display: inline-flex; height: 50px; justify-content: center; margin-bottom: 17px; width: 50px; }
.heading h1 { font-size: 32px; letter-spacing: -.04em; margin: 0; }
.heading p { color: #86868b; font-size: 14px; margin: 9px 0 0; }
.form-card { background: #fff; border: 1px solid #e8e8ed; border-radius: 22px; box-shadow: 0 12px 40px rgb(0 0 0 / 7%); padding: 28px; }
.field-group + .field-group { margin-top: 22px; }
.field-group > label,.label-row label { display: block; font-size: 13px; font-weight: 650; margin: 0 0 8px 2px; }
.label-row { align-items: center; display: flex; justify-content: space-between; }
.label-row button { background: transparent; border: 0; color: #007aff; cursor: pointer; font-size: 11px; margin-bottom: 8px; }
.simple-select :deep(.v-field) { background: #f2f2f7 !important; border-radius: 12px !important; box-shadow: none !important; }
textarea { background: #f2f2f7; border: 1px solid transparent; border-radius: 12px; color: #1d1d1f; font-family: ui-monospace,SFMono-Regular,Menlo,monospace; font-size: 12px; line-height: 1.6; outline: none; padding: 13px 14px; resize: none; transition: .16s ease; width: 100%; }
textarea:focus { background: #fff; border-color: #007aff; box-shadow: 0 0 0 3px rgb(0 122 255 / 10%); }
textarea::placeholder { color: #a1a1a6; }
.message { align-items: center; background: #fff1f0; border-radius: 10px; color: #d70015; display: flex; font-size: 12px; gap: 7px; margin-top: 18px; padding: 10px 12px; }
.submit,.done { background: #007aff; border: 0; border-radius: 12px; color: #fff; cursor: pointer; font-size: 14px; font-weight: 650; min-height: 48px; }
.submit { align-items: center; display: flex; gap: 8px; justify-content: center; margin-top: 22px; width: 100%; }
.submit:disabled { cursor: not-allowed; opacity: .45; }
.privacy { align-items: center; color: #a1a1a6; display: flex; font-size: 10px; gap: 4px; justify-content: center; margin: 11px 0 0; }
.spinner { animation: spin .8s linear infinite; border: 2px solid rgb(255 255 255 / 40%); border-radius: 50%; border-top-color: #fff; height: 16px; width: 16px; }
@keyframes spin { to { transform: rotate(360deg); } }
.modal-mask { align-items: center; backdrop-filter: blur(8px); background: rgb(0 0 0 / 28%); display: flex; inset: 0; justify-content: center; padding: 24px; position: fixed; z-index: 30; }
.help-modal { background: #fff; border-radius: 22px; box-shadow: 0 24px 80px rgb(0 0 0 / 22%); max-width: 520px; padding: 28px; position: relative; width: 100%; }
.close { align-items: center; background: #f2f2f7; border: 0; border-radius: 50%; color: #6e6e73; cursor: pointer; display: flex; height: 30px; justify-content: center; position: absolute; right: 18px; top: 18px; width: 30px; }
.help-modal h2 { font-size: 23px; margin: 0; }
.help-intro { color: #86868b; font-size: 12px; margin: 6px 0 21px; }
.platform-tabs { background: #f2f2f7; border-radius: 10px; display: grid; gap: 4px; grid-template-columns: 1fr 1fr; margin-bottom: 17px; padding: 4px; }
.platform-tabs button { background: transparent; border: 0; border-radius: 8px; color: #6e6e73; cursor: pointer; font-size: 12px; font-weight: 600; padding: 8px; }
.platform-tabs button.active { background: #fff; box-shadow: 0 1px 4px rgb(0 0 0 / 10%); color: #1d1d1f; }
.help-modal ol { list-style: none; margin: 0; padding: 0; }
.help-modal li { align-items: flex-start; display: grid; gap: 11px; grid-template-columns: 25px 1fr; padding: 8px 0; }
.help-modal li > span { align-items: center; background: #1d1d1f; border-radius: 50%; color: #fff; display: flex; font-size: 10px; height: 25px; justify-content: center; width: 25px; }
.help-modal li p { color: #555; font-size: 12px; line-height: 1.6; margin: 2px 0 0; }
.help-modal code { background: #f2f2f7; border-radius: 4px; color: #5856d6; font-size: 11px; padding: 2px 4px; }
.tool-note,.help-fallback { border-top: 1px solid #ededf0; margin-top: 17px; padding-top: 15px; }
.tool-note b,.help-fallback b { color: #1d1d1f; display: block; font-size: 12px; margin-bottom: 5px; }
.tool-note p,.help-fallback p { color: #6e6e73; font-size: 11px; line-height: 1.65; margin: 0; }
.done { margin-top: 16px; width: 100%; }
.fade-enter-active,.fade-leave-active { transition: opacity .18s; }
.fade-enter-from,.fade-leave-to { opacity: 0; }
</style>
