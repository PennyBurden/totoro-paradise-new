import type { SunRunPaper } from '~~/src/types/responseTypes/GetSunRunPaperResponse';

/**
 * 小程序版任务上下文：存 getSunrunPaperResponseList[0]（任务级对象）。
 * 与 APK 版差异：响应顶层不再平铺 mileage/minTime 等字段，
 * 且无 ifHasRun（当日已跑）与 faceFlag（人脸开关）字段 ——
 * 人脸开关在 selectSunRunStartConfiguration，本工具不接入（无法完成人脸比对）。
 */
const useSunRunPaper = () => useState<SunRunPaper | null>('sunRunPaper');

export default useSunRunPaper;
