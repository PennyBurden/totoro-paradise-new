import type { RouteDefPoint } from './responseTypes/GetSunRunPaperResponse';

/**
 * 跑步路线（getSunrunPaper.runPointList[] 元素）
 * 🔬 实抓新增：signLongitude/signLatitude（签到点坐标，可为 null）、
 * signQrcode（签到二维码内容 = pointId 原样）
 */
export default interface RunPoint {
  taskId: string;
  pointId: string;
  pointName: string;
  longitude: string;
  latitude: string;
  pointList: RouteDefPoint[];
  signLongitude: string | null;
  signLatitude: string | null;
  signQrcode: string;
}
