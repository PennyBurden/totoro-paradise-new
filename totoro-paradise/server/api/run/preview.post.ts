/**
 * POST /api/run/preview —— 生成路线预览折线（仅坐标对）。
 *
 * 地图预览原来在客户端调 generateRoute 画真实感轨迹,导致轨迹生成算法进前端包;
 * 改为服务端生成、只回传 [经度,纬度] 数组,算法不出服务器。
 */
import generateRoute from '../../../src/utils/generateRoute';

interface PreviewBody {
  distance?: string;
  pointList?: Array<{ longitude: string | number; latitude: string | number }>;
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<PreviewBody>(event)) ?? {};
  const distance = (body.distance ?? '').trim();
  const pointList = Array.isArray(body.pointList) ? body.pointList : [];
  if (!distance || pointList.length < 2) {
    setResponseStatus(event, 400);
    return { error: '缺少里程或路线点' };
  }

  const track = generateRoute({
    distance,
    route: {
      taskId: '',
      pointId: '',
      pointName: '',
      longitude: String(pointList[0]!.longitude),
      latitude: String(pointList[0]!.latitude),
      pointList: pointList.map((p) => ({
        longitude: String(p.longitude),
        latitude: String(p.latitude),
        time: null,
      })),
      signLongitude: null,
      signLatitude: null,
      signQrcode: '',
    },
    startAt: Date.now() - 60000,
    endAt: Date.now(),
  });

  return { path: track.mockRoute.map((p) => [Number(p.longitude), Number(p.latitude)]) };
});
