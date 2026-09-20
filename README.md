# totoro-paradise-new

龙猫校园(阳光跑/研途健行)服务端代跑系统 —— 基于 [BeiyanYunyi/totoro-paradise](https://github.com/BeiyanYunyi/totoro-paradise)(AGPL-3.0)重构的私有部署版。

> 私有仓库,仅自用。续作 AGPL-3.0。

## 架构

```
totoro-paradise/   主站(Nuxt3,端口 3000):用户前端 + 跑步引擎 API
totoro-admin/      管理后台(Nuxt3,端口 3001):统计明细 / 额度兑换码管理
start/stop/restart-all.bat   一键启停(自动检测已占用端口,幂等)
```

### 与上游的核心差异

- **跑步协议全部服务端化**:`server/utils/runEngine.ts` 作业模型(后台执行 + 进度轮询),
  `server/utils/totoroClient.ts` 直连学校接口并复刻小程序请求头画像。
  轨迹生成(generateRoute)、成绩构造(generateSunRunExercisesReq)、拟合度
  (fitDegree)等核心算法不进前端包,前端只拿作业进度。
- **自由跑模式(2026-09)**:校园后台取消路线选择后任务 `runPointList` 为空,
  scanned 页免选路线直达 `/run/free`,`getRunBegin` 的 lineId 发空串;
  兜底路线为将军路校区西操场 400m 跑道实测椭圆(OSM way/1053867283,
  周长 398m ≈ 第一分道内沿),任务里程 2.40km ≈ 整 6 圈。
- **登录/额度门禁可开关**:`nuxt.config.ts` → `runtimeConfig.public.authEnabled`。
  `false` 时开放使用;`true` 时恢复登录 + 兑换码额度扣减。
- **前端统一苹果风设计系统**(kit.css)。

## 部署

```bash
# 主站
cd totoro-paradise && pnpm install && pnpm build
# 管理后台
cd totoro-admin   && pnpm install && pnpm build
# 启动(Windows)
start-all.bat        # 3000 主站 + 3001 后台,幂等
```

首次运行自动生成 `totoro-auth.json`(含 adminKey,看主站日志)。
统计数据落盘 `totoro-stats.json`(可用 `STATS_DATA_DIR`/`AUTH_DATA_DIR` 改路径)。

## 不包含的内容

- **获取龙猫ID 抓包工具**(含 MITM CA 私钥)与本仓库分离,不入库。
- 日志(`totoro-debug.log` 等)含真实 token/学号/抓包原文,已被 .gitignore 排除。

## 排障

- 上游接口行为变化:先看 `totoro-debug.log`(ISO 时间戳,记录全部上游请求/响应原文,2000 字符截断)。
- 隧道:NatTunnel(第三方)内网穿透,落点 `127.0.0.1:3000`;cloudflared 方案未启用。
