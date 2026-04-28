// SPDX-License-Identifier: AGPL-3.0-or-later
import { mergeScenarioConstants } from './default_constants.mjs';

export const calibrationProfiles = {
  conservative: {
    railCorridor: {
      railFixedBaseAnnual: 540_000,
      railFarePerPassengerKm: 0.19,
      railFreightFeePerTonneKm: 0.05
    },
    transport: {
      railDemandDensityThreshold: 6_500
    },
    market: {
      dieselPriceMultiplier: 0.95,
      gasolinePriceMultiplier: 0.95,
      electricityPriceMultiplier: 1
    }
  },
  baseline: {},
  optimisticRail: {
    railCorridor: {
      railFixedBaseAnnual: 320_000,
      railFarePerPassengerKm: 0.24,
      railFreightFeePerTonneKm: 0.07
    },
    transport: {
      railDemandDensityThreshold: 3_800,
      railMinimumConditionForService: 0.3
    }
  },
  highFuelCost: {
    market: {
      dieselPriceMultiplier: 1.55,
      gasolinePriceMultiplier: 1.55,
      electricityPriceMultiplier: 1.1
    }
  },
  highRoadMaintenanceBurden: {
    roadMaintenance: {
      heavyTruckWearFactor: 0.000002,
      freezeThawStressMultiplier: 0.4,
      winterServiceMultiplier: 0.35
    }
  },
  lowRailFixedCost: {
    railCorridor: {
      railFixedBaseAnnual: 190_000
    }
  },
  highFreightValue: {
    railCorridor: {
      freightBenefitValuePerDieselLitreAvoided: 2.4,
      freightBenefitValuePerTonneSpoilageAvoided: 920,
      emergencySupplyResilienceValuePerTonneKm: 0.35
    }
  },
  highDensityCorridor: {
    transport: {
      passengerKmPerWorkerYear: 2_250,
      foodFreightTonnesPerBillionCalories: 620
    },
    railCorridor: {
      minimumRailPassengerKmForBasicService: 8_000,
      minimumRailFreightTonneKmForBasicService: 500
    }
  }
};

export function applyCalibrationProfile(defaultConstants, profileName = 'baseline') {
  const profile = calibrationProfiles[profileName] ?? calibrationProfiles.baseline;
  return mergeScenarioConstants(defaultConstants, profile);
}
