export type SamplingStop = {
  household_id: string;
  street: string;
  civic_number: string;
  lon: number;
  lat: number;
};

export type SampleOverride =
  | { type: "include"; household_id: string; position?: number }
  | { type: "exclude"; household_id: string }
  | { type: "reorder"; household_ids: string[] };

const hash = (value: string) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

const normalizeStreet = (street: string) =>
  street.trim().toLowerCase().replace(/\s+/g, " ") || "unknown street";

export function samplingStratum(stop: SamplingStop) {
  const number = Number.parseInt(stop.civic_number, 10);
  const side = Number.isFinite(number)
    ? number % 2
      ? "odd"
      : "even"
    : "unknown";
  const block = Number.isFinite(number)
    ? String(Math.floor(number / 100) * 100)
    : `${stop.lon.toFixed(3)},${stop.lat.toFixed(3)}`;
  return `${normalizeStreet(stop.street)}|${block}|${side}`;
}

export function sampleTarget(
  total: number,
  percentage = 20,
  targetCount?: number,
) {
  const requested =
    targetCount == null
      ? Math.ceil((total * Math.max(0, percentage)) / 100)
      : Math.max(0, Math.floor(targetCount));
  return Math.min(total, requested);
}

export function distributedSample(
  stops: SamplingStop[],
  options: { seed: string; percentage?: number; targetCount?: number },
) {
  const unique = [
    ...new Map(stops.map((stop) => [stop.household_id, stop])).values(),
  ];
  const count = sampleTarget(
    unique.length,
    options.percentage ?? 20,
    options.targetCount,
  );
  const groups = new Map<string, SamplingStop[]>();
  for (const stop of unique) {
    const key = samplingStratum(stop);
    groups.set(key, [...(groups.get(key) ?? []), stop]);
  }
  const strataByStreet = new Map<string, Array<[string, SamplingStop[]]>>();
  for (const entry of groups.entries()) {
    const street = entry[0].split("|")[0];
    strataByStreet.set(street, [...(strataByStreet.get(street) ?? []), entry]);
  }
  const streets = [...strataByStreet.entries()]
    .sort(
      ([left], [right]) =>
        hash(`${options.seed}|street|${left}`) -
        hash(`${options.seed}|street|${right}`),
    )
    .map(([, entries]) =>
      entries.sort(
        ([left], [right]) =>
          hash(`${options.seed}|${left}`) - hash(`${options.seed}|${right}`),
      ),
    );
  const strata: Array<[string, SamplingStop[]]> = [];
  for (let index = 0; streets.some((street) => street[index]); index++)
    for (const street of streets) if (street[index]) strata.push(street[index]);
  const queues = strata.map(([key, members]) => {
    const ordered = [...members].sort((left, right) => {
      const leftNumber = Number.parseInt(left.civic_number, 10) || 0;
      const rightNumber = Number.parseInt(right.civic_number, 10) || 0;
      return (
        leftNumber - rightNumber || left.lon - right.lon || left.lat - right.lat
      );
    });
    const offset = ordered.length
      ? hash(`${options.seed}|${key}|offset`) % ordered.length
      : 0;
    return [...ordered.slice(offset), ...ordered.slice(0, offset)];
  });
  const selected: SamplingStop[] = [];
  for (let round = 0; selected.length < count; round++) {
    let added = false;
    for (const queue of queues) {
      if (queue[round] && selected.length < count) {
        selected.push(queue[round]);
        added = true;
      }
    }
    if (!added) break;
  }
  return selected;
}

export function applySampleOverrides(
  sampledHouseholdIds: string[],
  availableHouseholdIds: string[],
  overrides: SampleOverride[],
) {
  let result = [...new Set(sampledHouseholdIds)];
  const available = new Set(availableHouseholdIds);
  for (const override of overrides) {
    if (override.type === "exclude") {
      result = result.filter((id) => id !== override.household_id);
    } else if (
      override.type === "include" &&
      available.has(override.household_id)
    ) {
      result = result.filter((id) => id !== override.household_id);
      const position = Math.max(
        0,
        Math.min(result.length, override.position ?? result.length),
      );
      result.splice(position, 0, override.household_id);
    } else if (override.type === "reorder") {
      const requested = override.household_ids.filter((id) =>
        result.includes(id),
      );
      result = [
        ...new Set(requested),
        ...result.filter((id) => !requested.includes(id)),
      ];
    }
  }
  return result;
}

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

export function defaultFollowupDate(flyerDate: string) {
  const date = new Date(`${flyerDate}T12:00:00Z`);
  if (Number.isNaN(date.valueOf())) throw new Error("Invalid flyer date");
  const offsets: Record<number, number> = { 1: 2, 3: 5, 5: 4 };
  date.setUTCDate(date.getUTCDate() + (offsets[date.getUTCDay()] ?? 2));
  return dateOnly(date);
}

export function scheduleState(scheduledFor: string, today: string) {
  if (scheduledFor < today) return "overdue";
  if (scheduledFor === today) return "due";
  return "upcoming";
}
