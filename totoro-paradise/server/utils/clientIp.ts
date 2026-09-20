/**
 * 客户端 IP 解析（经代理/隧道部署时取真实来源 IP）。
 *
 * 取值优先级：cf-connecting-ip（Cloudflare）→ x-real-ip（Nginx）→
 * x-forwarded-for（取第一段，跳过空串）→ getRequestIP 兜底 → 'unknown'。
 */
import type { H3Event } from 'h3';

export const getClientIp = (event: H3Event): string => {
  // h3 工具（getHeader/getRequestIP）由 Nitro 自动导入
  const forwarded = getHeader(event, 'x-forwarded-for');
  const first = forwarded?.split(',').map((s) => s.trim()).find((s) => s);
  return (
    getHeader(event, 'cf-connecting-ip')?.trim() ||
    getHeader(event, 'x-real-ip')?.trim() ||
    first ||
    getRequestIP(event) ||
    'unknown'
  );
};
