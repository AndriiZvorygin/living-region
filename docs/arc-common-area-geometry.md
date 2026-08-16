# ARC common-area geometry prototype

The legal-minimum ARC scenario uses a small, explicit common-area prototype instead of a zero-hectare lower bound or the former arbitrary 1.50 ha pooled assumption.

```text
public road
  -> common laneway
  -> terminal circulation loop
  -> central 250 m² common amenity/gathering envelope
  -> household residential/productive allocations
```

The entire development remains one parcel/title. The central envelope is common ground reserved for a future shared use; it is not a severed lot and its optional building capital is outside the legal-minimum recurring charge.

## Canonical prototype

The default is a configurable **50 m entrance-laneway length**. This is a modelling choice for the prototype, not a planning-law minimum or a universal site requirement.

| Input | Default | Treatment |
|---|---:|---|
| Entrance laneway length | 50 m | site-specific input; sensitivity at 30, 50, 75 and 100 m |
| Travelled lane width | 4 m | conceptual basic-gravel access surface |
| Shoulder/drainage corridor | 2 m total | included in common physical corridor |
| Emergency clearance addition | 0 m | unresolved until municipal/fire review |
| Central amenity envelope | 250 m² | common gathering/building-reserve ground |
| Circulating lane width | 6 m | conceptual annulus around the envelope |
| Other required shared area | 0 m² | explicit input when drainage, servicing or buffers cannot be assigned to households |

At the default settings, the geometry is approximately:

- laneway corridor: 300 m²;
- terminal circulation lane: 449.4 m²;
- central amenity envelope: 250 m²;
- total common property: 999.4 m², or 0.0999 ha.

The loop is calculated as a circular conceptual geometry: the 250 m² envelope supplies the inner radius, and the circulating-lane width expands it to the outer turning radius. This is not an emergency-vehicle approval. A real project must validate turning geometry, lane width, sight triangles, drainage, setbacks and fire access with the municipality and fire service.

## Boundary and double-counting rule

Only land that must remain physically common is included:

- travelled access and unavoidable shoulders, drainage and clearance;
- terminal circulation/turnaround land;
- the central common amenity/gathering envelope;
- explicitly required shared servicing, drainage or buffers.

Productive vegetation beside the laneway is not automatically common property. Thorny shrubs and trees, food-forest edges, coppice, windbreaks and wildlife barriers outside required vehicle clearances may be assigned to adjoining household leased productive allocations. Their ecological or productive function does not create a second area charge. Household connection strips are reported by the geometry API but excluded from common hectares for the same reason.

## API and economics

`calculateArcCommonAreaGeometry()` in `packages/carrying-capacity/src/common-area.mjs` is the canonical geometry function. `calculateArcSiteLeaseEconomics()` consumes its total common area and allocates common-property acquisition, tax and other selected land-layer costs equally across households. Productive hectares remain supplied by the carrying-capacity model and are not changed by this prototype.

The generated contract exposes the geometry, its provenance/status, and the laneway-length sensitivity. The current status is **derived from conceptual geometry; site/fire/municipal validation required**. The next refinement is a parcel-specific site-plan takeoff that replaces the prototype with actual alignment and unavoidable common polygons.
