# Evidence sources and input classification

The canonical source hierarchy is: Government of Canada/Ontario datasets; Canadian university or government trials; peer-reviewed northern-temperate evidence; major extension institutions; and other published evidence only when stronger sources are unavailable.

The checked-in source register is [`data/source/evidence-sources.csv`](../data/source/evidence-sources.csv). Each source records geography, climate or site, period, coverage/sample information and whether the number is measured, modelled or a benchmark.

## Food evidence

Statistics Canada Tables 32-10-0359-01 and 32-10-0358-01 provide 2020–2024 Ontario commercial averages for grains, pulses, oilseed and potatoes. These are not treated as low-input yields. The Organic Council of Ontario provides useful organic/conventional relationships for soybeans and winter wheat, but its coverage is incomplete and its farms still use external materials and machinery. The central rows therefore disclose an explicit adjustment rather than hiding a commercial input assumption.

Health Canada's 2026 Canadian Nutrient File supplies the energy, protein, fat and carbohydrate composition records. The checked-in subset is `data/source/current-food-composition.csv`; the complete CNF is not duplicated in the repository.

## Woody evidence

The long eastern/northern willow trial covers 19 cultivars and eight rotations from 1993–2019. Stable released-cultivar groups support a cautious ordinary band near 5 dry tonnes/ha/year; commercial and peak values are separated. An eastern-Canada unfertilized landfill-cell trial is retained as an exceptional site sensitivity, not an ordinary-site yield.

The 19 GJ/dry-tonne conversion is a gross dry-basis energy default. Moisture, species, drying, harvest, storage and heater losses are modelled separately.

## Heating evidence

ECCC Owen Sound MOE 1981–2010 HDD below 18°C is the climate normal retained in the calculation. All building assumptions are classified in `data/source/heating-assumptions.csv` as user target, design value, measured climate normal or modelling assumption. No as-built yurt blower-door, glazing, thermal-bridge or masonry-heater measurement was found in the historical material.

## Physical design

The layout remains an intensity gradient: residence, greenhouse, intensive garden, annual fields, perennial food, edible shrubs/coppice, dwarf/intermediate trees, full-size canopy/staples, protective edge. The soil/water objective is progressive perennial interception of runoff and nutrients, not a literal guarantee of zero runoff.
