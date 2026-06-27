import { exportScenario } from "../io";
import { validateScenario } from "../validation";

const files = await exportScenario();
const errors = await validateScenario();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Owen Sound yurt hamlet lot/concession scenario exported and validated (${files.length} files).`);
}
