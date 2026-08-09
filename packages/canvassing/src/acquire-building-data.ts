import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sourceUrl =
  "https://open.canada.ca/data/dataset/3829eee9-f898-4643-9ad8-f48575b8873d/resource/f7fdee7d-09dd-4eb6-88fd-2234ad701309/download/on_structures_en.gpkg";
const output = resolve(
  "data/canvassing/canada-structures-owen-sound.geojson",
);
const metadataOutput = resolve(
  "data/canvassing/canada-structures-source.json",
);
const bbox = [-80.97, 44.53, -80.88, 44.62];

const delay = (milliseconds: number) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
let signedUrl = "";
for (let attempt = 0; attempt < 20; attempt++) {
  const redirectHeaders = execFileSync("curl", ["-sSI", sourceUrl], {
      encoding: "utf8",
    }),
    candidate = redirectHeaders
      .split(/\r?\n/)
      .filter((line) => /^location:/i.test(line))
      .at(-1)
      ?.replace(/^location:\s*/i, "");
  // GDAL 3.8 decodes %2B in Azure SAS query values before requesting them.
  // Request a fresh one-second signature until it has no plus character.
  if (candidate && !/%2b|\+/i.test(candidate)) {
    signedUrl = candidate;
    break;
  }
  await delay(1100);
}
if (!signedUrl)
  throw new Error(
    "Could not obtain a GDAL-safe Canada Structures signed download URL",
  );

await mkdir(dirname(output), { recursive: true });
const temporaryOutput = `${output}.download`;
try {
  execFileSync(
    "ogr2ogr",
    [
      "-f",
      "GeoJSON",
      temporaryOutput,
      `/vsicurl/${signedUrl}`,
      "ON_Structures_en",
      "-spat",
      ...bbox.map(String),
      "-spat_srs",
      "EPSG:4326",
      "-t_srs",
      "EPSG:4326",
      "-lco",
      "RFC7946=YES",
      "-nlt",
      "PROMOTE_TO_MULTI",
      "-overwrite",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        CPL_VSIL_CURL_ALLOWED_EXTENSIONS: ".gpkg",
        GDAL_HTTP_TIMEOUT: "120",
      },
    },
  );
  await rename(temporaryOutput, output);
} finally {
  await rm(temporaryOutput, { force: true });
}

const data = await readFile(output),
  collection = JSON.parse(data.toString("utf8"));
await writeFile(
  metadataOutput,
  JSON.stringify(
    {
      dataset: "Canada Structures",
      dataset_id: "3829eee9-f898-4643-9ad8-f48575b8873d",
      resource: "ON_Structures_EN",
      organization: "Public Safety Canada",
      source_url: sourceUrl,
      source_last_modified: "2025-09-17T16:07:45.430467",
      retrieved_at: new Date().toISOString(),
      licence: "Open Government Licence - Canada",
      citation:
        "Sandison J., Hayes S., Darlington C., Chastko K., & Ballard M. (2025). Canada Structures. https://doi.org/10.82126/z1bc-zd72",
      source_crs:
        "PCS Lambert Conformal Conic GRS80; exported to OGC:CRS84 / EPSG:4326",
      clip_bbox_wgs84: bbox,
      clip_features: collection.features.length,
      clip_sha256: createHash("sha256").update(data).digest("hex"),
      preprocessing:
        "GDAL spatial-filtered range read from the Ontario GeoPackage; exact municipal-boundary filtering occurs during canvassing preparation.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Acquired ${collection.features.length} Canada Structures candidates in ${output}`,
);
