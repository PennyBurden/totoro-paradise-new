# Totoro-paradise-miniapp

totoro-paradise 的**校园阳光跑微信小程序协议适配版**。

原项目（[BeiyanYunyi/totoro-paradise](https://github.com/BeiyanYunyi/totoro-paradise)，AGPL-3.0）基于
APK 版（`app.xtotoro.com` + `/app/*` + RSA 加密请求体）实现。本副本根据对微信小程序
「校园阳光跑」（`__APP__.wxapkg` 反编译产物）的逆向分析，把全部请求层与数据逻辑
迁移到小程序协议。协议细节见同仓库《龙猫校园小程序协议说明.md》《龙猫校园小程序API接口文档.md》《龙猫校园小程序作弊判定分析.md》。

## 与原项目（APK 协议）的差异

| 维度 | 原项目（APK） | 本副本（小程序） |
|---|---|---|
| 主站/路径 | `app.xtotoro.com` + `/app/platform\|sunrun/*` | `{学校 domainUrl}`（默认 `wxxcx.xtotoro.com`）+ `/wxxcx/platform\|sunrun/*` |
| 鉴权 | token 放请求体最后字段 | `Authorization: Bearer {token}` 头（代理层注入；body 内冗余携带 token 与小程序行为一致） |
| 请求体 | RSA 1024 分块加密 → Base64 密文 | **明文 JSON**（小程序仅早操打卡用 RSA，本工具不涉及） |
| 登录 | 微信开放平台扫码 OAuth → getLesseeServer → login | **token 直填** + 学校列表（getSunRunSchoolList，主站无鉴权）→ GetStudentInfoByToken 拿 userInfo |
| 身份字段 | schoolId/campusId/stuNumber | schoolCode/snCode（campusId 取 userInfo.schoolCampusCode） |
| 任务获取 | getSunrunPaper 平铺 mileage/minSpeed/ifHasRun/faceFlag | getSunrunPaperResponseList[0]，无 ifHasRun/faceFlag/minSpeed |
| 成绩提交 | 27 字段（uuid/baseStation/mac/warnFlag…） | **17 字段**（scantronId/schoolCode/fitDegree/avgSpeed(M'SS")/steps 恒空/sunrunPathPointList/flag 恒'1'…） |
| 轨迹点 | `{longitude, latitude}` 字符串 | `{latitude:Number, longitude:Number, time, timestamp:服务端校准毫秒}` |
| 轨迹附加 | faceData（人脸 Base64） | cheatCode（motionAnalyzer 判定文案，此处恒"正常跑步"）+ gyroscope/accelerometer 空数组 |
| 响应判定 | 统一 `code=='0'` | 三轨：`code=='0'` / `status=='00'` / 平铺 |
| 反作弊环境 | 无 | 服务端时间校准（currentTimeMillis）、跑前/中途人脸抽查（**本工具无法完成**）、摄像头杆、跑点服务端判定 |

## 与小程序原版的已知差异（不可复现部分）

1. **登录**：小程序 token 由 `wx.login` code 换取，浏览器无法调用，故需人工提供 token
   （微信开发者工具 Storage 面板的 `token` 键，或抓包请求头 `Authorization` 去掉 `Bearer ` 前缀）。
2. **人脸（已跳过）**：按"无人脸核验模式"运行——getRunBegin 的 `faceBase64` 传空串，
   跑前人脸校验（`checkFaceStartSunRun`）与中途随机抽查（`sunrunFace/*` 四步流程）均不
   执行。若学校开启人脸开关（`sunrunStartFace/sunrunPointRandom`），服务端可能将成绩标记
   `warnType=2 人脸异常` 或判定无效——配置仅记录在控制台日志，不阻断流程。
3. **摄像头杆**：`getCameraPolling` 轮询未实现，若路线配置摄像头杆核验，无法通过。
4. **fitDegree**：本工具对生成轨迹按小程序同款算法（`calculateRouteSimilarity`，
   5m 采样/25m 容差）**诚实计算**，随机的渐变 GPS 漂移窗使其自然落在 0.9x-1.00，
   与服务端用 pointList 复算的结果一致。
5. **轨迹保真度**：点距 ~4m（匹配真机回调密度）、速度序列含 2-5 分钟周期起伏与
   逐点噪声、km 在要求里程基础上 +1%~5%、时间戳经 currentTimeMillis 校准且严格
   覆盖 [getRunBegin 时刻, 提交时刻]（与 startTime/endTime/usedTime/avgSpeed 同源，
   服务端交叉比对一致）；等待期间每 15s 轮询跑点进度。

## 文件对照

```
src/wrappers/TotoroApiWrapper.ts      全部端点重写：/wxxcx/* + Bearer + 明文 JSON
server/api/totoro/[...slug].ts        代理：{x-totoro-host}/wxxcx/* + Authorization 注入
server/api/schoolList.get.ts          学校列表（固定主站 /wxapi/，无鉴权，$fetch 服务端直连）
src/types/requestTypes/SunRunExercisesRequest.d.ts        17 字段注释版
src/types/TrackPoint.d.ts                                 小程序轨迹点结构
src/utils/serverTime.ts                                   currentTimeMillis 校准（g 偏移）
src/utils/fitDegree.ts                                    拟合度算法移植（对生成轨迹诚实计算）
src/utils/device.ts                                       设备指纹池（每会话随机固定）
src/utils/generateRoute.ts                                新轨迹点格式 + 米制点距 + 变速时间轴
src/controllers/generateSunRunExercisesReq.ts             小程序版成绩生成器（显式时间窗）
pages/index.vue                                           token 直填 + 学校选择
pages/scanned.vue                                         任务获取（新响应结构）
pages/run/[route].vue                                     起跑→等待→两阶段提交
```

已删除的 APK 协议遗留：RSA 加解密（`nodeRSA`/`rsaKeys`/`encrypt*`）、微信开放平台扫码
（`server/api/scanQr`）、`decode.vue`、APK 请求模型（login/getLesseeServer/getAppAd 等）、
CLI 时代死代码（middlewares/progressBar/argv/wait 等与无引用的 server/api/run/* 遗留端点——
原项目的这些端点在服务端调用 ky 相对 URL 实际不可用，页面本就直接经 wrapper 走浏览器端代理）。

架构与原项目一致：页面（浏览器）→ TotoroApiWrapper（明文 JSON + x-totoro-token/host 头）
→ /api/totoro 代理（Nitro $fetch 服务端直连学校服务器，注入 Authorization: Bearer）。

## 🏗️ How to build

```bash
pnpm i
pnpm build
```

## 🚀 How to run

```bash
pnpm start
```

## ⚛️ How to develop

```bash
pnpm dev
```

## 📝 License

[AGPL-3.0](LICENSE)（继承原项目）
