/**
 * 邀请海报合成（纯前端，Canvas 2D）。
 * 输出 1500×2000 PNG（按 750×1000 设计坐标 ×2 绘制保证清晰度），
 * 只返回 dataUrl 供弹窗预览 / 保存；分享需 Blob 时由调用方从 dataUrl 现取。
 * 二维码内容为站点地址（无邀请码、无统计归因）。
 */

/** 与 kit.css 同款系统字体栈（canvas 读不到 CSS 变量；系统栈免加载，中文直落 PingFang / 雅黑） */
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

/* 色值对齐 kit.css 设计令牌（海报是导出位图，接收方无 CSS 变量，故用字面量） */
const TEXT = '#1d1d1f';   /* --tp-text */
const TEXT2 = '#6e6e73';  /* --tp-text-2 */
const TEXT3 = '#aeaeb2';  /* 弱化文字（对齐 --tp-text-3 与占位灰之间） */

/** 同源图片加载（public 资源 / dataURL，不污染 canvas） */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败: ${src}`));
    img.src = src;
  });
}

/** cover 语义绘制：等比放大填满目标区，居中裁剪（9 参 drawImage，无需 clip） */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

/** 圆角矩形路径（不填充不描边，由调用方 fill） */
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 生成二维码 dataURL（qrcode 包 browser 入口动态引入，不进首屏主包） */
async function renderQrDataUrl(text: string): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 420,
    color: { dark: TEXT, light: '#ffffff' },
  });
}

export interface InvitePoster {
  dataUrl: string;
}

/** 合成邀请海报；hero 图或字体异常时静默降级，二维码失败则抛错由调用方兜底 */
export async function buildInvitePoster(shareUrl: string): Promise<InvitePoster> {
  const canvas = document.createElement('canvas');
  canvas.width = 1500;
  canvas.height = 2000;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d 上下文不可用');

  /* 预载 hero 图（失败降级纯白底）并等系统字体就绪（防御性，异常不阻断） */
  const hero = await loadImage('/images/purple-track-hero.png').catch(() => null);
  try { await document.fonts.ready; } catch { /* 无 document.fonts 时跳过 */ }

  ctx.scale(2, 2); /* 此后全部按 750×1000 设计坐标绘制 */
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  /* 0) 白底 */
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 750, 1000);

  /* 1) 顶部 hero 图带（0–430）+ 底边渐变融入白底（310–430） */
  if (hero) {
    drawCover(ctx, hero, 0, 0, 750, 430);
    const fade = ctx.createLinearGradient(0, 310, 0, 430);
    fade.addColorStop(0, 'rgba(255, 255, 255, 0)');
    fade.addColorStop(1, 'rgba(255, 255, 255, 1)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 310, 750, 120);
  }

  /* 2) 品牌名（字间距拉开） */
  ctx.fillStyle = TEXT2;
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText('龙 猫 跑 轮', 375, 486);

  /* 3) 主口号 */
  ctx.fillStyle = TEXT;
  ctx.font = `bold 42px ${FONT}`;
  ctx.fillText('把每一次校园跑变简单。', 375, 548);

  /* 4) 邀请短句 */
  ctx.fillStyle = TEXT2;
  ctx.font = `500 19px ${FONT}`;
  ctx.fillText('邀请你和我一起跑', 375, 590);

  /* 5) 二维码卡片：居中 250×250 白卡（圆角 + 阴影），QR 210×210 居中留白。
     注意 shadowBlur/OffsetY 不随 ctx.scale 缩放，需 ×2 补偿才是设计坐标的视觉尺寸 */
  const qrImg = await loadImage(await renderQrDataUrl(shareUrl));
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, 250, 640, 250, 250, 20);
  ctx.fill();
  ctx.restore();
  ctx.drawImage(qrImg, 270, 660, 210, 210);

  /* 6) 扫码提示 + 底部地址（去协议头） */
  ctx.fillStyle = TEXT2;
  ctx.font = `500 16px ${FONT}`;
  ctx.fillText('微信扫一扫 · 和我一起跑', 375, 930);

  ctx.fillStyle = TEXT3;
  ctx.font = `13px ${FONT}`;
  ctx.fillText(shareUrl.replace(/^https?:\/\//, ''), 375, 966);

  /* 只返回 dataUrl：canvas 位图（1500×2000≈11.4MB）不随组件常驻，分享时从 dataUrl 现取 Blob */
  return { dataUrl: canvas.toDataURL('image/png') };
}
