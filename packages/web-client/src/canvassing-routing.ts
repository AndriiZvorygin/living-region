export type Coordinate = [number, number];
type RoadCollection = {
  features: Array<{ geometry: { type: string; coordinates: any } }>;
};
type Edge = { to: string; metres: number };

export const metresBetween = (a: Coordinate, b: Coordinate) => {
  const latitude = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  return Math.hypot(
    (a[0] - b[0]) * 111320 * Math.cos(latitude),
    (a[1] - b[1]) * 111320,
  );
};

const nodeKey = ([longitude, latitude]: Coordinate) =>
  `${longitude.toFixed(6)},${latitude.toFixed(6)}`;

export class WalkingRoadGraph {
  private readonly nodes = new Map<string, Coordinate>();
  private readonly edges = new Map<string, Edge[]>();

  constructor(roads: RoadCollection) {
    for (const feature of roads.features) {
      const lines: Coordinate[][] =
        feature.geometry.type === "MultiLineString"
          ? feature.geometry.coordinates
          : feature.geometry.type === "LineString"
            ? [feature.geometry.coordinates]
            : [];
      for (const line of lines) {
        for (let index = 1; index < line.length; index++)
          this.addEdge(line[index - 1], line[index]);
      }
    }
  }

  private addEdge(from: Coordinate, to: Coordinate) {
    const fromKey = nodeKey(from),
      toKey = nodeKey(to),
      metres = metresBetween(from, to);
    this.nodes.set(fromKey, from);
    this.nodes.set(toKey, to);
    this.edges.set(fromKey, [
      ...(this.edges.get(fromKey) ?? []),
      { to: toKey, metres },
    ]);
    this.edges.set(toKey, [
      ...(this.edges.get(toKey) ?? []),
      { to: fromKey, metres },
    ]);
  }

  private nearest(point: Coordinate) {
    let key: string | undefined,
      distance = Infinity;
    for (const [candidateKey, candidate] of this.nodes) {
      const candidateDistance = metresBetween(point, candidate);
      if (candidateDistance < distance) {
        key = candidateKey;
        distance = candidateDistance;
      }
    }
    return { key, distance };
  }

  distance(
    from: Coordinate,
    to: Coordinate,
    maxSnapMetres = 100,
  ): number | null {
    const start = this.nearest(from),
      destination = this.nearest(to);
    if (
      !start.key ||
      !destination.key ||
      start.distance > maxSnapMetres ||
      destination.distance > maxSnapMetres
    )
      return null;
    const distances = new Map<string, number>([[start.key, 0]]),
      pending = new Set<string>([start.key]);
    while (pending.size) {
      let current = "",
        currentDistance = Infinity;
      for (const candidate of pending) {
        const value = distances.get(candidate) ?? Infinity;
        if (value < currentDistance) {
          current = candidate;
          currentDistance = value;
        }
      }
      pending.delete(current);
      if (current === destination.key)
        return currentDistance + start.distance + destination.distance;
      for (const edge of this.edges.get(current) ?? []) {
        const proposed = currentDistance + edge.metres;
        if (proposed < (distances.get(edge.to) ?? Infinity)) {
          distances.set(edge.to, proposed);
          pending.add(edge.to);
        }
      }
    }
    return null;
  }

  routeDistance(points: Coordinate[]) {
    let metres = 0;
    for (let index = 1; index < points.length; index++) {
      const leg = this.distance(points[index - 1], points[index]);
      if (leg == null) return null;
      metres += leg;
    }
    return metres;
  }
}
