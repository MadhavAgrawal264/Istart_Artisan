/**
 * ARTISAN MARKETPLACE: VILLAGE TRUST MILESTONE TIMELINE
 * File: src/components/milestone-timeline.ts
 */

import { MilestoneStatus, TimelineStepDefinition } from "../types/artisan.ts";

const ICONS = {
  listed: `
    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
      <line x1="7" y1="7" x2="7.01" y2="7"></line>
    </svg>
  `,
  sold: `
    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1"></circle>
      <circle cx="20" cy="21" r="1"></circle>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
      <polyline points="9 11 12 14 22 4"></polyline>
    </svg>
  `,
  processing: `
    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
  `,
  in_bank_account: `
    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="3" y1="21" x2="21" y2="21"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
      <polyline points="5 6 12 2 19 6"></polyline>
      <line x1="4" y1="10" x2="4" y2="21"></line>
      <line x1="9" y1="10" x2="9" y2="21"></line>
      <line x1="15" y1="10" x2="15" y2="21"></line>
      <line x1="20" y1="10" x2="20" y2="21"></line>
    </svg>
  `,
  check: `
    <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  `,
};

export const FINANCIAL_MILESTONES: TimelineStepDefinition[] = [
  {
    status: "listed",
    label: "Product Listed",
    vernacularLabel: "शिल्प सूचीबद्ध",
    description: "Added to catalog with your fair price",
    iconSvg: ICONS.listed,
  },
  {
    status: "sold",
    label: "Order Confirmed",
    vernacularLabel: "बिक्री पक्की",
    description: "Buyer confirmed order & payment",
    iconSvg: ICONS.sold,
  },
  {
    status: "processing",
    label: "Packed & Sent",
    vernacularLabel: "पैकिंग और भेजना",
    description: "Craft packed carefully for delivery",
    iconSvg: ICONS.processing,
  },
  {
    status: "in_bank_account",
    label: "In Bank Account",
    vernacularLabel: "बैंक खाते में जमा",
    description: "Direct UPI / bank payout to you",
    iconSvg: ICONS.in_bank_account,
  },
];

const STATUS_ORDER: MilestoneStatus[] = ["listed", "sold", "processing", "in_bank_account"];

export function getStatusStepIndex(status: MilestoneStatus): number {
  const idx = STATUS_ORDER.indexOf(status);
  return idx >= 0 ? idx : 0;
}

export function renderFinancialTimelineHTML(currentStatus: MilestoneStatus = "listed"): string {
  const activeIdx = getStatusStepIndex(currentStatus);
  const totalSteps = FINANCIAL_MILESTONES.length;
  const progressPercent = (activeIdx / (totalSteps - 1)) * 100;

  const stepsHTML = FINANCIAL_MILESTONES.map((step, idx) => {
    const isCompleted = idx < activeIdx;
    const isCurrent = idx === activeIdx;

    let circleClasses = "";
    let labelColor = "";
    let stepBadge = "";

    if (isCompleted) {
      circleClasses = "bg-[#414A37] text-white border-4 border-[#E9DFD0]";
      labelColor = "text-[#414A37] font-bold";
      stepBadge = `
        <span class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#414A37] flex items-center justify-center border-2 border-white">
          ${ICONS.check}
        </span>
      `;
    } else if (isCurrent) {
      circleClasses = "bg-[#B9674B] text-white border-4 border-[#E9DFD0] ring-2 ring-[#B9674B]/25";
      labelColor = "text-[#B9674B] font-bold";
      stepBadge = `
        <span class="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full bg-[#414A37] text-[9px] font-bold text-[#F8F5EF] uppercase border border-white">
          Now
        </span>
      `;
    } else {
      circleClasses = "bg-[#F8F5EF] text-[#66625A] border-4 border-[#DDD3C3]";
      labelColor = "text-[#66625A] font-medium";
    }

    return `
      <div
        class="flex-1 flex flex-col items-center text-center relative z-10 px-1 sm:px-2"
        role="listitem"
        ${isCurrent ? 'aria-current="step"' : ""}
      >
        <div class="relative mb-2">
          <div
            class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all ${circleClasses}"
            title="${step.label}: ${step.description}"
          >
            ${step.iconSvg}
          </div>
          ${stepBadge}
        </div>

        <div class="space-y-0.5 max-w-[125px]">
          <div class="flex items-center justify-center gap-1">
            <span class="text-xs sm:text-sm ${labelColor} leading-tight">${step.label}</span>
            <button
              type="button"
              class="audio-btn p-1 rounded-full text-[#66625A] hover:text-[#414A37] hover:bg-[#E9DFD0] cursor-pointer"
              data-audio-text="${step.label}. ${step.description}"
              aria-label="Listen to step: ${step.label}"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            </button>
          </div>
          <p class="text-[10px] text-[#66625A] font-medium line-clamp-1">${step.vernacularLabel}</p>
          <p class="text-[10px] text-[#66625A] hidden md:block leading-tight">${step.description}</p>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="w-full bg-white rounded-2xl p-5 sm:p-6 border border-[#DDD3C3] space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EAE2D5]">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-[#89977B]"></span>
          <h3 class="text-base font-bold text-[#34332F] font-serif">How Your Payment Reaches You</h3>
        </div>
        <button
          type="button"
          class="audio-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#F8F5EF] text-[#414A37] border border-[#DDD3C3] hover:bg-[#E9DFD0] transition-colors cursor-pointer"
          data-audio-text="How your payment reaches you: First your craft is listed, then sold to a buyer, packed, and money goes straight to your bank account."
          aria-label="Listen to payment journey"
        >
          <span>🔊</span>
          <span>Listen</span>
        </button>
      </div>

      <div class="relative pt-2 pb-1" role="list" aria-label="Payment steps">
        <div class="absolute top-8 sm:top-9 left-8 right-8 h-1.5 bg-[#E9DFD0] rounded-full z-0"></div>
        <div
          id="timeline-progress-bar"
          class="absolute top-8 sm:top-9 left-8 h-1.5 bg-[#414A37] rounded-full z-0 transition-all duration-500"
          style="width: calc((100% - 4rem) * ${progressPercent / 100});"
        ></div>
        <div class="flex items-start justify-between relative z-10">
          ${stepsHTML}
        </div>
      </div>

      <div class="p-3.5 rounded-xl bg-[#F8F5EF] border border-[#DDD3C3] flex flex-wrap items-center justify-between gap-2 text-xs text-[#34332F]">
        <span><strong>No Middlemen:</strong> You keep 100% of your fair price via direct UPI or bank transfer.</span>
        <span class="font-semibold text-[#414A37] bg-[#E9DFD0] px-2.5 py-1 rounded-lg">Direct Payout</span>
      </div>
    </div>
  `;
}
