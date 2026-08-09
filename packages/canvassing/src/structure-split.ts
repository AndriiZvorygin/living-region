import polygonClipping from "polygon-clipping";
import { createHash } from "node:crypto";

export type Position = [number, number];
export type Geometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};
export type SplitMethod = "cut_lines" | "frontage";
export type SplitCut = { start: Position; end: Position };
export type SplitResult = {
  children: Array<{ id: string; geometry: Geometry; area_m2: number }>;
  parent_area_m2: number;
  retained_area_ratio: number;
};

const polygons = (geometry: Geometry): number[][][][] =>
  geometry.type === "Polygon"
    ? [geometry.coordinates as number[][][]]
    : (geometry.coordinates as number[][][][]);

const geometryFrom = (coordinates: number[][][][]): Geometry =>
  coordinates.length === 1
    ? { type: "Polygon", coordinates: coordinates[0] }
    : { type: "MultiPolygon", coordinates };

const allPoints = (geometry: Geometry) =>
  polygons(geometry).flatMap((polygon) => polygon.flat()) as Position[];

const local = (point: Position, origin: Position) => {
  const latitude = (origin[1] * Math.PI) / 180;
  return [
    (point[0] - origin[0]) * 111320 * Math.cos(latitude),
    (point[1] - origin[1]) * 111320,
  ] as Position;
};

const geographic = (point: Position, origin: Position) => {
  const latitude = (origin[1] * Math.PI) / 180;
  return [
    origin[0] + point[0] / (111320 * Math.cos(latitude)),
    origin[1] + point[1] / 111320,
  ] as Position;
};

const ringArea = (ring: number[][]) => {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++)
    area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return area / 2;
};

const polygonArea = (polygon: number[][][]) =>
  Math.abs(ringArea(polygon[0])) -
  polygon.slice(1).reduce((sum, ring) => sum + Math.abs(ringArea(ring)), 0);

export function geometryAreaM2(geometry: Geometry) {
  const points = allPoints(geometry),
    origin: Position = [
      points.reduce((sum, point) => sum + point[0], 0) / points.length,
      points.reduce((sum, point) => sum + point[1], 0) / points.length,
    ];
  return polygons(geometry).reduce(
    (sum, polygon) =>
      sum +
      polygonArea(
        polygon.map((ring) =>
          ring.map((point) => local(point as Position, origin)),
        ),
      ),
    0,
  );
}

const halfPlane = (
  start: Position,
  end: Position,
  side: 1 | -1,
  extent: number,
) => {
  const dx = end[0] - start[0],
    dy = end[1] - start[1],
    length = Math.hypot(dx, dy);
  if (length < 0.01) throw new Error("Cut line is too short");
  const ux = dx / length,
    uy = dy / length,
    nx = -uy * side,
    ny = ux * side,
    a: Position = [start[0] - ux * extent, start[1] - uy * extent],
    b: Position = [end[0] + ux * extent, end[1] + uy * extent];
  return [
    [
      a,
      b,
      [b[0] + nx * extent * 2, b[1] + ny * extent * 2],
      [a[0] + nx * extent * 2, a[1] + ny * extent * 2],
      a,
    ],
  ];
};

const splitOnce = (geometry: Geometry, cut: SplitCut): Geometry[] => {
  const points = allPoints(geometry),
    origin: Position = [
      points.reduce((sum, point) => sum + point[0], 0) / points.length,
      points.reduce((sum, point) => sum + point[1], 0) / points.length,
    ],
    localGeometry = polygons(geometry).map((polygon) =>
      polygon.map((ring) =>
        ring.map((point) => local(point as Position, origin)),
      ),
    ),
    start = local(cut.start, origin),
    end = local(cut.end, origin),
    extent =
      Math.max(
        100,
        ...localGeometry.flat(2).map((point) => Math.hypot(point[0], point[1])),
      ) * 4,
    pieces: Geometry[] = [];
  for (const side of [-1, 1] as const) {
    const result = polygonClipping.intersection(
      localGeometry as any,
      halfPlane(start, end, side, extent) as any,
    ) as number[][][][];
    for (const polygon of result)
      pieces.push(
        geometryFrom([
          polygon.map((ring) =>
            ring.map((point) => geographic(point as Position, origin)),
          ),
        ]),
      );
  }
  return pieces.filter((piece) => geometryAreaM2(piece) >= 0.5);
};

const principalAxis = (geometry: Geometry) => {
  const points = allPoints(geometry),
    origin: Position = [
      points.reduce((sum, point) => sum + point[0], 0) / points.length,
      points.reduce((sum, point) => sum + point[1], 0) / points.length,
    ],
    values = points.map((point) => local(point, origin)),
    xx = values.reduce((sum, point) => sum + point[0] ** 2, 0),
    yy = values.reduce((sum, point) => sum + point[1] ** 2, 0),
    xy = values.reduce((sum, point) => sum + point[0] * point[1], 0),
    angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  return { origin, axis: [Math.cos(angle), Math.sin(angle)] as Position };
};

export function frontageCuts(
  geometry: Geometry,
  count: number,
  rotate = false,
): SplitCut[] {
  if (!Number.isInteger(count) || count < 2 || count > 20)
    throw new Error("Frontage unit count must be between 2 and 20");
  const { origin, axis: initial } = principalAxis(geometry),
    axis: Position = rotate ? [-initial[1], initial[0]] : initial,
    normal: Position = [-axis[1], axis[0]],
    values = allPoints(geometry).map((point) => local(point, origin)),
    along = values.map((point) => point[0] * axis[0] + point[1] * axis[1]),
    minimum = Math.min(...along),
    maximum = Math.max(...along),
    cuts: SplitCut[] = [];
  for (let index = 1; index < count; index++) {
    const offset = minimum + ((maximum - minimum) * index) / count,
      center: Position = [axis[0] * offset, axis[1] * offset],
      start = geographic(
        [center[0] - normal[0] * 500, center[1] - normal[1] * 500],
        origin,
      ),
      end = geographic(
        [center[0] + normal[0] * 500, center[1] + normal[1] * 500],
        origin,
      );
    cuts.push({ start, end });
  }
  return cuts;
}

export function splitStructure(
  parentId: string,
  eventId: string,
  geometry: Geometry,
  cuts: SplitCut[],
  minimumAreaM2 = 10,
): SplitResult {
  if (!cuts.length) throw new Error("At least one cut is required");
  let pieces = [geometry];
  for (const cut of cuts) {
    const next: Geometry[] = [];
    for (const piece of pieces) {
      const split = splitOnce(piece, cut);
      next.push(...(split.length > 1 ? split : [piece]));
    }
    pieces = next;
  }
  if (pieces.length < 2) throw new Error("Cuts do not divide this roof");
  const { origin, axis } = principalAxis(geometry);
  pieces.sort((left, right) => {
    const project = (piece: Geometry) => {
      const points = allPoints(piece),
        center: Position = [
          points.reduce((sum, point) => sum + point[0], 0) / points.length,
          points.reduce((sum, point) => sum + point[1], 0) / points.length,
        ],
        value = local(center, origin);
      return value[0] * axis[0] + value[1] * axis[1];
    };
    return project(left) - project(right);
  });
  const areas = pieces.map(geometryAreaM2);
  if (areas.some((area) => area < minimumAreaM2))
    throw new Error(`Every split roof must be at least ${minimumAreaM2} m2`);
  const parentArea = geometryAreaM2(geometry),
    retained = areas.reduce((sum, area) => sum + area, 0) / parentArea;
  if (retained < 0.99 || retained > 1.01)
    throw new Error("Split does not preserve the parent roof area");
  return {
    parent_area_m2: +parentArea.toFixed(1),
    retained_area_ratio: +retained.toFixed(5),
    children: pieces.map((piece, index) => ({
      id: `structure_${createHash("sha256")
        .update(`split:${parentId}:${eventId}:${index}`)
        .digest("hex")
        .slice(0, 20)}`,
      geometry: piece,
      area_m2: +areas[index].toFixed(1),
    })),
  };
}
