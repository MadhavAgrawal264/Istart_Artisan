/**
 * ARTISAN MARKETPLACE: VILLAGE TRUST MILESTONE TIMELINE
 * File: src/components/milestone-timeline.ts
 * 
 * Renders a step-by-step linear visual milestone timeline tracking financial movement:
 * Item Listed -> Item Sold -> Processing -> In Bank Account
 * 
 * Features high-contrast indicators, large accessible SVG icons,
 * and ARIA attributes for village trust building.
 */

import { MilestoneStatus, TimelineStepDefinition } from "../types/artisan.ts";

/**
 * Visual SVG Icons with 24x24 viewBox and bold high-contrast strokes.
 */
const ICONS = {
  // Step 1: Craft Listed
  listed: `
    <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
      <line x1="7" y1="7" x2="7.01" y2="7"></line>
    </svg>
  `,
  // Step 2: Item Sold & Escrow Locked
  sold: `
    <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1"></circle>
      <circle cx="20" cy="21" r="1"></circle>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
      <polyline points="9 11 12 14 22 4"></polyline>
    </svg>
  `,
  // Step 3: Packing & Collective Verification
  processing: `
    <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
  `,
  // Step 4: Funds in Artisan Bank Account
  in_bank_account: `
    <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="3" y1="21" x2="21" y2="21"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
      <polyline points="5 6 12 2 19 6"></polyline>
      <line x1="4" y1="10" x2="4" y2="21"></line>
      <line x1="9" y1="10" x2="9" y2="21"></line>
      <line x1="15" y1="10" x2="15" y2="21"></line>
      <line x1="20" y1="10" x2="20" y2="21"></line>
    </svg>
  `,
  // Completed checkmark
  check: `
    <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  `,
};

/**
 * Linear Milestone Step Definitions
 */
export const FINANCIAL_MILESTONES: TimelineStepDefinition[] = [
  {
    status: "listed",
    label: "Item Listed",
    vernacularLabel: "शिल्प सूचीबद्ध (Listed)",
    description: "Craft cataloged with fair pricing & live for buyers",
    iconSvg: ICONS.listed,
  },
  {
    status: "sold",
    label: "Item Sold",
    vernacularLabel: "बिक्री संपन्न (Sold)",
    description: "Buyer paid; payment secured in fair-trade escrow",
    iconSvg: ICONS.sold,
  },
  {
    status: "processing",
    label: "Processing",
    vernacularLabel: "पैकिंग व सत्यापन (Processing)",
    description: "Quality inspection and dispatch preparation",
    iconSvg: ICONS.processing,
  },
  {
    status: "in_bank_account",
    label: "In Bank Account",
    vernacularLabel: "बैंक खाते में जमा (In Bank)",
    description: "Direct bank transfer / UPI credited to artisan",
    iconSvg: ICONS.in_bank_account,
  },
];

const STATUS_ORDER: MilestoneStatus[] = ["listed", "sold", "processing", "in_bank_account"];

/**
 * Returns numeric progress index (0 to 3) for the status.
 */
export function getStatusStepIndex(status: MilestoneStatus): number {
  const idx = STATUS_ORDER.indexOf(status);
  return idx >= 0 ? idx : 0;
}

/**
 * Generates the clean HTML string for the linear financial movement timeline.
 * 
 * @param currentStatus The active status ('listed' | 'sold' | 'processing' | 'in_bank_account').
 */
export function renderFinancialTimelineHTML(currentStatus: MilestoneStatus = "listed"): string {
  const activeIdx = getStatusStepIndex(currentStatus);
  const totalSteps = FINANCIAL_MILESTONES.length;
  // Progress bar width percentage
  const progressPercent = (activeIdx / (totalSteps - 1)) * 100;

  const stepsHTML = FINANCIAL_MILESTONES.map((step, idx) => {
    const isCompleted = idx < activeIdx;
    const isCurrent = idx === activeIdx;
    const isUpcoming = idx > activeIdx;

    let circleClasses = "";
    let labelColor = "";
    let stepBadge = "";

    if (isCompleted) {
      // Completed state: Deep Forest Green with crisp white check
      circleClasses = "bg-[#174C43] text-white border-4 border-[#EAF1ED] shadow-sm";
      labelColor = "text-[#174C43] font-bold";
      stepBadge = `
        <span class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#174C43] flex items-center justify-center border-2 border-white shadow-xs">
          ${ICONS.check}
        </span>
      `;
    } else if (isCurrent) {
      // Current active state: Warm Terracotta with subtle ring
      circleClasses = "bg-[#C95D35] text-white border-4 border-[#FBF1ED] shadow-md ring-4 ring-[#C95D35]/20";
      labelColor = "text-[#C95D35] font-black";
      stepBadge = `
        <span class="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-[#102F35] text-[9px] font-black text-[#FAF8F2] uppercase tracking-wider border border-white">
          Active
        </span>
      `;
    } else {
      // Upcoming state: Subtle Warm Ivory
      circleClasses = "bg-[#FAF8F2] text-[#566C70]/70 border-4 border-[#E6E2D6]";
      labelColor = "text-[#566C70] font-medium";
    }

    return `
      <div 
        class="flex-1 flex flex-col items-center text-center relative z-10 px-1 sm:px-2 group"
        role="listitem"
        ${isCurrent ? 'aria-current="step"' : ""}
      >
        <!-- Icon Container -->
        <div class="relative mb-2.5">
          <div 
            class="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${circleClasses}"
            title="${step.label}: ${step.description}"
          >
            ${step.iconSvg}
          </div>
          ${stepBadge}
        </div>

        <!-- Step Label & Audio Narrator Button -->
        <div class="space-y-0.5 max-w-[130px]">
          <div class="flex items-center justify-center gap-1">
            <span class="text-xs sm:text-sm ${labelColor} leading-tight">${step.label}</span>
            <button 
              type="button" 
              class="audio-btn p-1 rounded-full text-[#566C70] hover:text-[#174C43] hover:bg-[#EAF1ED] focus:outline-none focus:ring-2 focus:ring-[#174C43] transition-colors"
              data-audio-text="${step.label}. ${step.description}"
              aria-label="Listen to step description: ${step.label}"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            </button>
          </div>
          <p class="text-[10px] text-[#566C70] font-semibold line-clamp-1">${step.vernacularLabel}</p>
          <p class="text-[10px] text-[#566C70]/80 hidden md:block leading-tight">${step.description}</p>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="w-full bg-white rounded-2xl p-6 sm:p-8 border border-[#E6E2D6] shadow-xs space-y-6">
      <!-- Header with audio narration button -->
      <div class="flex items-center justify-between pb-4 border-b border-[#E6E2D6]">
        <div class="flex items-center gap-2.5">
          <span class="w-2.5 h-2.5 rounded-full bg-[#174C43] pulse-subtle"></span>
          <h3 class="text-base sm:text-lg font-bold text-[#102F35] font-serif">
            Financial Movement & Trust Timeline
          </h3>
        </div>
        <button 
          type="button" 
          class="audio-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#FAF8F2] text-[#174C43] border border-[#E6E2D6] hover:bg-[#F0ECE1] transition-colors shadow-2xs"
          data-audio-text="Financial Movement Timeline. Tracks craft payment from listing, to sale, to packing, and direct transfer into your bank account."
          aria-label="Listen to timeline overview"
        >
          <span>🔊</span>
          <span>Listen Overview</span>
        </button>
      </div>

      <!-- Linear Connector Timeline -->
      <div class="relative pt-3 pb-2" role="list" aria-label="Craft payment progress stages">
        <!-- Background Track -->
        <div class="absolute top-9 sm:top-11 left-8 right-8 h-1.5 bg-[#E6E2D6] rounded-full z-0"></div>

        <!-- Dynamic High-Contrast Progress Bar -->
        <div 
          id="timeline-progress-bar"
          class="absolute top-9 sm:top-11 left-8 h-1.5 bg-gradient-to-r from-[#174C43] to-[#C95D35] rounded-full z-0 transition-all duration-500"
          style="width: calc((100% - 4rem) * ${progressPercent / 100});"
        ></div>

        <!-- Timeline Steps -->
        <div class="flex items-start justify-between relative z-10">
          ${stepsHTML}
        </div>
      </div>

      <!-- Village Guarantee Badge -->
      <div class="p-4 rounded-xl bg-[#EAF1ED] border border-[#6F9B88]/30 flex items-center justify-between text-xs text-[#174C43]">
        <div class="flex items-center gap-2">
          <span class="text-base">🛡️</span>
          <span><strong>Zero Middleman Cut:</strong> 100% of the calculated living wage reaches your bank account directly upon buyer delivery.</span>
        </div>
        <span class="font-bold uppercase tracking-wider text-[10px] bg-white px-2.5 py-1 rounded-md border border-[#6F9B88]/40">Direct Trade</span>
      </div>
    </div>
  `;
}
