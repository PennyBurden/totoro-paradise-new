import type { SchoolItem } from '~~/src/types/responseTypes/GetSchoolListResponse';

/**
 * 学校列表端点：共享工具 fetchSchoolList（server/utils/schools.ts）的薄封装。
 */
export default defineEventHandler(async () => {
  const body = await fetchSchoolList();
  return { body } satisfies { body: SchoolItem[] };
});
