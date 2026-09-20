/**
 * 设备指纹池 —— 请求头 UA、getRunBegin/sunRunExercises 的 phoneInfo 与 version 字段共同来源。
 * 小程序取 wx.getSystemInfo() 的 brand/model/system 与微信版本；
 * 此前硬编码单型号（Xiaomi&23116PN0BC）在多用户场景下会成为服务端聚合可见的
 * "全量同型号"特征，改为每会话从池中随机固定一台（同一用户会话内保持一致）。
 *
 * 🔬 UA 与 phoneInfo 必须同源（capture.log 审计结论）：真机请求头 UA 中的
 * 机型（Build/ 之前）与请求体 phoneInfo 的 brand&model&system 由同一台物理设备
 * 产生，不可能出现"UA=PLY110 而 phoneInfo=Xiaomi"的交叉矛盾——代理层 UA
 * 应从所选设备的 ua 字段派生，而非硬编码实抓那一台。
 */

interface Device {
  /** brand & model & system（请求体 phoneInfo / getRunBegin） */
  phoneInfo: string;
  /** 微信版本（wx.getSystemInfo().version，请求体 version） */
  version: string;
  /** 请求头 User-Agent（与 phoneInfo 同一设备；代理层 x-totoro-ua 头注入） */
  ua: string;
}

/** 真机微信 WebView UA 模板：{brand} {model} Build/{build} …… MicroMessenger/{version} ……
 *  其余字段（XWEB/MMWEBSDK/Chrome 等）为微信 WebView 固定格式，随微信版本走，此处按实抓样例 */
const uaOf = (brand: string, model: string, system: string, build: string, wxVersion: string) =>
  'Mozilla/5.0 (Linux; ' + system.replace(/^Android (\d+)/, 'Android $1') + '; ' + brand.replace(/OPPO|HONOR/i, (s) => s) + ' ' + model + ' Build/' + build + '; wv) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.189 Mobile Safari/537.36 ' +
  'XWEB/1500117 MMWEBSDK/20260502 MMWEBID/1435 MicroMessenger/' + wxVersion + '(0x28004C54) ' +
  'WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64 MiniProgramEnv/android';

const devices: Device[] = [
  // 🔬 首项来自 capture.log 实抓（PLY110 = OPPO Find X8 / Android 16 / 微信 8.0.76）
  {
    phoneInfo: 'OPPO&PLY110&Android 16',
    version: '8.0.76.3141',
    ua: 'Mozilla/5.0 (Linux; Android 16; PLY110 Build/BP2A.250605.015; wv) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.189 Mobile Safari/537.36 ' +
      'XWEB/1500117 MMWEBSDK/20260502 MMWEBID/1435 MicroMessenger/8.0.76.3141(0x28004C54) ' +
      'WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64 MiniProgramEnv/android',
  },
  {
    phoneInfo: 'Xiaomi&2210132C&Android 14',
    version: '8.0.49',
    ua: uaOf('Xiaomi', '2210132C', 'Android 14', 'UKQ1.230804.001', '8.0.49'),
  },
  {
    phoneInfo: 'HUAWEI&ALN-AL10&Android 12',
    version: '8.0.49',
    ua: uaOf('HUAWEI', 'ALN-AL10', 'Android 12', 'HuaweiALN-AL10', '8.0.49'),
  },
  {
    phoneInfo: 'vivo&V2312A&Android 14',
    version: '8.0.47',
    ua: uaOf('vivo', 'V2312A', 'Android 14', 'UP1A.231005.007', '8.0.47'),
  },
  {
    phoneInfo: 'HONOR&PGT-AN10&Android 12',
    version: '8.0.47',
    ua: uaOf('HONOR', 'PGT-AN10', 'Android 12', 'HONORPGT-AN10', '8.0.47'),
  },
  {
    phoneInfo: 'samsung&SM-S9180&Android 14',
    version: '8.0.49',
    ua: uaOf('samsung', 'SM-S9180', 'Android 14', 'UP1A.231005.001', '8.0.49'),
  },
  {
    phoneInfo: 'Xiaomi&23116PN0BC&Android 14',
    version: '8.0.49',
    ua: uaOf('Xiaomi', '23116PN0BC', 'Android 14', 'UKQ1.230917.001', '8.0.49'),
  },
  {
    phoneInfo: 'HUAWEI&CPU-AL10&Android 12',
    version: '8.0.47',
    ua: uaOf('HUAWEI', 'CPU-AL10', 'Android 12', 'HuaweiCPU-AL10', '8.0.47'),
  },
];

export const pickDevice = (): Device => devices[Math.floor(Math.random() * devices.length)]!;

export type { Device };
