import { loadSystemicEnergyContract } from "../index";

const file = process.argv[2] ?? "data/systemic-energy/systemic-energy-v1.json";
const snapshot = loadSystemicEnergyContract(file);
console.log(`Validated ${snapshot.contract_id} ${snapshot.schema_version}`);
console.log(`Fields: ${snapshot.fields.length}; indicators: ${snapshot.indicators.length}`);
