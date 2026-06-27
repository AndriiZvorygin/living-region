import { exportScenario } from "../io";

const siteArg = process.argv.indexOf("--site");
const siteId = siteArg >= 0 ? process.argv[siteArg + 1] : undefined;
const files = await exportScenario({ siteId, fast: process.argv.includes("--fast") });
console.log(`Exported web scenario:\n${files.map((file) => `- ${file}`).join("\n")}`);
