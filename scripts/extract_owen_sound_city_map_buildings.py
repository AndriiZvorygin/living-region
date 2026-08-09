#!/usr/bin/env python3
"""Extract private-reference building roofs from Owen Sound's geospatial city map."""

from __future__ import annotations

import hashlib
import json
import math
import os
import sys
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy
from osgeo import gdal, ogr, osr


ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "Map - City Map.pdf"
BOUNDARY_PATH = ROOT / "data/boundaries/owen-sound.geojson"
OUTPUT_PATH = ROOT / "data/canvassing/owen-sound-city-map-buildings.geojson"
METADATA_PATH = ROOT / "data/canvassing/owen-sound-city-map-source.json"
LAYER_NAME = "Map_Frame.Developments.COSGEO_DBO_BuildingFootprints"
DPI = 576
# The solid roof fill is RGB 214. A tight threshold avoids joining adjacent
# roofs through the light anti-aliasing pixels around their edges.
BUILDING_MAX_VALUE = 218
MIN_AREA_M2 = 12
MAX_AREA_M2 = 25_000
SIMPLIFY_M = 0.35


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def remove_raster_bridges(
    mask: numpy.ndarray, radius: int = 2
) -> numpy.ndarray:
    """Open a binary mask with a square kernel without requiring scipy."""
    source = mask.astype(bool, copy=False)
    height, width = source.shape
    horizontal = source.copy()
    horizontal[:, :radius] = False
    horizontal[:, -radius:] = False
    for offset in range(-radius, radius + 1):
        horizontal[:, radius:-radius] &= source[
            :, radius + offset : width - radius + offset
        ]
    eroded = horizontal.copy()
    eroded[:radius, :] = False
    eroded[-radius:, :] = False
    for offset in range(-radius, radius + 1):
        eroded[radius:-radius, :] &= horizontal[
            radius + offset : height - radius + offset, :
        ]

    horizontal = numpy.zeros_like(eroded)
    for offset in range(-radius, radius + 1):
        horizontal[:, radius + offset : width - radius + offset] |= eroded[
            :, radius:-radius
        ]
    opened = numpy.zeros_like(horizontal)
    for offset in range(-radius, radius + 1):
        opened[radius + offset : height - radius + offset, :] |= horizontal[
            radius:-radius, :
        ]
    return opened


def load_city_boundary(target_srs: osr.SpatialReference) -> ogr.Geometry:
    collection = json.loads(BOUNDARY_PATH.read_text())
    geometry = ogr.CreateGeometryFromJson(
        json.dumps(collection["features"][0]["geometry"])
    )
    source_srs = osr.SpatialReference()
    source_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    source_srs.ImportFromEPSG(4326)
    target_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    geometry.AssignSpatialReference(source_srs)
    geometry.Transform(osr.CoordinateTransformation(source_srs, target_srs))
    return geometry


def townhouse_subdivision(
    geometry: ogr.Geometry,
) -> tuple[list[ogr.Geometry], dict | None]:
    if geometry.GetGeometryName() != "POLYGON" or geometry.GetGeometryCount() != 1:
        return [geometry], None
    area_m2 = geometry.GetArea()
    if not 400 <= area_m2 <= 2_200:
        return [geometry], None
    ring = geometry.GetGeometryRef(0)
    if ring.GetPointCount() < 60:
        return [geometry], None
    points = numpy.asarray(
        [(ring.GetX(i), ring.GetY(i)) for i in range(ring.GetPointCount())]
    )
    center = points.mean(axis=0)
    eigenvalues, eigenvectors = numpy.linalg.eigh(
        numpy.cov((points - center).T)
    )
    axis = eigenvectors[:, int(numpy.argmax(eigenvalues))]
    normal = numpy.asarray([-axis[1], axis[0]])
    along = (points - center) @ axis
    across = (points - center) @ normal
    minimum_along, maximum_along = float(along.min()), float(along.max())
    minimum_across, maximum_across = float(across.min()), float(across.max())
    length_m = maximum_along - minimum_along
    width_m = maximum_across - minimum_across
    aspect = length_m / max(width_m, 0.1)
    fill_ratio = area_m2 / max(length_m * width_m, 1)
    if (
        length_m < 35
        or width_m > 24
        or aspect < 2.7
        or fill_ratio > 0.88
    ):
        return [geometry], None
    unit_count = max(4, min(12, round(length_m / 9.5)))
    parts: list[ogr.Geometry] = []
    for index in range(unit_count):
        low = minimum_along + (length_m * index) / unit_count
        high = minimum_along + (length_m * (index + 1)) / unit_count
        corners = [
            center + axis * low + normal * (minimum_across - 2),
            center + axis * high + normal * (minimum_across - 2),
            center + axis * high + normal * (maximum_across + 2),
            center + axis * low + normal * (maximum_across + 2),
        ]
        slice_ring = ogr.Geometry(ogr.wkbLinearRing)
        for x, y in corners:
            slice_ring.AddPoint_2D(float(x), float(y))
        slice_ring.AddPoint_2D(float(corners[0][0]), float(corners[0][1]))
        slice_polygon = ogr.Geometry(ogr.wkbPolygon)
        slice_polygon.AddGeometry(slice_ring)
        part = geometry.Intersection(slice_polygon)
        if part is None or part.IsEmpty() or not 30 <= part.GetArea() <= 350:
            return [geometry], None
        parts.append(part)
    if sum(part.GetArea() for part in parts) / area_m2 < 0.97:
        return [geometry], None
    return parts, {
        "method": "probable_townhouse_equal_frontage",
        "unit_count": unit_count,
        "parent_area_m2": round(area_m2, 1),
        "parent_length_m": round(length_m, 1),
        "parent_width_m": round(width_m, 1),
    }


def first_coordinate(geometry: dict) -> tuple[float, float]:
    coordinates = geometry["coordinates"]
    while coordinates and isinstance(coordinates[0][0], list):
        coordinates = coordinates[0]
    return float(coordinates[0][0]), float(coordinates[0][1])


def main() -> None:
    if not PDF_PATH.exists():
        raise SystemExit(f"Missing source PDF: {PDF_PATH}")

    gdal.UseExceptions()
    source = gdal.OpenEx(
        str(PDF_PATH),
        gdal.OF_RASTER,
        open_options=[
            f"DPI={DPI}",
            f"LAYERS={LAYER_NAME}",
            "RENDERING_OPTIONS=VECTOR",
            "BANDS=3",
        ],
    )
    if source is None:
        raise SystemExit("GDAL could not open the supplied geospatial PDF")
    layers = source.GetMetadata("LAYERS")
    if LAYER_NAME not in layers.values():
        raise SystemExit(f"PDF does not contain expected layer: {LAYER_NAME}")

    source_srs = osr.SpatialReference()
    source_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    source_srs.ImportFromWkt(source.GetProjection())
    city_boundary = load_city_boundary(source_srs)
    target_srs = osr.SpatialReference()
    target_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    target_srs.ImportFromEPSG(4326)
    to_source = osr.CoordinateTransformation(target_srs, source_srs)
    previous_path = Path(os.environ.get("CITY_MAP_PREVIOUS", OUTPUT_PATH))
    previous_grid: dict[tuple[int, int], list[dict]] = {}
    if previous_path.exists():
        previous_collection = json.loads(previous_path.read_text())
        for previous in previous_collection.get("features", []):
            geometry = ogr.CreateGeometryFromJson(
                json.dumps(previous["geometry"])
            )
            geometry.AssignSpatialReference(target_srs)
            geometry.Transform(to_source)
            center = geometry.Centroid()
            key = (math.floor(center.GetX() / 10), math.floor(center.GetY() / 10))
            previous_grid.setdefault(key, []).append(
                {
                    "id": str(
                        previous.get("properties", {}).get("CITY_MAP_ID")
                        or previous.get("id")
                    ),
                    "geometry": geometry,
                    "center": (center.GetX(), center.GetY()),
                    "area": geometry.GetArea(),
                    "used": False,
                }
            )

    with TemporaryDirectory(prefix="owen-city-map-roofs-") as temporary:
        mask_path = str(Path(temporary) / "building-mask.tif")
        vector_path = str(Path(temporary) / "building-mask.gpkg")
        mask = gdal.GetDriverByName("GTiff").Create(
            mask_path,
            source.RasterXSize,
            source.RasterYSize,
            1,
            gdal.GDT_Byte,
            options=["TILED=YES", "COMPRESS=DEFLATE"],
        )
        mask.SetGeoTransform(source.GetGeoTransform())
        mask.SetProjection(source.GetProjection())
        source_band = source.GetRasterBand(1)
        mask_band = mask.GetRasterBand(1)
        for y in range(0, source.RasterYSize, 256):
            height = min(256, source.RasterYSize - y)
            read_y = max(0, y - 4)
            read_end = min(source.RasterYSize, y + height + 4)
            values = source_band.ReadAsArray(
                0,
                read_y,
                source.RasterXSize,
                read_end - read_y,
            )
            raw_mask = numpy.asarray(
                values < BUILDING_MAX_VALUE, dtype=numpy.uint8
            )
            opened_mask = remove_raster_bridges(raw_mask)
            offset = y - read_y
            building_mask = opened_mask[offset : offset + height, :]
            mask_band.WriteArray(building_mask, 0, y)
        mask_band.SetNoDataValue(0)
        mask_band.FlushCache()

        vector = ogr.GetDriverByName("GPKG").CreateDataSource(vector_path)
        layer = vector.CreateLayer("building_roofs", source_srs, ogr.wkbPolygon)
        layer.CreateField(ogr.FieldDefn("value", ogr.OFTInteger))
        gdal.Polygonize(mask_band, mask_band, layer, 0)
        vector = None
        mask = None
        source = None

        vector = ogr.Open(vector_path)
        layer = vector.GetLayer(0)
        transform = osr.CoordinateTransformation(source_srs, target_srs)
        source_hash = sha256(PDF_PATH)
        extracted = []
        reused_ids = 0
        subdivided_parents = 0
        subdivided_units = 0
        rejected = {
            "outside_boundary": 0,
            "area": 0,
            "invalid_geometry": 0,
        }

        for feature in layer:
            geometry = feature.GetGeometryRef().Clone()
            area_m2 = geometry.GetArea()
            if area_m2 < MIN_AREA_M2 or area_m2 > MAX_AREA_M2:
                rejected["area"] += 1
                continue
            if not geometry.Centroid().Within(city_boundary):
                rejected["outside_boundary"] += 1
                continue
            geometry = geometry.SimplifyPreserveTopology(SIMPLIFY_M)
            if geometry is None or geometry.IsEmpty() or not geometry.IsValid():
                rejected["invalid_geometry"] += 1
                continue
            parts, subdivision = townhouse_subdivision(geometry)
            if subdivision:
                subdivided_parents += 1
                subdivided_units += len(parts)
            parent_key = hashlib.sha256(geometry.ExportToWkb()).hexdigest()[:20]
            for unit_index, part in enumerate(parts, start=1):
                part_area_m2 = part.GetArea()
                center = part.Centroid()
                grid_x = math.floor(center.GetX() / 10)
                grid_y = math.floor(center.GetY() / 10)
                previous_candidates = [
                    candidate
                    for dx in (-1, 0, 1)
                    for dy in (-1, 0, 1)
                    for candidate in previous_grid.get(
                        (grid_x + dx, grid_y + dy), []
                    )
                    if not candidate["used"]
                ]
                compatible = []
                for candidate in previous_candidates:
                    center_distance = math.hypot(
                        center.GetX() - candidate["center"][0],
                        center.GetY() - candidate["center"][1],
                    )
                    area_ratio = part_area_m2 / max(candidate["area"], 1)
                    if (
                        center_distance <= 5
                        and 0.55 <= area_ratio <= 1.8
                        and part.Intersects(candidate["geometry"])
                    ):
                        compatible.append(
                            (
                                center_distance + abs(math.log(area_ratio)),
                                candidate,
                            )
                        )
                if compatible:
                    matched = min(compatible, key=lambda item: item[0])[1]
                    matched["used"] = True
                    external_id = matched["id"]
                    reused_ids += 1
                else:
                    geometry_key = hashlib.sha256(
                        part.ExportToWkb()
                    ).hexdigest()[:20]
                    external_id = f"{source_hash[:12]}:{geometry_key}"
                part.Transform(transform)
                extracted.append(
                    {
                        "type": "Feature",
                        "id": external_id,
                        "properties": {
                            "CITY_MAP_ID": external_id,
                            "area_m2": round(part_area_m2, 1),
                            "external_source": "owen_sound_city_map_pdf",
                            "source_layer": LAYER_NAME,
                            "source_pdf_sha256": source_hash,
                            "source_map_date": "2022-04-07",
                            "confidence": (
                                "official_map_subdivided"
                                if subdivision
                                else "official_map_extracted"
                            ),
                            "geometry_provenance": "sourced",
                            "private_reference_only": True,
                            "source_parent_geometry_id": (
                                parent_key if subdivision else None
                            ),
                            "subdivision_method": (
                                subdivision["method"] if subdivision else None
                            ),
                            "townhouse_unit_index": (
                                unit_index if subdivision else None
                            ),
                            "townhouse_unit_count": (
                                subdivision["unit_count"]
                                if subdivision
                                else None
                            ),
                        },
                        "geometry": json.loads(part.ExportToJson()),
                    }
                )

    extracted.sort(
        key=lambda item: (
            first_coordinate(item["geometry"])[1],
            first_coordinate(item["geometry"])[0],
            item["properties"]["CITY_MAP_ID"],
        )
    )
    collection = {
        "type": "FeatureCollection",
        "metadata": {
            "source": "City of Owen Sound, Map - City Map.pdf",
            "source_layer": LAYER_NAME,
            "source_pdf_sha256": source_hash,
            "source_map_date": "2022-04-07",
            "source_crs": "NAD83 / UTM zone 17N",
            "output_crs": "OGC:CRS84",
            "method": "isolated GeoPDF vector-layer rendering and polygonization",
            "private_reference_only": True,
        },
        "features": extracted,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(collection, separators=(",", ":")) + "\n")
    output_hash = sha256(OUTPUT_PATH)
    METADATA_PATH.write_text(
        json.dumps(
            {
                "source": "City of Owen Sound, Map - City Map.pdf",
                "source_path": str(PDF_PATH.relative_to(ROOT)),
                "source_pdf_sha256": source_hash,
                "source_map_date": "2022-04-07",
                "source_creator": "Esri ArcGIS Pro 2.9.2.32739",
                "source_layer": LAYER_NAME,
                "source_crs": "NAD83 / UTM zone 17N",
                "retrieval_context": "Official map supplied directly by the user",
                "retrieval_date": date.today().isoformat(),
                "licence": (
                    "Not stated in supplied PDF; retained as a private canvassing "
                    "reference pending confirmation"
                ),
                "private_reference_only": True,
                "extraction": {
                    "dpi": DPI,
                    "pixel_size_m_approx": 72 / DPI * 3.55,
                    "building_threshold_max": BUILDING_MAX_VALUE,
                    "minimum_area_m2": MIN_AREA_M2,
                    "maximum_area_m2": MAX_AREA_M2,
                    "simplify_tolerance_m": SIMPLIFY_M,
                    "topology_cleanup": (
                        "two-pixel-radius 5x5-kernel opening before polygonization"
                    ),
                    "feature_count": len(extracted),
                    "stable_ids_reused": reused_ids,
                    "new_or_split_ids": len(extracted) - reused_ids,
                    "townhouse_parents_subdivided": subdivided_parents,
                    "townhouse_units_created": subdivided_units,
                    "rejected": rejected,
                },
                "output_path": str(OUTPUT_PATH.relative_to(ROOT)),
                "output_sha256": output_hash,
                "limitations": [
                    "The PDF exposes cartographic drawing commands, not original GIS feature records.",
                    "Edges are quantized by the 576 DPI extraction to approximately 0.44 metres.",
                    "A solid-fill threshold intentionally trims light anti-aliased edges so neighbouring roofs remain separate.",
                    "A two-pixel-radius opening removes raster bridges narrower than approximately 1.8 metres.",
                    "Probable long townhouse rows are divided into approximate equal-frontage units; these boundaries are not parcels.",
                    "Building types and original municipal feature identifiers are not present.",
                    "The layer is for private canvassing reference and must not be uploaded to OpenStreetMap.",
                ],
            },
            indent=2,
        )
        + "\n"
    )
    print(
        f"Extracted {len(extracted)} city-map roofs to "
        f"{OUTPUT_PATH.relative_to(ROOT)} ({output_hash})"
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"City-map roof extraction failed: {error}", file=sys.stderr)
        raise
