/**
 * ARTISAN MARKETPLACE: TYPE DEFINITIONS
 * File: src/types/artisan.ts
 * 
 * Strict, production-grade TypeScript definitions for material cost validation,
 * AI pricing simulations, IndexedDB offline queuing, and village trust milestones.
 */

/**
 * Standardized raw material identifiers recognized by the craft council.
 */
export type StandardMaterial = 
  | "Clay"
  | "Yarn"
  | "Wood"
  | "Silk"
  | "Brass"
  | "Bamboo"
  | "Stone"
  | "Leather";

/**
 * Represents a craft board benchmark cost record.
 */
export interface MaterialBenchmark {
  id: number;
  material_name: string;
  average_cost: number;
}

/**
 * Village artisan directory profile.
 */
export interface Artisan {
  id: string; // UUIDv4
  name: string;
  location: string;
  phone_number: string;
  created_at?: string;
}

/**
 * Financial lifecycle status tracking craft order fulfillment.
 */
export type MilestoneStatus = 
  | "listed" 
  | "sold" 
  | "processing" 
  | "in_bank_account";

/**
 * Relational product record mapped directly to PostgreSQL database.
 */
export interface Product {
  id: string; // UUIDv4
  artisan_id: string;
  product_name: string;
  material_type: string;
  calculated_price: number;
  status: MilestoneStatus;
  image_url: string;
  created_at?: string;
}

/**
 * Payload sent during craft listing creation and sync.
 */
export interface ProductListingPayload {
  artisan_id: string;
  product_name: string;
  material_type: string;
  custom_material_cost: number;
  labor_hours: number;
  hourly_rate: number;
  calculated_price: number;
  price_override_percent: number;
  status: MilestoneStatus;
  image_url: string;
  offline_created_at?: string;
}

/**
 * Queued object stored inside client-side IndexedDB when offline.
 */
export interface QueuedProduct {
  localId?: number; // Auto-incrementing primary key in IndexedDB
  payload: ProductListingPayload;
  queuedAt: string;
  retryCount: number;
  lastAttemptAt?: string;
  lastError?: string;
}

/**
 * Result of the material cost deviation check (+/- 30%).
 */
export interface CostDeviationResult {
  material: string;
  enteredCost: number;
  baselineCost: number;
  deviationPercent: number;
  isOutlier: boolean;
  direction: "above" | "below" | "exact";
  warningMessage: string;
}

/**
 * Mathematical breakdown of the AI fair living-wage price.
 */
export interface PricingBreakdown {
  materialCost: number;
  laborHours: number;
  hourlyRate: number;
  laborTotal: number;
  aiBasePrice: number;
  overridePercent: number;
  finalAdjustedPrice: number;
}

/**
 * Health assessment states for the Likelihood of Sale meter.
 */
export type SaleLikelihoodState = "Low" | "Balanced" | "High";

/**
 * Likelihood of Sale evaluation details.
 */
export interface SaleLikelihoodAssessment {
  state: SaleLikelihoodState;
  scorePercent: number; // 0 - 100 for gauge visualization
  title: string;
  description: string;
  colorClass: string;
  badgeBg: string;
  badgeText: string;
}

/**
 * Milestone timeline step definition for village trust UI.
 */
export interface TimelineStepDefinition {
  status: MilestoneStatus;
  label: string;
  vernacularLabel: string;
  description: string;
  iconSvg: string;
}
