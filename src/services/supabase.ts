/**
 * ARTISAN MARKETPLACE: SUPABASE CLIENT INFRASTRUCTURE
 * File: src/services/supabase.ts
 * 
 * Safely initializes the Supabase client library with placeholder fallback keys,
 * provides typed query wrappers to hydrate material benchmarks dynamically,
 * and executes product listing insert transactions.
 * 
 * Dependencies: @supabase/supabase-js
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { MaterialBenchmark, Product } from "../types/artisan.ts";
import { INTERNAL_MATERIAL_BENCHMARKS } from "./validation.ts";

/**
 * Universal environment variable extractor.
 * Safely checks Vite's `import.meta.env`, Node/Bun's `process.env`, or falls back
 * to standard production placeholder credentials to prevent runtime crashes.
 */
function getEnvVariable(key: string, defaultValue: string): string {
  // 1. Check Vite standard client variables
  try {
    const metaEnv = (import.meta as any)?.env;
    if (metaEnv && metaEnv[key]) {
      return String(metaEnv[key]);
    }
  } catch {
    // Ignore in non-meta environments
  }

  // 2. Check Node / Bun process.env
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return String(process.env[key]);
  }

  // 3. Fallback placeholder
  return defaultValue;
}

// Supabase configuration placeholders
const SUPABASE_URL = getEnvVariable(
  "SUPABASE_URL",
  getEnvVariable("VITE_SUPABASE_URL", "https://xyzcompany.supabase.co")
);

const SUPABASE_ANON_KEY = getEnvVariable(
  "SUPABASE_ANON_KEY",
  getEnvVariable("VITE_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder-artisan-anon-key")
);

/**
 * Supabase Client Instance (Lazy-initialized & guarded)
 */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: "public",
  },
});

/**
 * Supabase Data Service Wrapper
 */
export class SupabaseArtisanService {
  private client: SupabaseClient;

  constructor(clientInstance: SupabaseClient = supabase) {
    this.client = clientInstance;
  }

  /**
   * Fetches standardized material baseline rates from the `material_benchmarks` table.
   * If the Supabase database is unconfigured, unreachable, or offline, it gracefully
   * falls back to the hardcoded internal benchmarks to ensure zero UI interruption.
   */
  public async fetchMaterialBenchmarks(): Promise<MaterialBenchmark[]> {
    try {
      // Check if credentials are still placeholder
      if (SUPABASE_URL.includes("xyzcompany") || SUPABASE_URL.includes("placeholder")) {
        console.info("[Supabase] Using offline/internal benchmarks (placeholder environment detected).");
        return this.getInternalBenchmarksFallback();
      }

      const { data, error } = await this.client
        .from("material_benchmarks")
        .select("id, material_name, average_cost")
        .order("material_name", { ascending: true });

      if (error) {
        console.warn("[Supabase] Error querying material_benchmarks, falling back to local:", error.message);
        return this.getInternalBenchmarksFallback();
      }

      if (!data || data.length === 0) {
        return this.getInternalBenchmarksFallback();
      }

      return data as MaterialBenchmark[];
    } catch (err: any) {
      console.warn("[Supabase] Network/client exception, activating benchmark fallback:", err.message);
      return this.getInternalBenchmarksFallback();
    }
  }

  /**
   * Performs an atomic .insert() transaction on the `products` table upon form submission.
   * 
   * @param payload Craft product record matching table schema.
   */
  public async insertProduct(
    payload: Omit<Product, "id" | "created_at">
  ): Promise<{ data: Product | null; error: string | null }> {
    try {
      // Validate essential invariants before hitting database
      if (!payload.product_name || !payload.artisan_id || payload.calculated_price < 0) {
        return { data: null, error: "Validation failed: Missing required fields or negative price." };
      }

      const { data, error } = await this.client
        .from("products")
        .insert([
          {
            artisan_id: payload.artisan_id,
            product_name: payload.product_name,
            material_type: payload.material_type,
            calculated_price: payload.calculated_price,
            status: payload.status || "listed",
            image_url: payload.image_url || "",
          },
        ])
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: data as Product, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || "Unknown database transaction error" };
    }
  }

  /**
   * Performs a batch insert transaction for items flushed from client-side IndexedDB.
   */
  public async batchInsertProducts(
    productsList: Array<Omit<Product, "id" | "created_at">>
  ): Promise<{ data: Product[] | null; error: string | null }> {
    try {
      if (!productsList || productsList.length === 0) {
        return { data: [], error: null };
      }

      const sanitized = productsList.map(p => ({
        artisan_id: p.artisan_id,
        product_name: p.product_name,
        material_type: p.material_type,
        calculated_price: p.calculated_price,
        status: p.status || "listed",
        image_url: p.image_url || "",
      }));

      const { data, error } = await this.client
        .from("products")
        .insert(sanitized)
        .select();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: (data as Product[]) || [], error: null };
    } catch (err: any) {
      return { data: null, error: err.message || "Failed to batch insert products" };
    }
  }

  /**
   * Internal mapper to format fallback benchmarks into typed database models.
   */
  private getInternalBenchmarksFallback(): MaterialBenchmark[] {
    return Object.entries(INTERNAL_MATERIAL_BENCHMARKS).map(([name, cost], index) => ({
      id: index + 1,
      material_name: name,
      average_cost: cost,
    }));
  }
}
