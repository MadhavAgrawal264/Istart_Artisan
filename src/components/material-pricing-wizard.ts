/**
 * ARTISAN MARKETPLACE: FAIR PRICING ASSISTANT
 * File: src/components/material-pricing-wizard.ts
 *
 * Simple, plain-language pricing assistant for Indian artisans:
 *   Total Production Cost = Material Cost + Labour Cost + Packaging Cost + Other Expenses
 *   Suggested Selling Price = Total Production Cost * (1 + Profit Margin / 100)
 * Allows manual final price adjustment and saving directly to a product listing.
 */

import { ProductListingPayload, MilestoneStatus } from "../types/artisan.ts";
import { OfflineSyncManager } from "../services/storage.ts";
import { INTERNAL_MATERIAL_BENCHMARKS } from "../services/validation.ts";
import { calculateFairPriceSummary, FairPriceSummary } from "../services/pricing.ts";
import { VillageAudioAssistant } from "../services/accessibility.ts";
import { SupabaseArtisanService } from "../services/supabase.ts";
import { renderFinancialTimelineHTML } from "./milestone-timeline.ts";

export function renderMaterialPricingWizardHTML(): string {
  const defaultTimelineHTML = renderFinancialTimelineHTML("listed");

  return `
    <div id="artisan-pricing-suite" class="max-w-5xl mx-auto space-y-6 font-sans">

      <!-- Page Header & Sync Status -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="font-serif text-2xl sm:text-3xl font-bold text-[#292929]">Fair Pricing Assistant</h1>
          <p class="text-xs sm:text-sm text-[#5C5C57] mt-1">Add up your materials, time, and expenses to find a selling price that covers all your costs.</p>
        </div>

        <div id="sync-status-banner" class="rounded-xl px-3.5 py-2 bg-[#DCE5C5] border border-[#B8C77B] flex items-center gap-2.5 text-xs self-start sm:self-auto">
          <span id="sync-status-indicator" class="w-2.5 h-2.5 rounded-full bg-[#3F4D22] pulse-subtle"></span>
          <span id="sync-status-text" class="font-semibold text-[#292929]">Saved & Ready</span>
          <span id="offline-queue-badge" class="hidden px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#EBC5A9] text-[#292929]">0 Saved</span>
          <button type="button" id="btn-force-sync" class="hidden px-2.5 py-1 rounded-lg text-xs font-semibold bg-white text-[#292929] border border-[#E6E4DD] cursor-pointer">
            Sync Now
          </button>
        </div>
      </div>

      <form id="craft-pricing-form" class="grid grid-cols-1 lg:grid-cols-12 gap-6" novalidate>

        <!-- Left Column: Everyday Inputs -->
        <div class="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-7 border border-[#E6E4DD] shadow-xs space-y-5">
          <div class="flex items-center justify-between pb-3 border-b border-[#E6E4DD]">
            <div>
              <h2 class="text-lg sm:text-xl font-bold text-[#292929] font-serif">Your Costs & Time</h2>
              <p class="text-xs text-[#5C5C57]">Enter every expense in simple rupees (₹)</p>
            </div>
            <button
              type="button"
              class="audio-btn w-9 h-9 rounded-full text-[#292929] bg-[#DCE5C5] hover:bg-[#B8C77B] flex items-center justify-center cursor-pointer"
              data-audio-text="Enter how much you spent on materials, your labour cost or hours worked, packaging, other expenses, and the profit margin you want."
              aria-label="Listen to instructions"
              title="Listen to instructions"
            >
              🔊
            </button>
          </div>

          <!-- Optional: Apply directly to an existing product -->
          <div class="p-4 rounded-2xl bg-[#FAFAF8] border border-[#E6E4DD] space-y-2">
            <label for="pricing-target-product" class="block text-xs sm:text-sm font-semibold text-[#292929]">
              Apply Price to One of Your Products (Optional)
            </label>
            <select
              id="pricing-target-product"
              class="w-full p-3 rounded-xl border border-[#E6E4DD] bg-white text-sm text-[#292929]"
            >
              <option value="">-- Just calculate or create a new product below --</option>
            </select>
            <p class="text-[11px] text-[#5C5C57]">Pick a product above if you want to save this calculated price straight onto its listing.</p>
          </div>

          <!-- 1. Raw Material Cost -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="material-catalog-select" class="block text-xs sm:text-sm font-semibold text-[#292929] mb-1">
                Main Material (Optional)
              </label>
              <select
                id="material-catalog-select"
                name="material_type"
                class="w-full p-3 rounded-xl border border-[#E6E4DD] bg-[#FAFAF8] text-sm font-medium text-[#292929]"
              >
                <option value="Clay">Clay (Terracotta / Pottery)</option>
                <option value="Yarn">Yarn (Khadi / Cotton)</option>
                <option value="Wood">Wood (Carving / Toys)</option>
                <option value="Silk">Silk</option>
                <option value="Brass">Brass / Bell Metal</option>
                <option value="Bamboo">Bamboo & Cane</option>
                <option value="Stone">Stone</option>
                <option value="Leather">Leather</option>
              </select>
            </div>

            <div>
              <label for="material-cost-input" class="block text-xs sm:text-sm font-semibold text-[#292929] mb-1">
                1. Raw Material Cost (₹)
              </label>
              <div class="relative">
                <span class="absolute left-3.5 top-3 text-[#5C5C57] font-bold">₹</span>
                <input
                  type="number"
                  id="material-cost-input"
                  name="custom_material_cost"
                  min="0"
                  step="1"
                  value="300"
                  required
                  class="w-full pl-8 pr-3.5 py-3 rounded-xl border border-[#E6E4DD] bg-[#FAFAF8] text-sm font-bold text-[#292929]"
                />
              </div>
              <p class="text-[11px] text-[#5C5C57] mt-1">Clay, yarn, wood, colours, beads, or metal you bought.</p>
            </div>
          </div>

          <!-- 2. Labour Cost (Hours × Rate OR Direct Amount) -->
          <div class="p-4 rounded-2xl bg-[#FAFAF8] border border-[#E6E4DD] space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-xs sm:text-sm font-semibold text-[#292929]">2. Your Work & Labour Cost</span>
              <div class="inline-flex rounded-xl bg-white p-0.5 border border-[#E6E4DD] text-xs">
                <button type="button" id="labour-mode-hours" class="px-3 py-1 rounded-lg bg-[#B8C77B] text-[#292929] font-semibold cursor-pointer">Hours × Rate</button>
                <button type="button" id="labour-mode-direct" class="px-3 py-1 rounded-lg text-[#5C5C57] font-medium cursor-pointer">Direct ₹</button>
              </div>
            </div>

            <div id="labour-hours-panel" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="labor-hours-input" class="block text-xs font-semibold text-[#292929] mb-1">Working Hours</label>
                <input
                  type="number"
                  id="labor-hours-input"
                  name="labor_hours"
                  min="0"
                  step="0.5"
                  value="10"
                  class="w-full p-3 rounded-xl border border-[#E6E4DD] bg-white text-sm font-bold text-[#292929]"
                />
              </div>
              <div>
                <label for="hourly-wage-input" class="block text-xs font-semibold text-[#292929] mb-1">Labour Rate (₹ per hour)</label>
                <input
                  type="number"
                  id="hourly-wage-input"
                  name="hourly_rate"
                  min="0"
                  step="5"
                  value="90"
                  class="w-full p-3 rounded-xl border border-[#E6E4DD] bg-white text-sm font-bold text-[#292929]"
                />
              </div>
            </div>

            <div id="labour-direct-panel" class="hidden">
              <label for="direct-labour-cost-input" class="block text-xs font-semibold text-[#292929] mb-1">Total Labour Cost (₹)</label>
              <input
                type="number"
                id="direct-labour-cost-input"
                min="0"
                step="10"
                value="900"
                class="w-full p-3 rounded-xl border border-[#E6E4DD] bg-white text-sm font-bold text-[#292929]"
              />
            </div>

            <p class="text-[11px] text-[#5C5C57]">Value of the time and skill you or family helpers spent making the piece.</p>
          </div>

          <!-- 3 & 4. Packaging & Other Production Expenses -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="packaging-cost-input" class="block text-xs sm:text-sm font-semibold text-[#292929] mb-1">
                3. Packaging Cost (₹)
              </label>
              <div class="relative">
                <span class="absolute left-3.5 top-3 text-[#5C5C57] font-bold">₹</span>
                <input
                  type="number"
                  id="packaging-cost-input"
                  min="0"
                  step="1"
                  value="80"
                  class="w-full pl-8 pr-3.5 py-3 rounded-xl border border-[#E6E4DD] bg-[#FAFAF8] text-sm font-bold text-[#292929]"
                />
              </div>
              <p class="text-[11px] text-[#5C5C57] mt-1">Box, cloth wrap, tape, or cushion material.</p>
            </div>

            <div>
              <label for="other-expenses-input" class="block text-xs sm:text-sm font-semibold text-[#292929] mb-1">
                4. Other Expenses (₹)
              </label>
              <div class="relative">
                <span class="absolute left-3.5 top-3 text-[#5C5C57] font-bold">₹</span>
                <input
                  type="number"
                  id="other-expenses-input"
                  min="0"
                  step="1"
                  value="70"
                  class="w-full pl-8 pr-3.5 py-3 rounded-xl border border-[#E6E4DD] bg-[#FAFAF8] text-sm font-bold text-[#292929]"
                />
              </div>
              <p class="text-[11px] text-[#5C5C57] mt-1">Kiln fuel, electricity, workshop rent, or travel.</p>
            </div>
          </div>

          <!-- 5. Desired Profit Margin -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label for="profit-margin-input" class="text-xs sm:text-sm font-semibold text-[#292929]">
                5. Desired Profit Margin (%)
              </label>
              <span class="text-xs font-semibold text-[#3F4D22]" id="margin-preview-label">20%</span>
            </div>
            <div class="flex items-center gap-3">
              <input
                type="range"
                id="profit-margin-slider"
                min="0"
                max="100"
                value="20"
                class="flex-1 h-2 bg-[#DCE5C5] rounded-lg accent-[#B8C77B] cursor-pointer"
              />
              <input
                type="number"
                id="profit-margin-input"
                min="0"
                max="200"
                value="20"
                class="w-20 p-2.5 rounded-xl border border-[#E6E4DD] bg-[#FAFAF8] text-sm font-bold text-center text-[#292929]"
              />
            </div>
            <p class="text-[11px] text-[#5C5C57] mt-1">Extra earnings above your costs to help your workshop grow.</p>
          </div>

          <!-- Optional: Save as New Product Name -->
          <div class="pt-3 border-t border-[#E6E4DD] space-y-3">
            <div>
              <label for="product-name-input" class="block text-xs sm:text-sm font-semibold text-[#292929] mb-1">
                New Product Name (Only if saving as a new listing)
              </label>
              <input
                type="text"
                id="product-name-input"
                name="product_name"
                placeholder="e.g. Hand-Painted Terracotta Lamp"
                class="w-full p-3 rounded-xl border border-[#E6E4DD] bg-[#FAFAF8] text-sm text-[#292929]"
              />
            </div>

            <div class="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                id="btn-apply-price-to-product"
                class="hidden min-h-[44px] px-5 py-2.5 rounded-xl bg-[#556436] hover:bg-[#46532c] text-white font-semibold text-xs sm:text-sm cursor-pointer"
              >
                Save Price to Selected Product
              </button>
              <button
                type="submit"
                id="btn-submit-listing"
                class="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#B8C77B] hover:bg-[#a6b668] text-[#292929] font-semibold text-xs sm:text-sm cursor-pointer"
              >
                Save as New Listing →
              </button>
            </div>
          </div>
        </div>

        <!-- Right Column: Plain-Language Breakdown & Final Price Adjustment -->
        <div class="lg:col-span-5 space-y-5">

          <!-- Prominent Suggested Selling Price Card -->
          <div class="rounded-3xl bg-[#DCE5C5]/70 p-6 border border-[#B8C77B] space-y-4">
            <div class="flex items-start justify-between gap-2">
              <div>
                <span class="text-xs font-semibold uppercase tracking-wider text-[#3F4D22]">Suggested Selling Price</span>
                <div id="final-price-display" class="font-serif text-4xl sm:text-5xl font-bold text-[#292929] mt-1">
                  ₹1,620
                </div>
              </div>
              <button
                type="button"
                id="btn-tts-final-price"
                class="audio-btn px-3 py-2 rounded-xl text-xs font-semibold bg-white text-[#292929] border border-[#E6E4DD] hover:bg-[#FAFAF8] flex items-center gap-1 cursor-pointer"
                data-audio-text="Suggested selling price is 1620 rupees."
                aria-label="Listen to suggested price"
              >
                <span>🔊</span> <span>Listen</span>
              </button>
            </div>

            <!-- Everyday Explanation Breakdown -->
            <div class="bg-white rounded-2xl p-4 border border-[#E6E4DD] space-y-2.5 text-xs sm:text-sm">
              <div class="flex items-center justify-between">
                <span class="text-[#5C5C57]">Material Cost</span>
                <span id="formula-mat-display" class="font-semibold text-[#292929]">₹300</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-[#5C5C57]">Labour Cost (<span id="formula-labor-subtext">10 hrs × ₹90/hr</span>)</span>
                <span id="formula-labor-display" class="font-semibold text-[#292929]">₹900</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-[#5C5C57]">Packaging & Other Expenses</span>
                <span id="formula-expenses-display" class="font-semibold text-[#292929]">₹150</span>
              </div>
              <div class="flex items-center justify-between pt-2 border-t border-[#E6E4DD] font-semibold">
                <span class="text-[#292929]">Total Production Cost</span>
                <span id="formula-total-cost-display" class="text-[#292929]">₹1,350</span>
              </div>
              <div class="flex items-center justify-between text-[#3F4D22] font-semibold">
                <span>Profit Amount (<span id="formula-margin-pct">20%</span>)</span>
                <span id="formula-profit-display">+ ₹270</span>
              </div>
            </div>

            <!-- Artisan Final Price Override -->
            <div class="bg-white rounded-2xl p-4 border border-[#E6E4DD] space-y-2">
              <div class="flex items-center justify-between">
                <label for="final-manual-price-input" class="text-xs font-semibold text-[#292929]">
                  Adjust Final Selling Price (₹)
                </label>
                <button type="button" id="btn-reset-suggested-price" class="text-[11px] font-semibold text-[#3F4D22] hover:underline cursor-pointer">
                  Use suggested
                </button>
              </div>
              <div class="relative">
                <span class="absolute left-3.5 top-3 text-[#5C5C57] font-bold">₹</span>
                <input
                  type="number"
                  id="final-manual-price-input"
                  min="1"
                  step="1"
                  value="1620"
                  class="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-[#E6E4DD] bg-[#FAFAF8] font-serif text-lg font-bold text-[#292929]"
                />
              </div>
              <p class="text-[11px] text-[#5C5C57] leading-relaxed">
                Formula: <strong>(Materials + Labour + Packaging + Other Expenses) × (1 + Profit% / 100)</strong>. This is a transparent guide based only on your numbers — you decide the final price.
              </p>
            </div>
          </div>

          <!-- Optional Payment Journey Timeline -->
          <details class="bg-white rounded-2xl p-5 border border-[#E6E4DD]">
            <summary class="flex items-center justify-between cursor-pointer font-serif font-bold text-sm text-[#292929]">
              <span>View Craft Sale Steps (Optional)</span>
              <svg class="details-chevron w-4 h-4 text-[#5C5C57] transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </summary>
            <div id="milestone-timeline-container" class="pt-4">
              ${defaultTimelineHTML}
            </div>
          </details>

        </div>
      </form>
    </div>
  `;
}

export class MaterialPricingWizardController {
  private syncManager: OfflineSyncManager;
  private audioAssistant: VillageAudioAssistant;
  private supabaseService: SupabaseArtisanService;

  private benchmarks: Record<string, number> = { ...INTERNAL_MATERIAL_BENCHMARKS };
  private activeArtisanId = "artisan-1";
  private labourMode: "hours" | "direct" = "hours";
  private manualFinalPriceEdited = false;
  private lastSummary: FairPriceSummary = calculateFairPriceSummary({
    materialCost: 300,
    labourCost: 900,
    packagingCost: 80,
    otherExpenses: 70,
    profitMarginPercent: 20,
  });

  constructor() {
    this.audioAssistant = new VillageAudioAssistant();
    this.supabaseService = new SupabaseArtisanService();

    this.syncManager = new OfflineSyncManager(
      "/api/sync/products",
      (isOnline, queuedCount) => this.handleNetworkStatusChange(isOnline, queuedCount)
    );
  }

  public async init(containerElement: HTMLElement): Promise<void> {
    containerElement.innerHTML = renderMaterialPricingWizardHTML();
    await this.hydrateMaterialBenchmarks();
    this.audioAssistant.attachToAllButtons(containerElement);
    this.bindFormEvents();
    this.bindSyncBannerEvents();
    this.recalculatePricing();
    this.refreshProductOptions();

    window.addEventListener("artisan-products-updated", () => this.refreshProductOptions());
  }

  public refreshProductOptions(): void {
    const selectEl = document.getElementById("pricing-target-product") as HTMLSelectElement | null;
    const applyBtn = document.getElementById("btn-apply-price-to-product");
    if (!selectEl) return;

    const currentVal = selectEl.value;
    let myProducts: Array<{ id: string; title: string; finalPrice: number }> = [];
    try {
      const detail = (window as any).__artisanGetMyProducts?.();
      if (Array.isArray(detail)) myProducts = detail;
    } catch {
      myProducts = [];
    }

    selectEl.innerHTML = `<option value="">-- Just calculate or create a new product below --</option>` +
      myProducts.map(p => `<option value="${p.id}">${p.title} (Current: ₹${Number(p.finalPrice).toLocaleString("en-IN")})</option>`).join("");

    if (currentVal && myProducts.some(p => p.id === currentVal)) {
      selectEl.value = currentVal;
    }
    if (applyBtn) {
      applyBtn.classList.toggle("hidden", !selectEl.value);
    }
  }

  private async hydrateMaterialBenchmarks(): Promise<void> {
    try {
      const records = await this.supabaseService.fetchMaterialBenchmarks();
      if (records && records.length > 0) {
        this.benchmarks = {};
        records.forEach((b) => {
          this.benchmarks[b.material_name] = Number(b.average_cost);
        });
      }
    } catch {
      // keep local benchmarks
    }
  }

  private bindFormEvents(): void {
    const costInput = document.getElementById("material-cost-input") as HTMLInputElement | null;
    const hoursInput = document.getElementById("labor-hours-input") as HTMLInputElement | null;
    const wageInput = document.getElementById("hourly-wage-input") as HTMLInputElement | null;
    const directLabourInput = document.getElementById("direct-labour-cost-input") as HTMLInputElement | null;
    const packagingInput = document.getElementById("packaging-cost-input") as HTMLInputElement | null;
    const otherInput = document.getElementById("other-expenses-input") as HTMLInputElement | null;
    const marginSlider = document.getElementById("profit-margin-slider") as HTMLInputElement | null;
    const marginInput = document.getElementById("profit-margin-input") as HTMLInputElement | null;
    const finalManualInput = document.getElementById("final-manual-price-input") as HTMLInputElement | null;
    const resetSuggestedBtn = document.getElementById("btn-reset-suggested-price");
    const productSelect = document.getElementById("pricing-target-product") as HTMLSelectElement | null;
    const applyPriceBtn = document.getElementById("btn-apply-price-to-product");
    const btnModeHours = document.getElementById("labour-mode-hours");
    const btnModeDirect = document.getElementById("labour-mode-direct");
    const hoursPanel = document.getElementById("labour-hours-panel");
    const directPanel = document.getElementById("labour-direct-panel");
    const form = document.getElementById("craft-pricing-form") as HTMLFormElement | null;

    btnModeHours?.addEventListener("click", () => {
      this.labourMode = "hours";
      hoursPanel?.classList.remove("hidden");
      directPanel?.classList.add("hidden");
      btnModeHours.className = "px-3 py-1 rounded-lg bg-[#B8C77B] text-[#292929] font-semibold cursor-pointer";
      if (btnModeDirect) btnModeDirect.className = "px-3 py-1 rounded-lg text-[#5C5C57] font-medium cursor-pointer";
      this.recalculatePricing();
    });

    btnModeDirect?.addEventListener("click", () => {
      this.labourMode = "direct";
      directPanel?.classList.remove("hidden");
      hoursPanel?.classList.add("hidden");
      if (btnModeDirect) btnModeDirect.className = "px-3 py-1 rounded-lg bg-[#B8C77B] text-[#292929] font-semibold cursor-pointer";
      if (btnModeHours) btnModeHours.className = "px-3 py-1 rounded-lg text-[#5C5C57] font-medium cursor-pointer";
      this.recalculatePricing();
    });

    marginSlider?.addEventListener("input", () => {
      if (marginInput) marginInput.value = marginSlider.value;
      this.recalculatePricing();
    });

    marginInput?.addEventListener("input", () => {
      if (marginSlider) marginSlider.value = String(Math.min(100, Math.max(0, Number(marginInput.value) || 0)));
      this.recalculatePricing();
    });

    [costInput, hoursInput, wageInput, directLabourInput, packagingInput, otherInput].forEach((el) => {
      el?.addEventListener("input", () => this.recalculatePricing());
    });

    finalManualInput?.addEventListener("input", () => {
      this.manualFinalPriceEdited = true;
    });

    resetSuggestedBtn?.addEventListener("click", () => {
      this.manualFinalPriceEdited = false;
      if (finalManualInput) {
        finalManualInput.value = String(this.lastSummary.suggestedSellingPrice);
      }
      this.notifyUser("Reset to suggested selling price.", "info");
    });

    productSelect?.addEventListener("change", () => {
      applyPriceBtn?.classList.toggle("hidden", !productSelect.value);
    });

    applyPriceBtn?.addEventListener("click", async () => {
      await this.applyPriceToSelectedProduct();
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.handleFormSubmit();
    });
  }

  private getComputedLabourCost(): { labourCost: number; subtext: string } {
    if (this.labourMode === "direct") {
      const directEl = document.getElementById("direct-labour-cost-input") as HTMLInputElement | null;
      const val = Math.max(0, Number(directEl?.value) || 0);
      return { labourCost: val, subtext: "Direct amount" };
    }
    const hoursEl = document.getElementById("labor-hours-input") as HTMLInputElement | null;
    const wageEl = document.getElementById("hourly-wage-input") as HTMLInputElement | null;
    const hours = Math.max(0, Number(hoursEl?.value) || 0);
    const wage = Math.max(0, Number(wageEl?.value) || 0);
    return { labourCost: Math.round(hours * wage), subtext: `${hours} hrs × ₹${wage}/hr` };
  }

  private recalculatePricing(): void {
    const costInput = document.getElementById("material-cost-input") as HTMLInputElement | null;
    const packagingInput = document.getElementById("packaging-cost-input") as HTMLInputElement | null;
    const otherInput = document.getElementById("other-expenses-input") as HTMLInputElement | null;
    const marginInput = document.getElementById("profit-margin-input") as HTMLInputElement | null;
    const finalManualInput = document.getElementById("final-manual-price-input") as HTMLInputElement | null;

    const { labourCost, subtext } = this.getComputedLabourCost();

    const summary = calculateFairPriceSummary({
      materialCost: Number(costInput?.value) || 0,
      labourCost,
      packagingCost: Number(packagingInput?.value) || 0,
      otherExpenses: Number(otherInput?.value) || 0,
      profitMarginPercent: Number(marginInput?.value) || 0,
    });
    this.lastSummary = summary;

    const setEl = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setEl("formula-mat-display", `₹${summary.materialCost.toLocaleString("en-IN")}`);
    setEl("formula-labor-display", `₹${summary.labourCost.toLocaleString("en-IN")}`);
    setEl("formula-labor-subtext", subtext);
    setEl("formula-expenses-display", `₹${summary.otherAndPackagingTotal.toLocaleString("en-IN")}`);
    setEl("formula-total-cost-display", `₹${summary.totalProductionCost.toLocaleString("en-IN")}`);
    setEl("formula-margin-pct", `${summary.profitMarginPercent}%`);
    setEl("margin-preview-label", `${summary.profitMarginPercent}%`);
    setEl("formula-profit-display", `+ ₹${summary.profitAmount.toLocaleString("en-IN")}`);
    setEl("final-price-display", `₹${summary.suggestedSellingPrice.toLocaleString("en-IN")}`);

    if (finalManualInput && !this.manualFinalPriceEdited) {
      finalManualInput.value = String(summary.suggestedSellingPrice);
    }

    const ttsFinalBtn = document.getElementById("btn-tts-final-price");
    if (ttsFinalBtn) {
      ttsFinalBtn.setAttribute(
        "data-audio-text",
        `Total production cost is ${summary.totalProductionCost} rupees. Suggested selling price with ${summary.profitMarginPercent} percent profit is ${summary.suggestedSellingPrice} rupees.`
      );
    }
  }

  private getFinalChosenPrice(): number {
    const finalManualInput = document.getElementById("final-manual-price-input") as HTMLInputElement | null;
    const manualVal = Number(finalManualInput?.value);
    if (!isNaN(manualVal) && manualVal > 0) {
      return Math.round(manualVal);
    }
    return Math.max(1, this.lastSummary.suggestedSellingPrice);
  }

  private async applyPriceToSelectedProduct(): Promise<void> {
    const productSelect = document.getElementById("pricing-target-product") as HTMLSelectElement | null;
    const productId = productSelect?.value;
    if (!productId) {
      this.notifyUser("Please pick one of your products first.", "warning");
      return;
    }

    const finalPrice = this.getFinalChosenPrice();
    const hoursEl = document.getElementById("labor-hours-input") as HTMLInputElement | null;
    const wageEl = document.getElementById("hourly-wage-input") as HTMLInputElement | null;
    const token = localStorage.getItem("artisan_auth_token_v1");

    const updates = {
      materialCost: this.lastSummary.materialCost,
      laborHours: Number(hoursEl?.value) || 0,
      hourlyRate: Number(wageEl?.value) || 0,
      packagingCost: this.lastSummary.packagingCost,
      overheadCost: this.lastSummary.otherExpenses,
      profitMarginPercent: this.lastSummary.profitMarginPercent,
      finalPrice,
    };

    try {
      await fetch(`/api/products/${encodeURIComponent(productId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updates),
      });
    } catch {
      // local state listener below keeps UI synced
    }

    window.dispatchEvent(
      new CustomEvent("artisan-price-applied", { detail: { productId, updates } })
    );
    this.notifyUser(`Updated product price to ₹${finalPrice.toLocaleString("en-IN")}!`, "success");
    this.refreshProductOptions();
  }

  private notifyUser(message: string, type: "success" | "warning" | "error" | "info" = "info"): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("artisan-toast", { detail: { message, type } }));
    }
  }

  private async handleFormSubmit(): Promise<void> {
    const nameInput = document.getElementById("product-name-input") as HTMLInputElement | null;
    const materialSelect = document.getElementById("material-catalog-select") as HTMLSelectElement | null;
    const hoursInput = document.getElementById("labor-hours-input") as HTMLInputElement | null;
    const wageInput = document.getElementById("hourly-wage-input") as HTMLInputElement | null;

    const productName = nameInput?.value.trim() || "";
    if (!productName) {
      this.notifyUser("Enter a new product name, or choose an existing product above to update its price.", "warning");
      nameInput?.focus();
      return;
    }

    const chosenPrice = this.getFinalChosenPrice();
    const payload: ProductListingPayload = {
      artisan_id: (window as any).__artisanGetCurrentId?.() || this.activeArtisanId,
      product_name: productName,
      material_type: materialSelect?.value || "Clay",
      custom_material_cost: this.lastSummary.materialCost,
      labor_hours: this.labourMode === "hours" ? Number(hoursInput?.value) || 0 : 0,
      hourly_rate: this.labourMode === "hours" ? Number(wageInput?.value) || 0 : 0,
      calculated_price: chosenPrice,
      price_override_percent: this.lastSummary.profitMarginPercent,
      status: "listed",
      image_url: "./assets/artisan_logo.jpg",
    };

    const result = await this.syncManager.submitListing(payload);
    if (result.success) {
      this.notifyUser(
        result.isOffline
          ? "Saved safely on this device. Will sync when online."
          : `"${productName}" listed at ₹${chosenPrice.toLocaleString("en-IN")}.`,
        "success"
      );
      this.setTimelineStatus("listed");
      nameInput.value = "";
      window.dispatchEvent(new CustomEvent("artisan-refresh-products"));
    } else {
      this.notifyUser(result.message || "Could not save right now. Please try again.", "error");
    }
  }

  public setTimelineStatus(status: MilestoneStatus): void {
    const container = document.getElementById("milestone-timeline-container");
    if (container) {
      container.innerHTML = renderFinancialTimelineHTML(status);
      this.audioAssistant.attachToAllButtons(container);
    }
  }

  private handleNetworkStatusChange(isOnline: boolean, queuedCount: number): void {
    const banner = document.getElementById("sync-status-banner");
    const indicator = document.getElementById("sync-status-indicator");
    const text = document.getElementById("sync-status-text");
    const badge = document.getElementById("offline-queue-badge");
    const syncBtn = document.getElementById("btn-force-sync");

    if (!banner || !indicator || !text) return;

    if (isOnline) {
      indicator.className = "w-2.5 h-2.5 rounded-full bg-[#3F4D22] pulse-subtle";
      text.textContent = queuedCount > 0 ? `Online • Syncing ${queuedCount} item(s)...` : "Saved & Ready";
      banner.className = "rounded-xl px-3.5 py-2 bg-[#DCE5C5] border border-[#B8C77B] flex items-center gap-2.5 text-xs self-start sm:self-auto";
    } else {
      indicator.className = "w-2.5 h-2.5 rounded-full bg-[#292929] animate-pulse";
      text.textContent = "Offline • Saving on device";
      banner.className = "rounded-xl px-3.5 py-2 bg-[#EBC5A9] border border-[#E6E4DD] flex items-center gap-2.5 text-xs self-start sm:self-auto";
    }

    if (badge) {
      badge.classList.toggle("hidden", queuedCount === 0);
      badge.textContent = `${queuedCount} Saved`;
    }
    if (syncBtn) {
      syncBtn.classList.toggle("hidden", !(isOnline && queuedCount > 0));
    }
  }

  private bindSyncBannerEvents(): void {
    const syncBtn = document.getElementById("btn-force-sync");
    syncBtn?.addEventListener("click", async () => {
      syncBtn.textContent = "Syncing...";
      await this.syncManager.flushQueue();
      syncBtn.textContent = "Sync Now";
    });
  }
}
