import { exportScenario } from "../io";

const siteArg = process.argv.indexOf("--site");
const siteId = siteArg >= 0 ? process.argv[siteArg + 1] : undefined;
const fast = process.argv.includes("--fast");
const files = await exportScenario({ siteId, fast });
console.log(`Prepared lot/concession site scenario${siteId ? ` for ${siteId}` : ""} (${files.length} files).`);
