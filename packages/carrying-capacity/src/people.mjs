const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Small non-medical display cue for the education interface. It is deliberately
 * bounded: height changes vertical scale, while BMI only gives a restrained
 * width cue and never becomes a body-health judgement.
 */
export function calculatePersonVisualMetrics({age_y = 35, height_cm = 170, weight_kg = 70} = {}) {
  const heightScale = clamp(Number(height_cm) / 178, .70, 1.25);
  const bmi = Number(weight_kg) / ((Number(height_cm) / 100) ** 2);
  const widthScale = clamp(.92 + (bmi - 22) * .018, .82, 1.16);
  const age = Number(age_y);
  const ageCategory = age < 13 ? 'child' : age < 19 ? 'adolescent' : age >= 65 ? 'older adult' : 'adult';
  return {height_scale: Number(heightScale.toFixed(4)), width_scale: Number(widthScale.toFixed(4)), bmi: Number(bmi.toFixed(2)), age_category: ageCategory};
}
