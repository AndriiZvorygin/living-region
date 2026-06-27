import { validateScenario } from "../validation";

const errors = await validateScenario();
if (errors.length) {
  console.error(`Scenario validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  process.exit(1);
}
console.log("Scenario validation passed.");
