# Owen Sound transit-network planner

This package builds route-concept evidence from validated local GIS inputs. It produces the routable graphs, destination layer, walking coverage, manually authored Hill Line, and clockwise/counter-clockwise Hill Loop comparison. It does not optimize the complete four- or five-bus network yet.

Run:

```sh
npm run transit:plan:owen-sound
```

Configuration lives in [`config/owen-sound-mvp.json`](config/owen-sound-mvp.json). Generated artifacts are written to `know/produce/transit-network-mvp/`.

## Validated inputs

- `data/boundaries/owen-sound.geojson`: municipal clipping boundary.
- `know/input/gis/road-centrelines-grey.geojson`: conventional bus graph, road names, classes, speed limits, and lanes.
- `data/osm/owen-sound.osm.pbf`: pedestrian streets and paths plus destination verification.
- `know/produce/grey-census-population-blocks.geojson`: population and dwelling weights.
- `know/input/gis/public-facilities.geojson`: secondary destinations.
- `know/input/transportation/owen-sound/location-of-aadt-sorted.pdf`: official historical 2006/2016 intersection-leg AADT and provisional truck percentages.
- `know/input/transportation/owen-sound/1750-16th-avenue-east-tis-2024.pdf`: observed September 2024 east-side turning-count locations and separate forecasts.

`know/input/gis/grey-transit-routes.geojson` is explicitly forbidden because it contains Pierce County, Washington data. The planner does not read it.

## Bus graph rules

Only centreline segments whose jurisdiction includes Owen Sound and whose midpoint lies inside the municipal boundary are included. Segments marked `NOT SUITABLE`, `CLOSED`, or `PRIVATE` are excluded. Each remaining segment is represented in both directions because the County traffic-flow field is empty; this assumption is listed as a material limitation in the report.

Posted speed is used where available and capped at 50 km/h for urban concept planning. Missing speed is inferred by Ontario Road Network class:

| Road class | Inferred speed |
| --- | ---: |
| 1–2 | 50 km/h |
| 3 | 40 km/h |
| 4 | 35 km/h |
| 5 | 30 km/h |
| 6 | 25 km/h |
| Unknown | 30 km/h |

Lower-class roads receive an additional generalized cost per kilometre to discourage inappropriate residential routing without banning necessary access: classes 1–2 receive 0 seconds/km, class 3 receives 8, class 4 receives 18, class 5 receives 30, class 6 receives 55, and unknown classes receive 35.

The transparent junction penalties are:

- 3 seconds for traversing a graph intersection with more than two outgoing edges.
- 7 seconds when changing road name by more than 20 degrees.
- 12 additional seconds for a turn sharper than 105 degrees.
- 18 additional seconds for an estimated left turn across an approach containing a major class 1–3 road.

These are deterministic screening costs, not observed delays. The config file is the sole source for their values.

## Stops and operations

Major destinations and shared destination intersections are fixed. Generated intermediate stops use a 400 m target and must remain at least 300 m from another physical stop. The planner prefers the first routed graph intersection from 75 m before through 150 m after the target and interpolates on the route only when no suitable intersection is available. Spacing evidence is exported in `hill-loop-stop-spacing.json`.

Scheduled stops do not automatically add dwell to every trip. The demand model assumes seven average passengers per loop, two potential board/alight events per passenger, and a 0.72 shared-event factor because riders often use the same stops. Expected unique active stops are estimated deterministically. Outputs report low-use, expected-use, and every-stop-used route and cycle times. A used stop adds 20 seconds; every loop adds five minutes of terminal layover.

Cycle time equals generalized in-motion time plus stop dwell and terminal layover. Required buses at a headway are `ceil(cycle time / headway)`. Daily vehicle distance assumes the configured 14-hour service span and deterministic even headways.

The Hill Loop is authored through the Downtown Transit Terminal, Highway 6/8th Avenue West, OSDSS, 8th Street West/3rd Avenue A West, 8th Street East/16th Avenue East, 16th Street East/18th Avenue East, and 16th Street East/9th Avenue East. The bounded counter-clockwise pass preserves the destination order while permitting documented non-destination approach changes. Directional turn and generalized travel penalties are recomputed. Recovery at 30 and 32 minutes is schedule time minus complete modelled cycle time, so a negative value means the schedule does not fit.

Georgian College, Brightshores hospital, and Heritage Place do not alter that authored alignment. Their destination points are projected onto the nearest route position, and the offset is exported in `hill-loop-destination-access.json`. A destination is only included in the direct loop OD analysis when its offset is within the configured 600 m threshold.

Major-destination travel tables contain all 20 directed pairs among OSDSS, the Downtown Transit Terminal, Georgian College, Brightshores hospital, and Heritage Place. Pairs are equally weighted because no observed OD matrix is available. Generalized passenger journey time combines in-vehicle time and average random-arrival waiting time.

For counter-rotation, the planner compares taking the first arriving bus with waiting for the direction having the shorter ride. Expected results are calculated on a deterministic 80 by 80 grid of directional arrival phases. An information-aware lower bound is also reported.

## Segment validation

Every directional loop segment occurrence is screened for County road class, lane count, documented winter maintenance, turn angle, and spatially matched OSM one-way tags. Divided-road matching considers all nearby OSM carriageways before declaring a direction violation. Immediate graph-edge U-turns are prohibited by the router.

No validated segment-grade surface is present, so grade remains unresolved and minibus suitability remains provisional even when the other automated checks pass. Destination and waypoint turnaround geometry is reported for field review rather than treated as certified.

## Walking coverage

OSM ways tagged as pedestrian paths or walkable street classes form the walking graph. Private and no-access links are excluded. Census blocks are assigned through one representative point snapped up to 180 m to that graph. Multi-source shortest walking distance from all Hill stops is calculated to 300, 400, and 600 m.

The planner also reports straight-line circular coverage for comparison. Circular coverage is expected to be higher because it ignores disconnected streets, crossings, water, grades, and other barriers.

## Bicycle stress and access

The bicycle graph combines municipal streets with OSM cycleways and paths whose access tags do not prohibit use. AADT is attached only to the named approach edge at a matched intersection. Counts are not propagated along an entire street; unmatched records remain in diagnostics. Newer AM/PM turning-count studies remain separate from daily AADT and forecasts.

The generalized LTS proxy uses measured AADT first, then highway status, speed, lane count and a modest road-class proxy. LTS 1-2 is comfortable, LTS 3 is a connecting route requiring greater care, and LTS 4 is high stress. A route preference can minimize stress or accept more stress for directness. Climbing is exported separately as unavailable because no validated citywide elevation surface is present.

## Integrated mobility scenarios

The integrated milestone combines the counter-rotating Hill Loop, the direct Brooke alternative, and authored southern and north/east coverage routes into four-bus, five-bus, and four-plus-evening-minibus cases. Walking coverage is recalculated from the union of physical stops. Comfortable bicycle access permits only LTS 1-2 edges; a separate result permits LTS 3 connecting streets, and an all-legal result permits LTS 4.

Operating costs are transparent configurable planning assumptions. Driver compensation, general vehicle operation, administration, fuel, maintenance, insurance, and capital replacement remain separate. Existing-contracted and nonprofit/co-operative profiles bound the principal scenario range; the accessible-minibus profile separately prices the evening increment.

## Outputs

- `bus-street-graph.geojson` and `pedestrian-street-graph.geojson`
- `street-graph-summary.json`
- `destinations.geojson`
- `hill-line.geojson`, `hill-line-stops.geojson`, and `hill-line-coverage.geojson`
- `hill-loop-directions.geojson`, `hill-loop-stops.geojson`, and `hill-loop-coverage.geojson`
- `hill-loop-destination-access.json`
- `hill-loop-stop-spacing.json`
- `major-destination-travel-times.json` and `.csv`
- `counter-rotating-strategies.json`
- `hill-loop-segment-validation.json` and `.csv`
- `network-comparison.json` and `network-comparison.csv`
- `map.html`: self-contained interactive SVG map
- `findings.md`: milestone findings and data-quality limitations
- `owen-sound-aadt-normalized.json` and `.csv`, `owen-sound-aadt-legs.geojson`, and `traffic-ingest-diagnostics.json`
- `bicycle-segment-stress.geojson`, `bicycle-routes.geojson` and `.csv`
- `bicycle-hill-loop-access.geojson` and `bicycle-hill-loop-access-summary.json`
- `bicycle-transfer-candidates.geojson`, `bicycle-multilane-audit.geojson`, and `bicycle-findings.md`
- `integrated-network-comparison.json` and `.csv`
- `integrated-scenario-*.geojson`, `multimodal-routes.geojson`, and `multimodal-journeys.json` and `.csv`
- `elevation-source-audit.json`, `integrated-mobility-findings.md`, and `mayoral-platform-mobility-summary.md`

The comparison output keeps access, directness, frequency, reliability, operating efficiency, and duplication scores separate. A weighted total is included only as a configurable convenience and is accompanied by its component values and weights.
