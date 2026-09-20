<script setup lang="ts">
import AMapLoader from '@amap/amap-jsapi-loader';

const props = defineProps<{ target: string }>();
const emit = defineEmits<{ (e: 'update:target', target: string): void }>();
const containerRef = ref<HTMLDivElement | null>(null);
const sunrunPaper = useSunRunPaper();
const AMap = shallowRef();
const map = shallowRef();
const routes = computed(() => sunrunPaper.value?.runPointList ?? []);
/** 预览折线改为服务端 /api/run/preview 生成(轨迹算法不进前端包),缓存避免重复请求 */
const previewCache = new Map<string, Array<[number, number]>>();

const fetchPreview = async (pointId: string): Promise<Array<[number, number]>> => {
  const cached = previewCache.get(pointId);
  if (cached) return cached;
  const target = routes.value.find((route) => route.pointId === pointId);
  if (!target || !sunrunPaper.value) return [];
  try {
    const res = await $fetch<{ path: Array<[number, number]> }>('/api/run/preview', {
      method: 'POST',
      body: { distance: sunrunPaper.value.mileage, pointList: target.pointList },
    });
    previewCache.set(pointId, res.path);
    return res.path;
  } catch {
    return [];
  }
};

const genPolylineAry = async () => {
  const target = routes.value.find((route) => route.pointId === props.target);
  if (!target || !sunrunPaper.value) return [];
  const previewPath = await fetchPreview(target.pointId);
  const polylines = previewPath.length
    ? [
        new AMap.value.Polyline({
          path: [previewPath.map(([lng, lat]) => new AMap.value.LngLat(lng, lat))],
          strokeColor: 'red',
          lineJoin: 'round',
          strokeWeight: 2,
          strokeOpacity: 0.5,
        }),
      ]
    : [];
  polylines.push(
    new AMap.value.Polyline({
      path: [
        target.pointList.map(
          ({ longitude, latitude }) => new AMap.value.LngLat(Number(longitude), Number(latitude)),
        ),
      ],
      strokeColor: 'green',
      lineJoin: 'round',
      strokeWeight: 4,
      strokeOpacity: 0.5,
    }),
  );
  return polylines;
};

const updateLine = async () => {
  if (!map.value && !routes.value) return;
  map.value.clearMap();
  map.value.add(await genPolylineAry());
  routes.value.forEach((route) => {
    const { pointName, pointId } = route;
    const marker = new AMap.value.Text({
      text: pointName,
      value: pointId,
      anchor: 'center', // 设置文本标记锚点
      cursor: 'pointer',
      angle: 0,
      position: [route.longitude, route.latitude],
      style: {
        'font-family': '"Roboto", "Helvetica", "Arial", "sans-serif"',
      },
    });
    marker.on('click', (event: { target: { _originOpts: { value: string } } }) => {
      emit('update:target', event.target._originOpts.value);
    });
    map.value.add(marker);
  });
};

watch(
  () => props.target,
  () => {
    if (!sunrunPaper.value) return;
    if (!map.value) return;
    updateLine();
  },
);

watch([sunrunPaper, map], () => {
  if (!sunrunPaper.value) return;
  const lonlat = getCenter(sunrunPaper.value?.runPointList ?? []);
  if (!map.value) return;
  map.value.setCenter([lonlat.lon, lonlat.lat]);
  map.value.setZoom(14);
  updateLine();
});

watch(
  () => containerRef.value,
  async () => {
    if (!containerRef.value) return;
    const AMapLoaded = await AMapLoader.load({
      key: 'af2315aca7fe4d6f21421402aa91a102', // 申请好的Web端开发者Key，首次调用 load 时必填
      version: '2.0', // 指定要加载的 JSAPI 的版本，缺省时默认为 1.4.15
    });
    AMap.value = AMapLoaded;
    map.value = new AMap.value.Map(containerRef.value);
  },
);
</script>
<template><div id="mapContainer" ref="containerRef" class="h-full w-full" /></template>
