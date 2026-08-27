import type { DatabaseSync } from "node:sqlite";

export type StructureHistoryCrosswalkRow = {
  historical_structure_id: string;
  historical_household_id: string;
  historical_address_id: string;
  canonical_structure_id: string;
  match_method: string;
  confidence: "exact_structure_geometry" | "review";
  historical_label: string;
};

export type PhysicalRoofActivity = {
  structure_id: string;
  flyer_delivered: number;
  status: string;
  visit_count: number;
  last_updated_at: string | null;
  flyer_history: Array<{
    event_id: string;
    occurred_at: string;
    flyer_id: string | null;
    flyer_name: string;
    user_id: string;
    source: string;
  }>;
};

const statusRank: Record<string, number> = {
  untouched: 0,
  flyer_delivered: 1,
  knocked_no_answer: 2,
  conversation: 3,
  undecided: 4,
  supportive: 5,
  opposed: 5,
  revisit: 6,
  volunteer_interest: 7,
  lawn_sign_interest: 7,
  vacant: 8,
  inaccessible: 8,
  no_campaign_material_requested: 8,
};

export function selectPhysicalRoofStatus(current: string, candidate: string) {
  const currentRank = statusRank[current] ?? 0;
  const candidateRank = statusRank[candidate] ?? 0;
  return candidateRank >= currentRank ? candidate : current;
}

type ActivityEvent = {
  structure_id: string;
  event_id: string;
  occurred_at: string;
  flyer_id: string | null;
  flyer_name: string;
  user_id: string;
  source: string;
  flyer_delivered: number;
  status: string;
};

/**
 * Collapse historical event rows onto the physical roof that existed when
 * the field work was recorded. This intentionally does not copy or mutate
 * the source event rows. It is a read projection used to keep roof status
 * stable when address metadata is replaced.
 */
export function aggregatePhysicalRoofActivity(events: ActivityEvent[]) {
  const result = new Map<string, PhysicalRoofActivity>();
  for (const event of events) {
    const current = result.get(event.structure_id) ?? {
      structure_id: event.structure_id,
      flyer_delivered: 0,
      status: "untouched",
      visit_count: 0,
      last_updated_at: null,
      flyer_history: [],
    };
    current.visit_count += 1;
    current.flyer_delivered = Math.max(
      current.flyer_delivered,
      event.flyer_delivered ? 1 : 0,
    );
    current.status = selectPhysicalRoofStatus(current.status, event.status);
    if (
      !current.last_updated_at ||
      event.occurred_at > current.last_updated_at
    )
      current.last_updated_at = event.occurred_at;
    if (event.flyer_delivered)
      current.flyer_history.push({
        event_id: event.event_id,
        occurred_at: event.occurred_at,
        flyer_id: event.flyer_id,
        flyer_name: event.flyer_name,
        user_id: event.user_id,
        source: event.source,
      });
    result.set(event.structure_id, current);
  }
  for (const activity of result.values())
    activity.flyer_history.sort(
      (left, right) =>
        right.occurred_at.localeCompare(left.occurred_at) ||
        right.event_id.localeCompare(left.event_id),
    );
  return result;
}

export function physicalRoofActivityFromDatabase(
  db: DatabaseSync,
  flyerNames = new Map<string, string>(),
) {
  const events = db
    .prepare(
      `SELECT c.canonical_structure_id structure_id,
              v.id event_id,v.occurred_at,v.flyer_id,
              COALESCE(fc.short_name,'Unknown legacy flyer') flyer_name,
              v.user_id,v.source,
              v.flyer_delivered,
              CASE
                WHEN v.revisit_requested=1 THEN 'revisit'
                WHEN v.outcome='flyer_delivered' AND v.flyer_delivered=1 THEN 'flyer_delivered'
                WHEN v.conversation_occurred=1 THEN 'conversation'
                WHEN v.door_knocked=1 AND v.outcome='no_answer' THEN 'knocked_no_answer'
                ELSE v.outcome
              END status
         FROM structure_history_crosswalk c
         JOIN visits v ON v.household_id=c.historical_household_id
         LEFT JOIN flyer_catalogue fc ON fc.id=v.flyer_id
        WHERE COALESCE((SELECT correction_type FROM visit_corrections vc
                          WHERE vc.visit_id=v.id
                       ORDER BY vc.occurred_at DESC,vc.rowid DESC LIMIT 1),'restore')!='undo'
        UNION ALL
       SELECT c.canonical_structure_id structure_id,
              f.id event_id,f.occurred_at,f.flyer_id,
              COALESCE(fc.short_name,'Unknown legacy flyer') flyer_name,
              f.user_id,f.source,
              f.flyer_delivered,
              CASE WHEN f.flyer_delivered=1 THEN 'flyer_delivered' ELSE 'untouched' END status
         FROM structure_history_crosswalk c
         JOIN household_flyer_events f ON f.household_id=c.historical_household_id
         LEFT JOIN flyer_catalogue fc ON fc.id=f.flyer_id
        WHERE f.flyer_delivered=1
        ORDER BY occurred_at,event_id`,
    )
    .all() as ActivityEvent[];
  void flyerNames;
  return aggregatePhysicalRoofActivity(events);
}
