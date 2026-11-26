/**
 * ARTISAN MARKETPLACE: AI PRICING TRANSPARENCY & OVERRIDE SIMULATOR
 * File: src/services/pricing.ts
 * 
 * Implements the deterministic living-wage pricing formula:
 * [Material Cost] + [Hours worked * Hourly Rate] = [AI Price]
 * 
 * Includes native range slider calculation strictly capped at +/- 25%
 * and updates the "Likelihood of Sale" health meter state (Low, Balanced, High).
 */

import { PricingBreakdown, SaleLikelihoodAssessment, SaleLikelihoodState } from "../types/artisan.ts";

/**
 * Strict bounds for artisan manual pricing override.
 */
export const MIN_OVERRIDE_PERCENT = -25;
export const MAX_OVERRIDE_PERCENT = 25;

/**
 * Calculates the transparent mathematical breakdown of the AI fair living-wage price.
 * Formula: [Material Cost] + [Hours worked * Hourly Rate] = [AI Price]
 * 
 * @param materialCost Validated raw material cost in INR (₹).
 * @param laborHours Total hours invested by the artisan.
 * @param hourlyRate Fair living-wage rate per hour in INR (₹/hr).
 * @param overridePercent User manual adjustment percentage from range slider (-25% to +25%).
 */
export function calculatePricingBreakdown(
  materialCost: number,
  laborHours: number,
  hourlyRate: number,
  overridePercent = 0
): PricingBreakdown {
  const safeMaterialCost = Math.max(0, Number(materialCost) || 0);
  const safeHours = Math.max(0, Number(laborHours) || 0);
  const safeRate = Math.max(0, Number(hourlyRate) || 0);

  // Core formula: Material Cost + (Hours worked * Hourly Rate)
  const laborTotal = safeHours * safeRate;
  const aiBasePrice = Math.round(safeMaterialCost + laborTotal);

  // Strict clamp of the override margin between -25% and +25%
  const clampedOverride = Math.max(
    MIN_OVERRIDE_PERCENT,
    Math.min(MAX_OVERRIDE_PERCENT, Number(overridePercent) || 0)
  );

  // Calculate final adjusted price
  const adjustmentMultiplier = 1 + clampedOverride / 100;
  const finalAdjustedPrice = Math.max(1, Math.round(aiBasePrice * adjustmentMultiplier));

  return {
    materialCost: safeMaterialCost,
    laborHours: safeHours,
    hourlyRate: safeRate,
    laborTotal,
    aiBasePrice,
    overridePercent: clampedOverride,
    finalAdjustedPrice,
  };
}

/**
 * Evaluates the "Likelihood of Sale" health meter based on how far the artisan's
 * overridden price strays from fair-trade and urban market averages.
 * 
 * @param overridePercent The current slider offset (-25% to +25%).
 */
export function evaluateSaleLikelihood(overridePercent: number): SaleLikelihoodAssessment {
  const clamped = Math.max(MIN_OVERRIDE_PERCENT, Math.min(MAX_OVERRIDE_PERCENT, overridePercent));

  if (clamped <= -10) {
    // Discounted / Very accessible tier (-25% to -10%)
    const score = Math.round(85 + ((-10 - clamped) / 15) * 10); // 85% - 95%
    return {
      state: "High",
      scorePercent: Math.min(95, score),
      title: "High Likelihood of Sale",
      description: "Competitive pricing! Rapid buyer conversion expected. Ideal for high-volume orders or holiday craft markets.",
      colorClass: "text-emerald-700 dark:text-emerald-400",
      badgeBg: "bg-emerald-100 border-emerald-300",
      badgeText: "text-emerald-800",
    };
  } else if (clamped <= 10) {
    // Fair-trade sweet spot (-9% to +10%)
    const score = Math.round(75 + ((10 - Math.abs(clamped)) / 10) * 8); // 75% - 83%
    return {
      state: "Balanced",
      scorePercent: score,
      title: "Balanced Likelihood of Sale",
      description: "Market Recommended: Priced within the optimal sweet spot. Maximizes direct artisan income while maintaining high buyer trust.",
      colorClass: "text-amber-700 dark:text-amber-400",
      badgeBg: "bg-amber-100 border-amber-300",
      badgeText: "text-amber-900",
    };
  } else {
    // Premium tier (+11% to +25%)
    const score = Math.round(60 - ((clamped - 10) / 15) * 25); // 35% - 60%
    return {
      state: "Low",
      scorePercent: Math.max(35, score),
      title: "Low Likelihood of Sale",
      description: "Premium craft valuation. May take longer to sell or require targeted outreach to niche art collectors and luxury exhibitions.",
      colorClass: "text-rose-700 dark:text-rose-400",
      badgeBg: "bg-rose-100 border-rose-300",
      badgeText: "text-rose-900",
    };
  }
}
