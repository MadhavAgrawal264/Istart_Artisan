/**
 * ARTISAN MARKETPLACE: MATERIAL PRICING & ACCESSIBILITY WIZARD
 * File: src/components/material-pricing-wizard.ts
 * 
 * Orchestrates:
 * 1. Offline-First Material & Cost Validation (IndexedDB + +/-30% Warning Modal)
 * 2. AI Pricing Transparency & Override Simulator (+/- 25% capped slider + Health Meter)
 * 3. Village Trust Linear Milestone Timeline & Web Speech Audio Narrator
 * 4. Supabase Dynamic Hydration & Batch Synchronization
 */

import { ProductListingPayload, MilestoneStatus } from "../types/artisan.ts";
import { OfflineSyncManager } from "../services/storage.ts";
import { validateMaterialCost, CostWarningModalController, INTERNAL_MATERIAL_BENCHMARKS } from "../services/validation.ts";
import { calculatePricingBreakdown, evaluateSaleLikelihood } from "../services/pricing.ts";
import { VillageAudioAssistant } from "../services/accessibility.ts";
import { SupabaseArtisanService } from "../services/supabase.ts";
import { renderFinancialTimelineHTML } from "./milestone-timeline.ts";

/**
 * Generates the accessible HTML5/CSS3 template for the entire modular suite.
 */
export function renderMaterialPricingWizardHTML(): string {
  const defaultTimelineHTML = renderFinancialTimelineHTML("listed");

  return `
    <div id="artisan-pricing-suite" class="max-w-5xl mx-auto space-y-6 font-sans">

      <!-- Page Header & Sync Pill -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="font-serif text-2xl sm:text-3xl font-bold text-[#292929]">Fair Pricing Calculator</h1>
          <p class="text-xs sm:text-sm text-[#5C5C57] mt-1">Enter your material cost and hours worked to find a fair selling price.</p>
        </div>

        <div id="sync-status-banner" class="rounded-xl px-3.5 py-2 bg-[#DCE5C5] border border-[#B8C77B] flex items-center gap-2.5 text-xs">
          <span id="sync-status-indicator" class="w-2.5 h-2.5 rounded-full bg-[#3F4D22] pulse-subtle"></span>
          <span id="sync-status-text" class="font-semibold text-[#292929]">Saved & Ready</span>
          <span id="offline-queue-badge" class="hidden px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#EBC5A9] text-[#292929]">0 Saved</span>
          <button type="button" id="btn-force-sync" class="hidden px-2.5 py-1 rounded-lg text-xs font-semibold bg-white text-[#292929] border border-[#E6E4DD] cursor-pointer">
            Sync Now
          </button>
        </div>
      </div>

      <!-- Main Form & Suggested Price Layout -->
      <form id="craft-pricing-form" class="grid grid-cols-1 lg:grid-cols-12 gap-6" novalidate>

        <!-- Left Column: Simple Everyday Inputs -->
        <div class="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-7 border border-[#E6E4DD] shadow-xs space-y-5">
          <div class="flex items-center justify-between pb-3 border-b border-[#E6E4DD]">
            <div>
              <h2 class="text-lg sm:text-xl font-bold text-[#292929] font-serif">Your Work & Material Costs</h2>
              <p class="text-xs text-[#5C5C57]">Fill in these 4 simple details in everyday numbers</p>
            </div>
            <button
              type="button"
              class="audio-btn w-9 h-9 rounded-full text-[#292929] bg-[#DCE5C5] hover:bg-[#B8C77B] flex items-center justify-center cursor-pointer"
              data-audio-text="Enter your product name, choose the main material, type how much the material cost, and how many hours you worked."
              aria-label="Listen to instructions"
              title="Listen to instructions"
            >
              🔊
            </button>
          </div>

          <!-- Product Name -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label for="product-name-input" class="text-xs sm:text-sm font-semibold text-[#292929]">
                1. What did you make?
              </label>
              <button type="button" class="audio-btn text-xs text-[#3F4D22] hover:underline font-medium cursor-pointer" data-audio-target="product-name-input">
                🔊 Listen
              </button>
            </div>
            <input
              type="text"
              id="product-name-input"
              name="product_name"
              required
              placeholder="Example: Hand-painted Clay Vase or Wooden Toy"
              class="w-full p-3.5 rounded-xl border border-[#E6E4DD] bg-[#FAFAF8] focus:bg-white focus:ring-2 focus:ring-[#B8C77B] text-sm font-medium text-[#292929]"
            />
          </div>

          <!-- Material & Material Cost -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div class="flex items-center justify-between mb-1">
                <label for="material-catalog-select" class="text-xs sm:text-sm font-semibold text-[#292929]">
                  2. Main Material Used
                </label>
                <button type="button" class="audio-btn text-xs text-[#3F4D22] hover:underline font-medium cursor-pointer" data-audio-text="Choose the main material you used, such as wood, clay, yarn, silk, or brass.">
                  🔊 Listen
                </button>
              </div>
              <select
                id="material-catalog-select"
                name="material_type"
                class="w-full p-3.5 rounded-xl border border-[#E6E4DD] bg-[#FAFAF8] focus:bg-white focus:ring-2 focus:ring-[#B8C77B] text-sm font-semibold text-[#292929] cursor-pointer"
              >
                <option value="Wood">Wood (Teak / Neem / Sheesham)</option>
                <option value="Clay">Clay (Terracotta / Pottery)</option>
                <option value="Yarn">Yarn (Khadi / Cotton)</option>
                <option value="Silk">Silk (Tussar / Mulberry)</option>
                <option value="Brass">Brass (Dhokra Metal)</option>
                <option value="Bamboo">Bamboo & Cane</option>
                <option value="Stone">Stone / Marble</option>
                <option value="Leather">Leather</option>
              </select>
              <p id="benchmark-hint-text" class="text-[11px] text-[#5C5C57] mt-1.5">
                Typical material cost: <span id="benchmark-baseline-badge" class="font-bold text-[#3F4D22]">₹450</span>
              </p>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label for="material-cost-input" class="text-xs sm:text-sm font-semibold text-[#292929]" title="How much money you spent buying raw materials">
                  3. Money Spent on Materials (₹)
                </label>
                <button type="button" class="audio-btn text-xs text-[#3F4D22] hover:underline font-medium cursor-pointer" data-audio-target="material-cost-input">
                  🔊 Listen
                </button>
              </div>
              <div class="relative">
                <span class="absolute left-3.5 top-3.5 text-[#5C5C57] font-bold">₹</span>
                <input
                  type="number"
                  id="material-cost-input"
                  name="custom_material_cost"
                  min="1"
                  step="1"
                  value="450"
                  required
                  class="w-full pl-8 pr-3.5 py-3.5 rounded-xl border border-[#E6E4DD] bg-[#FAFAF8] focus:bg-white focus:ring-2 focus:ring-[#B8C77B] text-sm font-bold text-[#292929]"
                />
              </div>
              <p class="text-[11px] text-[#5C5C57] mt-1.5">We gently alert you if this looks much higher or lower than usual.</p>
            </div>
          </div>

          <!-- Hours & Fair Hourly Pay -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#E6E4DD]">
            <div>
              <div class="flex items-center justify-between mb-1">
                <label for="labor-hours-input" class="text-xs sm:text-sm font-semibold text-[#292929]">
                  4. Hours Spent Making It
                </label>
                <button type="button" class="audio-btn text-xs text-[#3F4D22] hover:underline font-medium cursor-pointer" data-audio-target="labor-hours-input">
                  🔊 Listen
                </button>
              </div>
              <input
                type="number"
                id="labor-hours-input"
                name="labor_hours"
                min="0.5"
                step="0.5"
                value="12"
                required
                class="w-full p-3.5 rounded-xl border border-[#E6E4DD] bg-[#FAFAF8] focus:bg-white focus:ring-2 focus:ring-[#B8C77B] text-sm font-bold text-[#292929]"
              />
              <p class="text-[11px] text-[#5C5C57] mt-1.5">Total time from start to finish.</p>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label for="hourly-wage-input" class="text-xs sm:text-sm font-semibold text-[#292929]">
                  Fair Pay Per Hour (₹/hr)
                </label>
                <button type="button" class="audio-btn text-xs text-[#3F4D22] hover:underline font-medium cursor-pointer" data-audio-target="hourly-wage-input">
                  🔊 Listen
                </button>
              </div>
              <div class="relative">
                <span class="absolute left-3.5 top-3.5 text-[#5C5C57] font-bold">₹</span>
                <input
                  type="number"
                  id="hourly-wage-input"
                  name="hourly_rate"
                  min="50"
                  step="5"
                  value="90"
                  required
                  class="w-full pl-8 pr-3.5 py-3.5 rounded-xl border border-[#E6E4DD] bg-[#FAFAF8] focus:bg-white focus:ring-2 focus:ring-[#B8C77B] text-sm font-bold text-[#292929]"
                />
              </div>
              <p class="text-[11px] text-[#3F4D22] font-medium mt-1.5">Recommended fair minimum: ₹80/hr or more.</p>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="pt-4 border-t border-[#E6E4DD] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span id="offline-safe-text" class="text-xs text-[#5C5C57]">
              Works even with slow internet — saves safely on your device.
            </span>
            <button
              type="submit"
              id="btn-submit-listing"
              class="min-h-[48px] px-6 py-3 rounded-2xl bg-[#B8C77B] hover:bg-[#a6b668] text-[#292929] font-semibold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Save & Publish Product</span>
              <span>→</span>
            </button>
          </div>
        </div>

        <!-- Right Column: Prominent Suggested Selling Price + Optional Advanced Controls -->
        <div class="lg:col-span-5 space-y-5">

          <!-- Prominent Suggested Selling Price Card -->
          <div class="rounded-3xl bg-[#EBC5A9] p-6 border border-[#E6E4DD] space-y-4">
            <div class="flex items-start justify-between gap-2">
              <div>
                <span class="text-xs font-semibold uppercase tracking-wider text-[#292929]">Suggested Selling Price</span>
                <div id="final-price-display" class="font-serif text-4xl sm:text-5xl font-bold text-[#292929] mt-1">
                  ₹1,530
                </div>
              </div>
              <button
                type="button"
                id="btn-tts-final-price"
                class="audio-btn px-3 py-2 rounded-xl text-xs font-semibold bg-white text-[#292929] border border-[#E6E4DD] hover:bg-[#FAFAF8] flex items-center gap-1 cursor-pointer"
                data-audio-text="Suggested selling price is 1530 rupees."
                aria-label="Listen to suggested price"
              >
                <span>🔊</span> <span>Listen</span>
              </button>
            </div>

            <!-- Simple Plain-Language Breakdown Tiles -->
            <div class="grid grid-cols-3 gap-2.5 text-center">
              <div class="bg-white rounded-2xl p-3 border border-[#E6E4DD]">
                <div class="text-[11px] text-[#5C5C57] font-medium">Materials</div>
                <div id="formula-mat-display" class="font-serif text-base font-bold text-[#292929] mt-0.5">₹450</div>
              </div>
              <div class="bg-white rounded-2xl p-3 border border-[#E6E4DD]">
                <div class="text-[11px] text-[#5C5C57] font-medium">Your Labor</div>
                <div id="formula-labor-display" class="font-serif text-base font-bold text-[#3F4D22] mt-0.5">₹1,080</div>
              </div>
              <div class="bg-white rounded-2xl p-3 border border-[#E6E4DD]">
                <div class="text-[11px] text-[#5C5C57] font-medium">Fair Base</div>
                <div id="formula-ai-base-display" class="font-serif text-base font-bold text-[#292929] mt-0.5">₹1,530</div>
              </div>
            </div>

            <div class="text-xs text-[#292929] flex items-center justify-between pt-1">
              <span>Your time calculation:</span>
              <span id="formula-labor-subtext" class="font-semibold">12 hrs × ₹90/hr</span>
            </div>
          </div>

          <!-- Optional Advanced Price Adjustment -->
          <details class="bg-white rounded-2xl p-5 border border-[#E6E4DD] space-y-4">
            <summary class="flex items-center justify-between cursor-pointer font-serif font-bold text-sm text-[#292929]">
              <span>Adjust Price & Check Sale Chances (Optional)</span>
              <svg class="details-chevron w-4 h-4 text-[#5C5C57] transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </summary>

            <div class="pt-4 space-y-4 border-t border-[#E6E4DD]">
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label for="price-override-slider" class="text-xs font-semibold text-[#292929]">
                    Adjust Price Up or Down
                  </label>
                  <span id="slider-percent-badge" class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FAFAF8] text-[#292929] border border-[#E6E4DD]">
                    0% (Recommended)
                  </span>
                </div>
                <input
                  type="range"
                  id="price-override-slider"
                  name="price_override_slider"
                  min="-25"
                  max="25"
                  value="0"
                  step="1"
                  class="w-full h-2 bg-[#DCE5C5] rounded-lg appearance-none cursor-pointer accent-[#B8C77B]"
                  aria-label="Adjust price percentage from minus 25 percent to plus 25 percent"
                />
                <div class="flex justify-between text-[11px] text-[#5C5C57]">
                  <span>-25% (Sell Faster)</span>
                  <span>0% (Fair Price)</span>
                  <span>+25% (Higher Margin)</span>
                </div>
              </div>

              <div id="likelihood-health-card" class="rounded-xl p-3.5 bg-[#F0EFF5] border border-[#E6E4DD] space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-[#292929]">How likely buyers will buy</span>
                  <span id="likelihood-badge" class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#DCE5C5] text-[#292929]">
                    Balanced (80%)
                  </span>
                </div>
                <div class="w-full h-2.5 rounded-full bg-white overflow-hidden border border-[#E6E4DD]">
                  <div id="likelihood-gauge-bar" class="h-full bg-[#B8C77B] rounded-full transition-all duration-300" style="width: 80%;"></div>
                </div>
                <p id="likelihood-desc-text" class="text-xs text-[#5C5C57] leading-snug">
                  Recommended price: fair for you and welcoming for buyers.
                </p>
              </div>
            </div>
          </details>

          <!-- Optional Payment Journey Timeline -->
          <details class="bg-white rounded-2xl p-5 border border-[#E6E4DD]">
            <summary class="flex items-center justify-between cursor-pointer font-serif font-bold text-sm text-[#292929]">
              <span>View Payment Steps (Optional)</span>
              <svg class="details-chevron w-4 h-4 text-[#5C5C57] transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </summary>
            <div id="milestone-timeline-container" class="pt-4">
              ${defaultTimelineHTML}
            </div>
          </details>

        </div>
      </form>

      <!-- Material Cost Deviation Warning Modal -->
      <div
        id="cost-deviation-modal"
        class="hidden fixed inset-0 z-50 bg-[#292929]/55 backdrop-blur-xs flex items-center justify-center p-4"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="modal-deviation-title"
        aria-describedby="modal-deviation-desc"
        aria-hidden="true"
      >
        <div class="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-xl border border-[#E6E4DD] space-y-5 text-left">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-xl bg-[#EBC5A9] flex items-center justify-center text-xl flex-shrink-0">
                ⚠️
              </div>
              <div>
                <h3 id="modal-deviation-title" data-modal-title class="text-base font-bold text-[#292929] font-serif">
                  Check Material Cost
                </h3>
                <span data-modal-badge class="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EBC5A9] text-[#292929]">
                  Higher than usual
                </span>
              </div>
            </div>

            <button
              type="button"
              class="audio-btn p-1.5 rounded-full text-[#5C5C57] hover:text-[#292929] hover:bg-[#FAFAF8] cursor-pointer"
              data-audio-text="Please check your material cost. The amount you entered is quite different from the usual rate."
              aria-label="Listen to warning"
            >
              🔊
            </button>
          </div>

          <p id="modal-deviation-desc" data-modal-desc class="text-xs sm:text-sm text-[#5C5C57] leading-relaxed">
            The material cost you entered looks different from the typical rate. You can keep your number or use the typical rate.
          </p>

          <div class="p-3.5 rounded-2xl bg-[#FAFAF8] border border-[#E6E4DD] grid grid-cols-2 gap-3 text-center text-xs">
            <div>
              <span class="text-[11px] text-[#5C5C57] font-medium">Usual Rate</span>
              <div data-modal-baseline class="text-base font-bold text-[#292929]">₹450</div>
            </div>
            <div>
              <span class="text-[11px] text-[#5C5C57] font-medium">You Entered</span>
              <div data-modal-entered class="text-base font-bold text-[#292929]">₹680</div>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-3 pt-1">
            <button type="button" id="modal-btn-adjust" data-modal-cancel class="flex-1 py-3 px-4 rounded-xl bg-[#FAFAF8] hover:bg-[#DCE5C5] text-[#292929] font-semibold text-xs border border-[#E6E4DD] cursor-pointer">
              Use Usual Rate
            </button>
            <button type="button" id="modal-btn-override" data-modal-confirm class="flex-1 py-3 px-4 rounded-xl bg-[#B8C77B] hover:bg-[#a6b668] text-[#292929] font-semibold text-xs cursor-pointer">
              Keep My Amount
            </button>
          </div>
        </div>
      </div>

    </div>
  `;
}

/**
 * Controller class that binds UI elements, event listeners, services, and accessibility hooks.
 */
export class MaterialPricingWizardController {
  private syncManager: OfflineSyncManager;
  private audioAssistant: VillageAudioAssistant;
  private modalController: CostWarningModalController;
  private supabaseService: SupabaseArtisanService;

  private benchmarks: Record<string, number> = { ...INTERNAL_MATERIAL_BENCHMARKS };
  private activeArtisanId = "a0000000-0000-0000-0000-000000000001"; // Master Sitadevi default
  private currentStatus: MilestoneStatus = "listed";

  constructor() {
    this.audioAssistant = new VillageAudioAssistant();
    this.modalController = new CostWarningModalController("cost-deviation-modal");
    this.supabaseService = new SupabaseArtisanService();

    this.syncManager = new OfflineSyncManager(
      "/api/sync/products",
      (isOnline, queuedCount) => this.handleNetworkStatusChange(isOnline, queuedCount)
    );
  }

  /**
   * Initializes the entire interactive controller.
   */
  public async init(containerElement: HTMLElement): Promise<void> {
    // 1. Render layout
    containerElement.innerHTML = renderMaterialPricingWizardHTML();

    // 2. Hydrate benchmarks from Supabase with graceful fallback
    await this.hydrateMaterialBenchmarks();

    // 3. Attach speech assistant to floating speaker buttons
    this.audioAssistant.attachToAllButtons(containerElement);

    // 4. Bind interactive inputs and events
    this.bindFormEvents();
    this.bindModalEvents();
    this.bindSyncBannerEvents();

    // 5. Initial calculation pass
    this.recalculatePricing();
  }

  /**
   * Hydrates material dropdown and internal memory with Supabase records.
   */
  private async hydrateMaterialBenchmarks(): Promise<void> {
    try {
      const records = await this.supabaseService.fetchMaterialBenchmarks();
      const selectEl = document.getElementById("material-catalog-select") as HTMLSelectElement | null;

      if (records && records.length > 0) {
        this.benchmarks = {};
        if (selectEl) {
          selectEl.innerHTML = "";
        }

        records.forEach((b) => {
          this.benchmarks[b.material_name] = Number(b.average_cost);
          if (selectEl) {
            const opt = document.createElement("option");
            opt.value = b.material_name;
            opt.textContent = `${b.material_name} (Benchmark: ₹${b.average_cost})`;
            selectEl.appendChild(opt);
          }
        });
      }

      this.updateBenchmarkHint();
    } catch (err) {
      console.warn("[Wizard] Using local fallback benchmarks:", err);
    }
  }

  /**
   * Binds form controls (Material Select, Cost Input, Labor Hours, Hourly Wage, Range Slider).
   */
  private bindFormEvents(): void {
    const materialSelect = document.getElementById("material-catalog-select") as HTMLSelectElement | null;
    const costInput = document.getElementById("material-cost-input") as HTMLInputElement | null;
    const hoursInput = document.getElementById("labor-hours-input") as HTMLInputElement | null;
    const wageInput = document.getElementById("hourly-wage-input") as HTMLInputElement | null;
    const slider = document.getElementById("price-override-slider") as HTMLInputElement | null;
    const form = document.getElementById("craft-pricing-form") as HTMLFormElement | null;

    // A. Material selection change -> update baseline hint & reset entered cost to benchmark
    materialSelect?.addEventListener("change", () => {
      this.updateBenchmarkHint();
      const currentMat = materialSelect.value;
      const benchmarkRate = this.benchmarks[currentMat] || 250;
      if (costInput) {
        costInput.value = String(benchmarkRate);
      }
      this.recalculatePricing();
    });

    // B. Cost input change/blur -> Trigger +/- 30% deviation warning modal
    costInput?.addEventListener("blur", () => {
      this.checkMaterialCostDeviation();
    });

    costInput?.addEventListener("input", () => {
      this.recalculatePricing();
    });

    // C. Hours & Wage input
    hoursInput?.addEventListener("input", () => this.recalculatePricing());
    wageInput?.addEventListener("input", () => this.recalculatePricing());

    // D. Range Slider -> scale final price by capped margin of +/- 25% and update Likelihood meter
    slider?.addEventListener("input", () => {
      this.recalculatePricing();
    });

    // E. Form submission with offline interception & validation
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.handleFormSubmit();
    });
  }

  /**
   * Evaluates cost deviation against the baseline rate and pops the modal if > 30%.
   */
  private checkMaterialCostDeviation(): void {
    const materialSelect = document.getElementById("material-catalog-select") as HTMLSelectElement | null;
    const costInput = document.getElementById("material-cost-input") as HTMLInputElement | null;

    if (!materialSelect || !costInput) return;

    const material = materialSelect.value;
    const enteredCost = Number(costInput.value) || 0;

    const result = validateMaterialCost(material, enteredCost, this.benchmarks);

    if (result.isOutlier) {
      // Trigger accessible modal with voice readout support
      this.modalController.showWarning(
        result,
        // On Confirm (Keep My Custom Cost)
        () => {
          console.info("[Validation] Artisan chose to override benchmark with custom cost:", enteredCost);
          this.recalculatePricing();
        },
        // On Cancel (Adjust to Benchmark)
        () => {
          costInput.value = String(result.baselineCost);
          this.recalculatePricing();
          costInput.focus();
        }
      );
    }
  }

  /**
   * Binds modal buttons (Adjust vs Keep My Custom Cost).
   */
  private bindModalEvents(): void {
    const adjustBtn = document.getElementById("modal-btn-adjust");
    const overrideBtn = document.getElementById("modal-btn-override");

    adjustBtn?.addEventListener("click", () => this.modalController.handleCancel());
    overrideBtn?.addEventListener("click", () => this.modalController.handleConfirm());
  }

  /**
   * Updates benchmark baseline display badge.
   */
  private updateBenchmarkHint(): void {
    const materialSelect = document.getElementById("material-catalog-select") as HTMLSelectElement | null;
    const baselineBadge = document.getElementById("benchmark-baseline-badge");
    if (!materialSelect || !baselineBadge) return;

    const mat = materialSelect.value;
    const cost = this.benchmarks[mat] ?? 450;
    baselineBadge.textContent = `₹${cost}`;
  }

  /**
   * Recalculates formula breakdown, slider override, and Likelihood of Sale health meter.
   */
  private recalculatePricing(): void {
    const costInput = document.getElementById("material-cost-input") as HTMLInputElement | null;
    const hoursInput = document.getElementById("labor-hours-input") as HTMLInputElement | null;
    const wageInput = document.getElementById("hourly-wage-input") as HTMLInputElement | null;
    const slider = document.getElementById("price-override-slider") as HTMLInputElement | null;

    const matCost = Number(costInput?.value) || 0;
    const hours = Number(hoursInput?.value) || 0;
    const wage = Number(wageInput?.value) || 0;
    const overridePercent = Number(slider?.value) || 0;

    // Execute pricing breakdown calculation
    const breakdown = calculatePricingBreakdown(matCost, hours, wage, overridePercent);

    // Update Equation DOM elements
    const matDisp = document.getElementById("formula-mat-display");
    const laborDisp = document.getElementById("formula-labor-display");
    const aiBaseDisp = document.getElementById("formula-ai-base-display");
    const subtextDisp = document.getElementById("formula-labor-subtext");
    const finalPriceDisp = document.getElementById("final-price-display");
    const sliderBadge = document.getElementById("slider-percent-badge");
    const ttsFinalBtn = document.getElementById("btn-tts-final-price");

    if (matDisp) matDisp.textContent = `₹${breakdown.materialCost}`;
    if (laborDisp) laborDisp.textContent = `₹${breakdown.laborTotal}`;
    if (aiBaseDisp) aiBaseDisp.textContent = `₹${breakdown.aiBasePrice}`;
    if (subtextDisp) subtextDisp.textContent = `${breakdown.laborHours} hrs × ₹${breakdown.hourlyRate}/hr`;
    if (finalPriceDisp) finalPriceDisp.textContent = `₹${breakdown.finalAdjustedPrice}`;

    if (sliderBadge) {
      const sign = breakdown.overridePercent > 0 ? "+" : "";
      sliderBadge.textContent = breakdown.overridePercent === 0
        ? "0% (Recommended)"
        : `${sign}${breakdown.overridePercent}% Adjusted`;
      sliderBadge.className = breakdown.overridePercent > 0
        ? "px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EBC5A9] text-[#292929] border border-[#E6E4DD]"
        : breakdown.overridePercent < 0
        ? "px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCE5C5] text-[#292929] border border-[#B8C77B]"
        : "px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FAFAF8] text-[#292929] border border-[#E6E4DD]";
    }

    if (ttsFinalBtn) {
      ttsFinalBtn.setAttribute(
        "data-audio-text",
        `Suggested selling price is ${breakdown.finalAdjustedPrice} rupees.`
      );
    }

    // Evaluate & update Likelihood of Sale Health Meter
    const likelihood = evaluateSaleLikelihood(breakdown.overridePercent);
    const likelihoodBadge = document.getElementById("likelihood-badge");
    const likelihoodBar = document.getElementById("likelihood-gauge-bar");
    const likelihoodDesc = document.getElementById("likelihood-desc-text");

    if (likelihoodBadge) {
      likelihoodBadge.textContent = `${likelihood.state} (${likelihood.scorePercent}%)`;
      likelihoodBadge.className = likelihood.state === "High"
        ? "px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCE5C5] text-[#292929]"
        : likelihood.state === "Balanced"
        ? "px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#B8C77B] text-[#292929]"
        : "px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EBC5A9] text-[#292929]";
    }

    if (likelihoodBar) {
      likelihoodBar.style.width = `${likelihood.scorePercent}%`;
      likelihoodBar.className = likelihood.state === "High"
        ? "h-full bg-[#B8C77B] rounded-full transition-all duration-300"
        : likelihood.state === "Balanced"
        ? "h-full bg-[#3F4D22] rounded-full transition-all duration-300"
        : "h-full bg-[#EBC5A9] rounded-full transition-all duration-300";
    }

    if (likelihoodDesc) {
      likelihoodDesc.textContent = likelihood.description;
    }
  }

  private notifyUser(message: string, type: "success" | "warning" | "error" | "info" = "info"): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("artisan-toast", { detail: { message, type } }));
    }
  }

  /**
   * Handles listing form submission: validates, constructs payload, intercepts if offline.
   */
  private async handleFormSubmit(): Promise<void> {
    const nameInput = document.getElementById("product-name-input") as HTMLInputElement | null;
    const materialSelect = document.getElementById("material-catalog-select") as HTMLSelectElement | null;
    const costInput = document.getElementById("material-cost-input") as HTMLInputElement | null;
    const hoursInput = document.getElementById("labor-hours-input") as HTMLInputElement | null;
    const wageInput = document.getElementById("hourly-wage-input") as HTMLInputElement | null;
    const slider = document.getElementById("price-override-slider") as HTMLInputElement | null;

    const productName = nameInput?.value.trim() || "";
    if (!productName) {
      this.notifyUser("Please enter what you made before saving.", "warning");
      nameInput?.focus();
      return;
    }

    const materialType = materialSelect?.value || "Wood";
    const customCost = Number(costInput?.value) || 0;
    const laborHours = Number(hoursInput?.value) || 0;
    const hourlyRate = Number(wageInput?.value) || 0;
    const overridePercent = Number(slider?.value) || 0;

    const breakdown = calculatePricingBreakdown(customCost, laborHours, hourlyRate, overridePercent);

    const payload: ProductListingPayload = {
      artisan_id: this.activeArtisanId,
      product_name: productName,
      material_type: materialType,
      custom_material_cost: customCost,
      labor_hours: laborHours,
      hourly_rate: hourlyRate,
      calculated_price: breakdown.finalAdjustedPrice,
      price_override_percent: breakdown.overridePercent,
      status: "listed",
      image_url: "./assets/artisan_logo.jpg",
    };

    // Submit via OfflineSyncManager (IndexedDB cache if offline, or Fetch if online)
    const result = await this.syncManager.submitListing(payload);

    if (result.success) {
      this.audioAssistant.speak(
        result.isOffline
          ? "Saved safely on your device. It will sync automatically when your network returns."
          : "Success! Your product and fair price have been saved."
      );

      this.notifyUser(
        result.isOffline
          ? "Saved safely on this device. Will sync when online."
          : `"${productName}" saved with fair price ₹${breakdown.finalAdjustedPrice.toLocaleString("en-IN")}.`,
        "success"
      );

      this.setTimelineStatus("listed");
      nameInput.value = "";
    } else {
      this.notifyUser(result.message || "Could not save right now. Please try again.", "error");
    }
  }

  /**
   * Sets and renders updated timeline status.
   */
  public setTimelineStatus(status: MilestoneStatus): void {
    this.currentStatus = status;
    const container = document.getElementById("milestone-timeline-container");
    if (container) {
      container.innerHTML = renderFinancialTimelineHTML(status);
      this.audioAssistant.attachToAllButtons(container);
    }
  }

  /**
   * Network status handler callback from OfflineSyncManager.
   */
  private handleNetworkStatusChange(isOnline: boolean, queuedCount: number): void {
    const banner = document.getElementById("sync-status-banner");
    const indicator = document.getElementById("sync-status-indicator");
    const text = document.getElementById("sync-status-text");
    const badge = document.getElementById("offline-queue-badge");
    const syncBtn = document.getElementById("btn-force-sync");

    if (!banner || !indicator || !text) return;

    if (isOnline) {
      indicator.className = "w-2.5 h-2.5 rounded-full bg-[#3F4D22] pulse-subtle";
      text.textContent = queuedCount > 0
        ? `Online • Syncing ${queuedCount} saved item(s)...`
        : "Saved & Ready";
      banner.className = "rounded-xl px-3.5 py-2 bg-[#DCE5C5] border border-[#B8C77B] flex items-center gap-2.5 text-xs";
    } else {
      indicator.className = "w-2.5 h-2.5 rounded-full bg-[#292929] animate-pulse";
      text.textContent = "Offline • Saving safely on device";
      banner.className = "rounded-xl px-3.5 py-2 bg-[#EBC5A9] border border-[#E6E4DD] flex items-center gap-2.5 text-xs";
    }

    if (badge) {
      if (queuedCount > 0) {
        badge.classList.remove("hidden");
        badge.textContent = `${queuedCount} Saved`;
      } else {
        badge.classList.add("hidden");
      }
    }

    if (syncBtn) {
      if (isOnline && queuedCount > 0) {
        syncBtn.classList.remove("hidden");
      } else {
        syncBtn.classList.add("hidden");
      }
    }
  }

  /**
   * Binds manual sync trigger button.
   */
  private bindSyncBannerEvents(): void {
    const syncBtn = document.getElementById("btn-force-sync");
    syncBtn?.addEventListener("click", async () => {
      syncBtn.textContent = "Syncing...";
      await this.syncManager.flushQueue();
      syncBtn.textContent = "🔄 Sync Now";
    });
  }
}
