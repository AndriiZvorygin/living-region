import {calculateHealthCanadaEER} from './health-canada.mjs';

export const HOUSEHOLD_LAND_ADULT_AGE = 18;
export const HOUSEHOLD_TRANSITION_YEAR_CONVENTION = 'Year 1 is the starting establishment season; a member ages by year - 1 at later numeric checkpoints. Height and weight are held at the supplied profile values because the current contract has no growth model.';

function round(value, digits = 6) { return Math.round(Number(value) * 10 ** digits) / 10 ** digits; }

function memberEnergy(member, age = Number(member.age_y)) {
  if (age === Number(member.age_y) && Number.isFinite(Number(member.gj_year))) return Number(member.gj_year);
  return calculateHealthCanadaEER({...member, age_y: age}).gj_year;
}

export function householdLandRole(member = {}) {
  if (member.land_role === 'permanent_adult') return 'permanent_adult';
  if (member.land_role === 'dependent_child') return Number(member.age_y) < HOUSEHOLD_LAND_ADULT_AGE ? 'dependent_child' : 'permanent_adult';
  return Number(member.age_y) >= HOUSEHOLD_LAND_ADULT_AGE ? 'permanent_adult' : 'dependent_child';
}

function elapsedYears(year) {
  if (year === 'mature') return null;
  return Math.max(0, Number(year) - 1);
}

/**
 * Separate current adult land demand from dependent demand without assigning
 * particular crops to either group. Food remains a pooled household output.
 */
export function calculateHouseholdFoodDemandProfile(members = [], years = [1, 2, 3, 5, 8, 10, 15, 'mature']) {
  const rows = Array.isArray(members) ? members.map((member, index) => {
    const role = householdLandRole(member);
    return {
      ...member,
      id: member.id ?? `member-${index + 1}`,
      land_role: role,
      current_age_y: Number(member.age_y),
      current_food_demand_gj_year: round(memberEnergy(member))
    };
  }) : [];
  const permanentAdults = rows.filter((member) => member.land_role === 'permanent_adult');
  const dependentChildren = rows.filter((member) => member.land_role === 'dependent_child');
  const permanentAdultDemand = permanentAdults.reduce((sum, member) => sum + member.current_food_demand_gj_year, 0);
  const currentDependentDemand = dependentChildren.reduce((sum, member) => sum + member.current_food_demand_gj_year, 0);
  const currentHouseholdDemand = permanentAdultDemand + currentDependentDemand;

  function demandAt(year) {
    const elapsed = elapsedYears(year);
    const activeChildren = elapsed == null
      ? []
      : dependentChildren.filter((member) => member.current_age_y + elapsed < HOUSEHOLD_LAND_ADULT_AGE);
    const dependentDemand = activeChildren.reduce((sum, member) => sum + memberEnergy(member, member.current_age_y + elapsed), 0);
    return {
      year,
      elapsed_years: elapsed,
      permanent_adult_food_demand_gj_year: round(permanentAdultDemand),
      dependent_child_food_demand_gj_year: round(dependentDemand),
      household_food_demand_gj_year: round(permanentAdultDemand + dependentDemand),
      active_dependent_member_ids: activeChildren.map((member) => member.id),
      active_dependent_child_count: activeChildren.length
    };
  }

  const scopeRows = years.map(demandAt);
  const demandByYear = Object.fromEntries(scopeRows.map((row) => [String(row.year), row.household_food_demand_gj_year]));
  const scopeByYear = Object.fromEntries(scopeRows.map((row) => [String(row.year), row]));
  return {
    members: rows.map((member) => ({id: member.id, label: member.label, age_y: member.current_age_y, land_role: member.land_role, food_demand_gj_year: member.current_food_demand_gj_year})),
    permanent_adult_member_ids: permanentAdults.map((member) => member.id),
    dependent_child_member_ids: dependentChildren.map((member) => member.id),
    permanent_adult_count: permanentAdults.length,
    dependent_child_count: dependentChildren.length,
    permanent_adult_food_demand_gj_year: round(permanentAdultDemand),
    dependent_child_food_demand_gj_year: round(currentDependentDemand),
    current_household_food_demand_gj_year: round(currentHouseholdDemand),
    demand_by_year: demandByYear,
    scope_by_year: scopeByYear,
    years,
    adult_transition_age: HOUSEHOLD_LAND_ADULT_AGE,
    year_convention: HOUSEHOLD_TRANSITION_YEAR_CONVENTION,
    pooled_food_rule: 'Annual and perennial food are pooled outputs available to every current household member. Dependent children do not receive child-specific annual food or perennial acreage.'
  };
}
