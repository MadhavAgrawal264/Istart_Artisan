/**
 * Artisan - Main Vanilla JavaScript Application Logic
 * 100% Pure HTML5, CSS3 and Vanilla JS - Zero React/Next.js/Vue/Angular
 */

import { TRANSLATIONS, SUPPORTED_LANGUAGES } from "./translations.js";
import { INITIAL_PRODUCTS, INITIAL_ARTISANS, CRAFT_CATEGORIES, INDIAN_STATES } from "./catalog-data.js";
import { applyStudioEnhancement, generateMarketStallCard } from "./canvas-tools.js";
import { MaterialPricingWizardController } from "./components/material-pricing-wizard.ts";
import { authService, getDashboardRouteForRole } from "./services/auth.ts";
import { parseCurrentLocation, navigateTo } from "./router.ts";
import { scrollChoreographer } from "./services/scrollytelling.ts";


// ==============================================================================
// APP STATE
// ==============================================================================
const state = {
  currentLang: "en",
  activeTab: "home",
  userRole: "artisan",
  authUser: null,
  currentRoute: null,
  isHighContrast: false,
  isLargeFont: false,
  products: [...INITIAL_PRODUCTS],
  artisans: [...INITIAL_ARTISANS],
  inquiries: [],
  currentArtisan: INITIAL_ARTISANS[0],

  // Dashboard catalog filters
  searchQuery: "",
  selectedCategory: "All Categories",
  selectedState: "All States",
  selectedStatus: "all",
  maxPrice: 10000,

  // Public explore filters
  publicFilters: {
    search: "",
    category: "All Categories",
    state: "All States",
    maxPrice: 10000,
  },
  
  // Active Cataloging Wizard Draft
  draft: {
    step: 1,
    rawImageBase64: "",
    enhancedImageBase64: "",
    backgroundStyle: "studio_white",
    voiceNotes: "",
    analysis: null,
    pricing: {
      materialCost: 320,
      laborHours: 16,
      hourlyRate: 85,
      overheadCost: 120,
      profitMarginPercent: 25,
      finalPrice: 2250,
      marketBenchmark: 3600
    },
    approvedTitle: "",
    approvedDesc: "",
    approvedMaterials: [],
    approvedTags: [],
    hasGiTag: false
  },

  // Media Stream
  cameraStream: null,
  isListeningVoice: false,
  recognition: null
};

// ==============================================================================
// ACCESSIBLE IN-APP TOAST NOTIFICATIONS (IFRAME-SAFE)
// ==============================================================================
export function showToast(message, type = "info", duration = 3500) {
  const container = document.getElementById("toast-container");
  if (!container) {
    console.log(`[${type}]`, message);
    return;
  }
  const toast = document.createElement("div");
  const icon = type === "error" ? "⚠️" : type === "success" ? "✅" : type === "warning" ? "🔔" : "✨";
  toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs sm:text-sm font-semibold transition-all transform translate-y-3 opacity-0 ${
    type === "error"
      ? "bg-[#EBC5A9] text-[#292929] border-[#292929]/20"
      : type === "success"
      ? "bg-[#B8C77B] text-[#292929] border-[#a6b668]"
      : type === "warning"
      ? "bg-[#DCE5C5] text-[#292929] border-[#B8C77B]"
      : "bg-white text-[#292929] border-[#E6E4DD]"
  }`;
  toast.innerHTML = `<span class="text-base">${icon}</span><span class="flex-1">${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-3", "opacity-0");
  });

  setTimeout(() => {
    toast.classList.add("translate-y-3", "opacity-0");
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ==============================================================================
// LOCAL STORAGE FALLBACK HELPERS (PRESERVES CHANGES ON STATIC HOSTING)
// ==============================================================================
const LOCAL_PRODUCTS_KEY = "artisan_local_products_v1";
const LOCAL_INQUIRIES_KEY = "artisan_local_inquiries_v1";

function loadLocalOverrides() {
  try {
    const savedProds = JSON.parse(localStorage.getItem(LOCAL_PRODUCTS_KEY) || "null");
    if (Array.isArray(savedProds) && savedProds.length > 0) {
      state.products = savedProds;
    }
    const savedInq = JSON.parse(localStorage.getItem(LOCAL_INQUIRIES_KEY) || "null");
    if (Array.isArray(savedInq) && savedInq.length > 0) {
      state.inquiries = savedInq;
    }
  } catch {
    // Ignore storage access errors
  }
}

function saveLocalProducts() {
  try {
    localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(state.products));
  } catch {
    // Ignore quota errors
  }
}

function saveLocalInquiries() {
  try {
    localStorage.setItem(LOCAL_INQUIRIES_KEY, JSON.stringify(state.inquiries));
  } catch {
    // Ignore quota errors
  }
}

// ==============================================================================
// INITIALIZATION
// ==============================================================================
document.addEventListener("DOMContentLoaded", async () => {
  loadLocalOverrides();
  initSpeechRecognition();
  setupLanguageSelector();
  setupNavigation();
  setupHeaderQuickSearch();
  setupAccessibilityControls();
  setupCameraAndUpload();
  setupSampleCraftButtons();
  setupWizardControls();
  setupPricingCalculator();
  setupCatalogFilters();
  setupEditProductModal();
  setupInquiryModal();
  setupAudioTTS();

  // Public site & authentication setup
  setupPublicRouter();
  setupPublicExploreFilters();
  setupPublicInteractions();
  setupAuthForms();
  setupInfoModal();

  window.addEventListener("artisan-toast", (e) => {
    const detail = e.detail || {};
    if (detail.message) {
      showToast(detail.message, detail.type || "info");
    }
  });

  // Restore real authenticated session before evaluating protected routes
  state.authUser = await authService.getCurrentUser();
  syncPublicAuthHeader();

  // Apply route immediately (defaults to public homepage '/')
  applyRoute(parseCurrentLocation());

  // Initialize Corn Revolution-inspired scrollytelling & particle choreography
  scrollChoreographer.init();

  // Fetch products and inquiries from API
  fetchProducts();
  fetchInquiries();

  // Setup Interactive AI Artisan Advisor
  setupAIChatAdvisor();

  // Setup Fair Pricing & Offline Sync Suite
  const pricingMount = document.getElementById("material-pricing-wizard-mount");
  if (pricingMount) {
    const wizard = new MaterialPricingWizardController();
    wizard.init(pricingMount);
  }

  // Apply initial translations and render views
  applyTranslations();
  renderHomeFeaturedProducts();
  renderPublicExplore();
  renderDashboard();
  renderCatalog();
  renderArtisanStudio();
});

// ==============================================================================
// 1. TRANSLATION ENGINE & ACCESSIBILITY
// ==============================================================================
function t(key) {
  const langDict = TRANSLATIONS[state.currentLang] || TRANSLATIONS.en;
  return langDict[key] || TRANSLATIONS.en[key] || key;
}

function setupLanguageSelector() {
  const select = document.getElementById("lang-select");
  if (!select) return;

  select.innerHTML = SUPPORTED_LANGUAGES.map(
    l => `<option value="${l.code}" ${l.code === state.currentLang ? "selected" : ""}>${l.name} (${l.label})</option>`
  ).join("");

  select.addEventListener("change", (e) => {
    state.currentLang = e.target.value;
    applyTranslations();
    syncAdvisorLangToggle();
    renderDashboard();
    renderCatalog();
    renderArtisanStudio();
  });
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (key) {
      el.textContent = t(key);
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key) {
      el.setAttribute("placeholder", t(key));
    }
  });
}

function setupAccessibilityControls() {
  const contrastBtn = document.getElementById("btn-toggle-contrast");
  const fontBtn = document.getElementById("btn-toggle-font");
  const roleBtn = document.getElementById("btn-toggle-role");

  if (contrastBtn) {
    contrastBtn.addEventListener("click", () => {
      state.isHighContrast = !state.isHighContrast;
      document.body.classList.toggle("high-contrast", state.isHighContrast);
      contrastBtn.classList.toggle("bg-yellow-400", state.isHighContrast);
      contrastBtn.classList.toggle("text-black", state.isHighContrast);
    });
  }

  if (fontBtn) {
    fontBtn.addEventListener("click", () => {
      state.isLargeFont = !state.isLargeFont;
      document.body.classList.toggle("large-text", state.isLargeFont);
      fontBtn.classList.toggle("bg-[#414A37]", state.isLargeFont);
      fontBtn.classList.toggle("text-white", state.isLargeFont);
    });
  }

  if (roleBtn) {
    roleBtn.addEventListener("click", () => {
      state.userRole = state.userRole === "artisan" ? "buyer" : "artisan";
      updateRoleBadge();
    });
    updateRoleBadge();
  }
}

function updateRoleBadge() {
  const roleBtn = document.getElementById("btn-toggle-role");
  if (!roleBtn) return;
  if (state.userRole === "artisan") {
    roleBtn.innerHTML = `<span>🎨</span> <span>${t("artisanMode")}</span>`;
    roleBtn.className = "px-3 py-2 rounded-xl text-xs font-semibold bg-[#E9DFD0] text-[#414A37] border border-[#DDD3C3] flex items-center gap-1.5 hover:bg-[#DDD3C3]/60 transition-colors cursor-pointer";
  } else {
    roleBtn.innerHTML = `<span>🛍️</span> <span>${t("buyerMode")}</span>`;
    roleBtn.className = "px-3 py-2 rounded-xl text-xs font-semibold bg-[#89977B]/20 text-[#414A37] border border-[#89977B]/40 flex items-center gap-1.5 hover:bg-[#89977B]/30 transition-colors cursor-pointer";
  }
}

// ==============================================================================
// 2. NAVIGATION & DASHBOARD
// ==============================================================================
function setupNavigation() {
  const navButtons = document.querySelectorAll(".nav-tab-btn");
  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      if (targetTab) switchTab(targetTab);
    });
  });

  const heroCtaAiAdvisor = document.getElementById("hero-cta-ai-advisor");
  if (heroCtaAiAdvisor) {
    heroCtaAiAdvisor.addEventListener("click", () => switchTab("ai-advisor"));
  }

  const heroCtaCatalog = document.getElementById("hero-cta-catalog");
  if (heroCtaCatalog) {
    heroCtaCatalog.addEventListener("click", () => switchTab("cataloging"));
  }

  const heroCtaBrowse = document.getElementById("hero-cta-browse");
  if (heroCtaBrowse) {
    heroCtaBrowse.addEventListener("click", () => switchTab("catalog"));
  }

  const heroCtaPricing = document.getElementById("hero-cta-pricing");
  if (heroCtaPricing) {
    heroCtaPricing.addEventListener("click", () => switchTab("pricing-engine"));
  }

  const btnStudioAdd = document.getElementById("btn-studio-add-craft");
  if (btnStudioAdd) {
    btnStudioAdd.addEventListener("click", () => switchTab("cataloging"));
  }

  const btnStudioProfile = document.getElementById("btn-studio-view-profile");
  if (btnStudioProfile) {
    btnStudioProfile.addEventListener("click", () => switchTab("artisan-profile"));
  }

  // Home Page Category Cards
  document.querySelectorAll("[data-home-category]").forEach(card => {
    card.addEventListener("click", () => {
      const cat = card.getAttribute("data-home-category");
      if (cat) {
        state.selectedCategory = cat;
        const filterEl = document.getElementById("catalog-category-filter");
        if (filterEl) filterEl.value = cat;
        switchTab("catalog");
      }
    });
  });
}

function setupHeaderQuickSearch() {
  const headerSearch = document.getElementById("header-quick-search");
  if (!headerSearch) return;
  headerSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      state.searchQuery = headerSearch.value.trim();
      const catalogSearch = document.getElementById("catalog-search-input");
      if (catalogSearch) catalogSearch.value = state.searchQuery;
      switchTab("catalog");
    }
  });
}

function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll(".tab-view").forEach(view => {
    view.classList.add("hidden");
  });

  const activeView = document.getElementById(`view-${tabName}`);
  if (activeView) {
    activeView.classList.remove("hidden");
  }

  document.querySelectorAll(".nav-tab-btn").forEach(btn => {
    const isCurrent = btn.getAttribute("data-tab") === tabName;
    btn.classList.toggle("is-active", isCurrent);
    if (!btn.classList.contains("mobile-nav-btn")) {
      if (isCurrent) {
        btn.classList.add("text-[#292929]", "font-bold");
        btn.classList.remove("text-[#5C5C57]");
      } else {
        btn.classList.remove("text-[#292929]", "font-bold");
        btn.classList.add("text-[#5C5C57]");
      }
    }
  });

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (tabName === "home") {
    renderDashboard();
  } else if (tabName === "catalog") {
    renderCatalog();
  } else if (tabName === "studio" || tabName === "inquiries") {
    renderArtisanStudio();
  } else if (tabName === "artisan-profile") {
    renderArtisanProfilePage();
  } else if (tabName === "settings") {
    renderSettingsPage();
  }
}

// ==============================================================================
// 2B. PUBLIC WEBSITE ROUTING, PAGES & AUTHENTICATION GUARDS
// ==============================================================================
const PUBLIC_CATEGORY_GROUPS = {
  "Pottery": ["pottery", "ceramics & pottery", "terracotta & clay art"],
  "Textiles": ["textiles", "handloom & textiles"],
  "Woodwork": ["woodwork", "wooden toys & carvings"],
  "Bamboo and Cane": ["bamboo and cane", "bamboo & cane"],
  "Jewellery": ["jewellery", "jewelry & filigree", "metalcraft & bell metal"],
  "Folk Art": ["folk art", "paintings & folk art"]
};

function matchesCategoryFilter(productCategory, selectedCategory) {
  if (!selectedCategory || selectedCategory === "All Categories") return true;
  const prodCat = String(productCategory || "").toLowerCase();
  const group = PUBLIC_CATEGORY_GROUPS[selectedCategory];
  if (group) {
    return group.some(g => prodCat === g || prodCat.includes(g));
  }
  return prodCat === selectedCategory.toLowerCase();
}

function setupPublicRouter() {
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a[data-route]");
    if (!link) return;
    const targetRoute = link.getAttribute("data-route");
    if (!targetRoute) return;
    e.preventDefault();
    document.getElementById("public-mobile-menu")?.classList.add("hidden");
    navigateAndRender(targetRoute);
  });

  window.addEventListener("popstate", () => {
    applyRoute(parseCurrentLocation());
  });
}

function navigateAndRender(appPath, replace = false) {
  const route = navigateTo(appPath, replace);
  applyRoute(route);
}

function syncPublicAuthHeader() {
  const guestDesktop = document.getElementById("public-auth-guest");
  const userDesktop = document.getElementById("public-auth-user");
  const dashLinkDesktop = document.getElementById("public-user-dashboard-link");
  const guestMobile = document.getElementById("public-mobile-auth-guest");
  const userMobile = document.getElementById("public-mobile-auth-user");
  const dashLinkMobile = document.getElementById("public-mobile-dashboard-link");

  const isLoggedIn = Boolean(state.authUser);
  const dashPath = getDashboardRouteForRole(state.authUser?.accountType);

  if (guestDesktop) guestDesktop.classList.toggle("hidden", isLoggedIn);
  if (userDesktop) {
    userDesktop.classList.toggle("hidden", !isLoggedIn);
    userDesktop.classList.toggle("flex", isLoggedIn);
  }
  if (dashLinkDesktop) {
    dashLinkDesktop.setAttribute("href", dashPath);
    dashLinkDesktop.setAttribute("data-route", dashPath);
    dashLinkDesktop.textContent = state.authUser?.accountType === "artisan" ? "Artisan Studio" : "My Dashboard";
  }

  if (guestMobile) guestMobile.classList.toggle("hidden", isLoggedIn);
  if (userMobile) {
    userMobile.classList.toggle("hidden", !isLoggedIn);
    userMobile.classList.toggle("flex", isLoggedIn);
  }
  if (dashLinkMobile) {
    dashLinkMobile.setAttribute("href", dashPath);
    dashLinkMobile.setAttribute("data-route", dashPath);
  }
}

function applyRoute(route) {
  state.currentRoute = route;
  const publicShell = document.getElementById("public-site-shell");
  const artisanShell = document.getElementById("artisan-dashboard-shell");

  // Protected: /artisan/dashboard
  if (route.name === "artisan-dashboard") {
    if (!state.authUser) {
      showToast("Please login with an Artisan account to open your dashboard.", "warning");
      navigateAndRender("/login", true);
      return;
    }
    if (state.authUser.accountType === "buyer") {
      navigateAndRender("/buyer/dashboard", true);
      return;
    }

    publicShell?.classList.add("hidden");
    artisanShell?.classList.remove("hidden");
    if (state.authUser.fullName) {
      state.currentArtisan = { ...state.currentArtisan, fullName: state.authUser.fullName };
    }
    renderDashboard();
    renderCatalog();
    renderArtisanStudio();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  // Protected: /buyer/dashboard
  if (route.name === "buyer-dashboard") {
    if (!state.authUser) {
      showToast("Please login to access your dashboard.", "warning");
      navigateAndRender("/login", true);
      return;
    }
    if (state.authUser.accountType === "artisan" || state.authUser.accountType === "organization") {
      navigateAndRender("/artisan/dashboard", true);
      return;
    }
  }

  // Public shell routes
  artisanShell?.classList.add("hidden");
  publicShell?.classList.remove("hidden");

  document.querySelectorAll(".public-page").forEach(page => page.classList.add("hidden"));
  const pageEl = document.getElementById(`public-page-${route.name}`);
  if (pageEl) pageEl.classList.remove("hidden");

  document.querySelectorAll(".public-nav-link").forEach(link => {
    const linkRoute = link.getAttribute("data-route");
    const active =
      (route.name === "home" && linkRoute === "/") ||
      (route.name === "explore" && linkRoute === "/explore") ||
      (route.name === "about" && linkRoute === "/about") ||
      (route.name === "contact" && linkRoute === "/contact");
    link.classList.toggle("is-active", active);
  });

  if (route.name === "home") {
    renderHomeFeaturedProducts();
  } else if (route.name === "explore") {
    const catParam = route.query?.get("category");
    if (catParam) {
      state.publicFilters.category = catParam;
      const catEl = document.getElementById("public-explore-category");
      if (catEl) catEl.value = catParam;
    }
    renderPublicExplore();
  } else if (route.name === "product") {
    renderPublicProductDetail(route.params.id);
  } else if (route.name === "register") {
    const typeParam = route.query?.get("type");
    const regSelect = document.getElementById("reg-account-type");
    if (regSelect && (typeParam === "artisan" || typeParam === "buyer")) {
      regSelect.value = typeParam;
    }
  } else if (route.name === "buyer-dashboard") {
    renderBuyerDashboard();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderHomeFeaturedProducts() {
  const container = document.getElementById("home-featured-products");
  if (!container) return;

  const published = state.products.filter(p => p.isApprovedByArtisan !== false).slice(0, 4);
  if (published.length === 0) {
    container.innerHTML = `<div class="col-span-full p-8 text-center bg-white rounded-2xl border border-[#E6E4DD] text-sm text-[#5C5C57]">No featured products available yet.</div>`;
    return;
  }

  container.innerHTML = published.map(p => {
    const artisan = state.artisans.find(a => a.id === p.artisanId) || state.currentArtisan;
    return `
      <div class="craft-card rounded-2xl overflow-hidden flex flex-col">
        <div class="aspect-[4/3] bg-[#F0EFF5] overflow-hidden">
          <img src="${p.enhancedImageUrl || p.imageUrl}" alt="${escapeHtml(p.title)}" loading="lazy" class="w-full h-full object-cover" />
        </div>
        <div class="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
          <div>
            <h3 class="font-serif font-bold text-[#292929] text-base leading-snug line-clamp-2">${escapeHtml(p.title)}</h3>
            <p class="text-xs text-[#5C5C57] mt-1">${escapeHtml(artisan.fullName)} • ${escapeHtml(p.originState || artisan.state || "India")}</p>
          </div>
          <div class="pt-3 border-t border-[#E6E4DD] flex items-center justify-between gap-2">
            <span class="font-serif font-bold text-lg text-[#292929]">₹${Number(p.finalPrice).toLocaleString("en-IN")}</span>
            <a href="/product/${encodeURIComponent(p.id)}" data-route="/product/${encodeURIComponent(p.id)}" class="px-4 py-2 rounded-xl bg-[#DCE5C5] hover:bg-[#B8C77B] text-[#292929] text-xs font-semibold transition-colors">
              View Product
            </a>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function setupPublicExploreFilters() {
  const searchEl = document.getElementById("public-explore-search");
  const catEl = document.getElementById("public-explore-category");
  const stateEl = document.getElementById("public-explore-state");
  const priceEl = document.getElementById("public-explore-price");
  const priceValEl = document.getElementById("public-explore-price-val");

  if (catEl) {
    catEl.innerHTML = CRAFT_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");
    catEl.addEventListener("change", (e) => {
      state.publicFilters.category = e.target.value;
      renderPublicExplore();
    });
  }

  if (stateEl) {
    stateEl.innerHTML = INDIAN_STATES.map(s => `<option value="${s}">${s}</option>`).join("");
    stateEl.addEventListener("change", (e) => {
      state.publicFilters.state = e.target.value;
      renderPublicExplore();
    });
  }

  if (searchEl) {
    searchEl.addEventListener("input", (e) => {
      state.publicFilters.search = e.target.value;
      renderPublicExplore();
    });
  }

  if (priceEl) {
    priceEl.addEventListener("input", (e) => {
      state.publicFilters.maxPrice = Number(e.target.value);
      if (priceValEl) priceValEl.textContent = `₹${state.publicFilters.maxPrice.toLocaleString("en-IN")}`;
      renderPublicExplore();
    });
  }
}

function renderPublicExplore() {
  const grid = document.getElementById("public-explore-grid");
  const countEl = document.getElementById("public-explore-count");
  if (!grid) return;

  const q = state.publicFilters.search.toLowerCase().trim();
  const filtered = state.products.filter(p => {
    if (p.isApprovedByArtisan === false) return false;
    const okCat = matchesCategoryFilter(p.category, state.publicFilters.category);
    const okState = state.publicFilters.state === "All States" || (p.originState && p.originState.toLowerCase() === state.publicFilters.state.toLowerCase());
    const okPrice = Number(p.finalPrice) <= state.publicFilters.maxPrice;
    const okSearch = !q ||
      p.title.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.originState && p.originState.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q));
    return okCat && okState && okPrice && okSearch;
  });

  if (countEl) countEl.textContent = `${filtered.length} ${filtered.length === 1 ? "Product" : "Products"}`;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-14 px-6 bg-white rounded-3xl border border-[#E6E4DD] text-center space-y-3">
        <p class="font-serif text-lg font-bold text-[#292929]">No crafts found matching your filters</p>
        <p class="text-xs sm:text-sm text-[#5C5C57]">Try clearing your search or viewing all categories.</p>
        <button type="button" id="public-reset-explore-btn" class="px-5 py-2.5 rounded-xl bg-[#B8C77B] text-[#292929] text-xs font-semibold cursor-pointer">Show All Crafts</button>
      </div>
    `;
    document.getElementById("public-reset-explore-btn")?.addEventListener("click", () => {
      state.publicFilters = { search: "", category: "All Categories", state: "All States", maxPrice: 10000 };
      const s = document.getElementById("public-explore-search");
      const c = document.getElementById("public-explore-category");
      const st = document.getElementById("public-explore-state");
      const pr = document.getElementById("public-explore-price");
      const pv = document.getElementById("public-explore-price-val");
      if (s) s.value = "";
      if (c) c.value = "All Categories";
      if (st) st.value = "All States";
      if (pr) pr.value = "10000";
      if (pv) pv.textContent = "₹10,000";
      renderPublicExplore();
    });
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const artisan = state.artisans.find(a => a.id === p.artisanId) || state.currentArtisan;
    return `
      <div class="craft-card rounded-2xl overflow-hidden flex flex-col">
        <div class="relative aspect-[4/3] bg-[#F0EFF5] overflow-hidden">
          <img src="${p.enhancedImageUrl || p.imageUrl}" alt="${escapeHtml(p.title)}" loading="lazy" class="w-full h-full object-cover" />
          <span class="absolute bottom-3 right-3 bg-white/95 text-[#292929] text-[11px] font-medium px-2.5 py-0.5 rounded-full border border-[#E6E4DD]">
            ${escapeHtml(p.originState || "India")}
          </span>
        </div>
        <div class="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
          <div>
            <div class="text-[11px] font-semibold text-[#3F4D22] uppercase tracking-wide">${escapeHtml(p.category)}</div>
            <h3 class="font-serif font-bold text-[#292929] text-base leading-snug line-clamp-2 mt-1">${escapeHtml(p.title)}</h3>
            <p class="text-xs text-[#5C5C57] mt-1">${escapeHtml(artisan.fullName)}</p>
          </div>
          <div class="pt-3 border-t border-[#E6E4DD] flex items-center justify-between gap-2">
            <span class="font-serif font-bold text-lg text-[#292929]">₹${Number(p.finalPrice).toLocaleString("en-IN")}</span>
            <a href="/product/${encodeURIComponent(p.id)}" data-route="/product/${encodeURIComponent(p.id)}" class="px-4 py-2 rounded-xl bg-[#B8C77B] hover:bg-[#a6b668] text-[#292929] text-xs font-semibold transition-colors">
              View Product
            </a>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderPublicProductDetail(productId) {
  const container = document.getElementById("public-product-detail-container");
  if (!container) return;

  const product = state.products.find(p => p.id === productId);
  if (!product) {
    container.innerHTML = `
      <div class="text-center py-12 space-y-3">
        <h2 class="font-serif text-2xl font-bold text-[#292929]">Craft Not Found</h2>
        <p class="text-sm text-[#5C5C57]">This craft listing may have moved or been removed.</p>
        <a href="/explore" data-route="/explore" class="inline-block px-5 py-2.5 rounded-xl bg-[#B8C77B] text-[#292929] text-sm font-semibold">Explore All Crafts</a>
      </div>
    `;
    return;
  }

  const artisan = state.artisans.find(a => a.id === product.artisanId) || state.currentArtisan;
  const mats = Array.isArray(product.materials) ? product.materials.join(", ") : (product.materials || "Natural Materials");
  const rawPhone = (artisan.phone || "").replace(/\D/g, "");
  const waText = encodeURIComponent(`Namaste ${artisan.fullName}! I saw "${product.title}" on ARTISAN (₹${product.finalPrice}) and would like to know more.`);

  container.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div class="lg:col-span-6 space-y-4">
        <div class="aspect-[4/3] rounded-2xl overflow-hidden bg-[#F0EFF5] border border-[#E6E4DD]">
          <img src="${product.enhancedImageUrl || product.imageUrl}" alt="${escapeHtml(product.title)}" class="w-full h-full object-cover" />
        </div>
      </div>

      <div class="lg:col-span-6 space-y-5">
        <div class="flex flex-wrap items-center gap-2">
          <span class="px-3 py-1 rounded-full bg-[#DCE5C5] text-[#292929] text-xs font-semibold">${escapeHtml(product.category)}</span>
          ${product.hasGiTag ? `<span class="px-3 py-1 rounded-full bg-[#EBC5A9] text-[#292929] text-xs font-semibold">GI Heritage</span>` : ""}
        </div>

        <h1 class="font-serif text-2xl sm:text-3xl font-bold text-[#292929] leading-snug">${escapeHtml(product.title)}</h1>

        <div class="flex items-baseline gap-3">
          <span class="font-serif text-3xl font-bold text-[#292929]">₹${Number(product.finalPrice).toLocaleString("en-IN")}</span>
          ${product.marketBenchmarkPrice ? `<span class="text-sm text-[#5C5C57] line-through">₹${Number(product.marketBenchmarkPrice).toLocaleString("en-IN")}</span>` : ""}
        </div>

        <p class="text-sm text-[#5C5C57] leading-relaxed">${escapeHtml(product.description)}</p>

        <div class="p-4 rounded-2xl bg-[#FAFAF8] border border-[#E6E4DD] space-y-1.5">
          <div class="text-xs font-semibold text-[#3F4D22] uppercase">Craft Story</div>
          <p class="text-xs sm:text-sm text-[#292929] italic leading-relaxed">${escapeHtml(product.culturalStory || "Handcrafted with generational skill and care.")}</p>
        </div>

        <div class="text-xs text-[#5C5C57] space-y-1">
          <div><strong class="text-[#292929]">Materials:</strong> ${escapeHtml(mats)}</div>
          <div><strong class="text-[#292929]">Origin:</strong> ${escapeHtml(product.originState || artisan.state || "India")}</div>
        </div>

        <div class="p-4 rounded-2xl bg-[#DCE5C5]/60 border border-[#B8C77B]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <img src="${artisan.profileImage || "./assets/sitadevi_profile.jpg"}" alt="${escapeHtml(artisan.fullName)}" class="w-12 h-12 rounded-xl object-cover border border-[#B8C77B]" />
            <div>
              <div class="font-serif font-bold text-sm text-[#292929]">${escapeHtml(artisan.fullName)}</div>
              <div class="text-xs text-[#5C5C57]">${escapeHtml(artisan.districtVillage || artisan.state || "India")}</div>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <a href="https://wa.me/${rawPhone || "919876543210"}?text=${waText}" target="_blank" rel="noopener noreferrer" class="px-4 py-2.5 rounded-xl bg-white border border-[#E6E4DD] text-xs font-semibold text-[#292929]">WhatsApp</a>
            <button type="button" id="public-detail-enquiry-btn" class="px-5 py-2.5 rounded-xl bg-[#B8C77B] hover:bg-[#a6b668] text-xs font-semibold text-[#292929] cursor-pointer">Send Enquiry</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("public-detail-enquiry-btn")?.addEventListener("click", () => {
    openInquiryModal(product);
  });
}

function renderBuyerDashboard() {
  const nameEl = document.getElementById("buyer-dash-name");
  const metaEl = document.getElementById("buyer-dash-meta");
  const listEl = document.getElementById("buyer-dash-enquiries");

  if (nameEl) nameEl.textContent = state.authUser?.fullName || "Buyer";
  if (metaEl) metaEl.textContent = `${state.authUser?.email || ""} ${state.authUser?.mobileNumber ? "• " + state.authUser.mobileNumber : ""}`;

  if (listEl) {
    if (state.inquiries.length === 0) {
      listEl.innerHTML = `<p class="text-sm text-[#5C5C57]">You have not sent any craft enquiries yet. Explore handmade crafts to connect directly with artisans.</p>`;
    } else {
      listEl.innerHTML = state.inquiries.slice(0, 5).map(inq => {
        const prod = state.products.find(p => p.id === inq.productId) || { title: "Handmade Craft" };
        return `
          <div class="p-4 rounded-2xl bg-[#FAFAF8] border border-[#E6E4DD] flex items-center justify-between gap-3">
            <div>
              <div class="font-semibold text-[#292929]">${escapeHtml(prod.title)}</div>
              <div class="text-xs text-[#5C5C57]">Quantity: ${inq.quantity || 1} • ${escapeHtml(inq.message || "Enquiry sent")}</div>
            </div>
            <span class="px-2.5 py-1 rounded-full bg-[#DCE5C5] text-xs font-semibold text-[#292929]">Sent</span>
          </div>
        `;
      }).join("");
    }
  }
}

function setupPublicInteractions() {
  const mobileBtn = document.getElementById("public-mobile-menu-btn");
  const mobileMenu = document.getElementById("public-mobile-menu");
  mobileBtn?.addEventListener("click", () => {
    mobileMenu?.classList.toggle("hidden");
  });

  const handleLogout = async () => {
    await authService.logout();
    state.authUser = null;
    syncPublicAuthHeader();
    showToast("You have been logged out.", "info");
    navigateAndRender("/");
  };

  document.getElementById("public-btn-logout")?.addEventListener("click", handleLogout);
  document.getElementById("public-mobile-btn-logout")?.addEventListener("click", handleLogout);
  document.getElementById("buyer-btn-logout")?.addEventListener("click", handleLogout);
  document.getElementById("dashboard-btn-logout")?.addEventListener("click", handleLogout);

  // Contact Us Form
  const contactForm = document.getElementById("public-contact-form");
  contactForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("contact-name")?.value.trim();
    const email = document.getElementById("contact-email")?.value.trim();
    const subject = document.getElementById("contact-subject")?.value.trim();
    const message = document.getElementById("contact-message")?.value.trim();
    const feedback = document.getElementById("contact-feedback");
    const submitBtn = document.getElementById("contact-submit-btn");

    if (!name || !email || !message) return;
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message })
      });
      if (!res.ok) throw new Error("Server unreachable");
      if (feedback) {
        feedback.textContent = "Thank you! Your message has been received by our team.";
        feedback.className = "text-xs font-medium p-3 rounded-xl bg-[#DCE5C5] text-[#292929]";
      }
      contactForm.reset();
    } catch {
      if (feedback) {
        feedback.textContent = "We could not submit online right now. Please email support@artisan-crafts.example directly.";
        feedback.className = "text-xs font-medium p-3 rounded-xl bg-[#EBC5A9] text-[#292929]";
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function setupAuthForms() {
  const loginForm = document.getElementById("login-form");
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email")?.value || "";
    const password = document.getElementById("login-password")?.value || "";
    const errBox = document.getElementById("login-error-box");
    const btn = document.getElementById("login-submit-btn");

    errBox?.classList.add("hidden");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Signing in...";
    }

    const result = await authService.login(email, password);
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Sign In";
    }

    if (!result.success || !result.user) {
      if (errBox) {
        errBox.textContent = result.error || "Invalid email or password.";
        errBox.classList.remove("hidden");
      }
      return;
    }

    state.authUser = result.user;
    syncPublicAuthHeader();
    showToast(`Welcome back, ${result.user.fullName}!`, "success");
    loginForm.reset();
    navigateAndRender(getDashboardRouteForRole(result.user.accountType));
  });

  const regForm = document.getElementById("register-form");
  regForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullName = document.getElementById("reg-full-name")?.value || "";
    const email = document.getElementById("reg-email")?.value || "";
    const mobileNumber = document.getElementById("reg-mobile")?.value || "";
    const accountType = document.getElementById("reg-account-type")?.value || "buyer";
    const password = document.getElementById("reg-password")?.value || "";
    const errBox = document.getElementById("register-error-box");
    const okBox = document.getElementById("register-success-box");
    const btn = document.getElementById("register-submit-btn");

    errBox?.classList.add("hidden");
    okBox?.classList.add("hidden");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Creating account...";
    }

    const result = await authService.register({
      fullName,
      email,
      mobileNumber,
      password,
      accountType
    });

    if (btn) {
      btn.disabled = false;
      btn.textContent = "Create Account";
    }

    if (!result.success || !result.user) {
      if (errBox) {
        errBox.textContent = result.error || "Could not create account.";
        errBox.classList.remove("hidden");
      }
      return;
    }

    if (result.requiresEmailConfirmation) {
      if (okBox) {
        okBox.textContent = "Account created! Please check your email to confirm your address before signing in.";
        okBox.classList.remove("hidden");
      }
      regForm.reset();
      return;
    }

    state.authUser = result.user;
    syncPublicAuthHeader();
    showToast(`Welcome to ARTISAN, ${result.user.fullName}!`, "success");
    regForm.reset();
    navigateAndRender(getDashboardRouteForRole(result.user.accountType));
  });
}

function setupInfoModal() {
  const modal = document.getElementById("info-policy-modal");
  const titleEl = document.getElementById("info-modal-title");
  const bodyEl = document.getElementById("info-modal-body");
  const closeBtn = document.getElementById("btn-close-info-modal");

  closeBtn?.addEventListener("click", () => modal?.classList.add("hidden"));

  const contentMap = {
    faqs: {
      title: "Frequently Asked Questions",
      body: `<p><strong>How does ARTISAN calculate prices?</strong><br/>Prices combine raw material costs and skilled working hours at a fair hourly wage.</p><p><strong>Do buyers contact artisans directly?</strong><br/>Yes. Enquiries, phone calls, and WhatsApp messages go directly to the creator with zero middlemen.</p>`
    },
    privacy: {
      title: "Privacy Policy",
      body: `<p>ARTISAN collects only the account details and enquiry contact information required to connect buyers and artisans safely. We never sell personal data to third parties.</p>`
    },
    terms: {
      title: "Terms & Conditions",
      body: `<p>Artisans retain full ownership of their craft listings and pricing. Buyers and artisans agree to communicate respectfully and honor fair-trade commitments.</p>`
    }
  };

  document.querySelectorAll("[data-info-modal]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-info-modal");
      const entry = contentMap[key];
      if (!entry || !modal || !titleEl || !bodyEl) return;
      titleEl.textContent = entry.title;
      bodyEl.innerHTML = entry.body;
      modal.classList.remove("hidden");
    });
  });
}

function renderDashboard() {
  const greetingName = document.getElementById("dash-greeting-name");
  if (greetingName) {
    greetingName.textContent = state.authUser?.fullName || state.currentArtisan?.fullName || "Artisan";
  }

  const totalCount = state.products.length;
  const publishedCount = state.products.filter(p => p.isApprovedByArtisan !== false).length;
  const pendingCount = totalCount - publishedCount;
  const enquiriesCount = state.inquiries.length;

  const elTotal = document.getElementById("dash-total-products");
  const elPub = document.getElementById("dash-published-products");
  const elPend = document.getElementById("dash-pending-approvals");
  const elInq = document.getElementById("dash-buyer-enquiries");
  const sidebarBadge = document.getElementById("sidebar-inquiries-badge");

  if (elTotal) elTotal.textContent = String(totalCount);
  if (elPub) elPub.textContent = String(publishedCount);
  if (elPend) elPend.textContent = String(pendingCount);
  if (elInq) elInq.textContent = String(enquiriesCount);
  if (sidebarBadge) sidebarBadge.textContent = String(enquiriesCount);

  const recentGrid = document.getElementById("dash-recent-products");
  if (recentGrid) {
    const recent = state.products.slice(0, 4);
    if (recent.length === 0) {
      recentGrid.innerHTML = `
        <div class="col-span-full p-8 rounded-2xl bg-white border border-[#E6E4DD] text-center space-y-2">
          <p class="font-serif font-bold text-[#292929]">No products added yet</p>
          <p class="text-xs text-[#5C5C57]">Tap "Add New Product" to upload your first craft photo.</p>
        </div>
      `;
    } else {
      recentGrid.innerHTML = recent.map(p => {
        const localizedTitle = (p.titleRegional && p.titleRegional[state.currentLang]) || p.title;
        const isPublished = p.isApprovedByArtisan !== false;
        return `
          <div class="craft-card rounded-2xl overflow-hidden flex flex-col">
            <div class="relative aspect-[4/3] bg-[#F0EFF5] overflow-hidden">
              <img src="${p.enhancedImageUrl || p.imageUrl}" alt="${escapeHtml(localizedTitle)}" loading="lazy" class="w-full h-full object-cover" />
              <span class="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                isPublished ? "bg-[#DCE5C5] text-[#292929]" : "bg-[#EBC5A9] text-[#292929]"
              }">
                ${isPublished ? "Published" : "Pending Approval"}
              </span>
            </div>
            <div class="p-4 flex-1 flex flex-col justify-between gap-3">
              <div>
                <div class="text-[11px] font-semibold text-[#3F4D22] uppercase tracking-wide truncate">${escapeHtml(p.category)}</div>
                <h3 class="font-serif font-bold text-sm text-[#292929] line-clamp-1 mt-0.5">${escapeHtml(localizedTitle)}</h3>
                <div class="font-serif text-base font-bold text-[#292929] mt-1">₹${Number(p.finalPrice).toLocaleString("en-IN")}</div>
              </div>
              <div class="flex items-center gap-2 pt-2 border-t border-[#E6E4DD]">
                <button type="button" data-dash-action="view" data-id="${p.id}" class="flex-1 py-2 rounded-xl bg-[#FAFAF8] hover:bg-[#DCE5C5] text-[#292929] text-xs font-semibold border border-[#E6E4DD] cursor-pointer">View</button>
                <button type="button" data-dash-action="edit" data-id="${p.id}" class="flex-1 py-2 rounded-xl bg-[#B8C77B] hover:bg-[#a6b668] text-[#292929] text-xs font-semibold cursor-pointer">Edit</button>
              </div>
            </div>
          </div>
        `;
      }).join("");

      recentGrid.querySelectorAll("[data-dash-action='view']").forEach(btn => {
        btn.addEventListener("click", () => {
          const prod = state.products.find(p => p.id === btn.getAttribute("data-id"));
          if (prod) openProductDetailModal(prod);
        });
      });

      recentGrid.querySelectorAll("[data-dash-action='edit']").forEach(btn => {
        btn.addEventListener("click", () => {
          const prod = state.products.find(p => p.id === btn.getAttribute("data-id"));
          if (prod) openEditProductModal(prod);
        });
      });
    }
  }

  const recentEnqEl = document.getElementById("dash-recent-enquiries");
  if (recentEnqEl) {
    const latest = state.inquiries.slice(0, 3);
    if (latest.length === 0) {
      recentEnqEl.innerHTML = `
        <div class="p-4 rounded-2xl bg-[#FAFAF8] border border-[#E6E4DD] text-xs text-[#5C5C57] text-center">
          No buyer enquiries yet. When buyers ask about your crafts, they appear here.
        </div>
      `;
    } else {
      recentEnqEl.innerHTML = latest.map(inq => {
        const prod = state.products.find(p => p.id === inq.productId) || { title: "Handcrafted Item" };
        return `
          <div class="p-3 rounded-2xl bg-[#FAFAF8] border border-[#E6E4DD] flex items-start justify-between gap-2.5">
            <div class="min-w-0">
              <div class="text-xs font-bold text-[#292929] truncate">${escapeHtml(inq.buyerName)}</div>
              <div class="text-[11px] text-[#5C5C57] truncate">${escapeHtml(prod.title)} • ${inq.quantity || 1} pc</div>
            </div>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EBC5A9] text-[#292929] flex-shrink-0">New</span>
          </div>
        `;
      }).join("");
    }
  }
}

// ==============================================================================
// 3. VOICE INPUT (WEB SPEECH API & VERNACULAR ASSISTANT)
// ==============================================================================
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Web Speech API not supported on this browser");
    return;
  }

  state.recognition = new SpeechRecognition();
  state.recognition.continuous = false;
  state.recognition.interimResults = true;

  state.recognition.onstart = () => {
    state.isListeningVoice = true;
    updateVoiceUI(true);
  };

  state.recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      transcript += event.results[i][0].transcript;
    }
    const voiceInput = document.getElementById("voice-input-text");
    if (voiceInput) {
      voiceInput.value = transcript;
      state.draft.voiceNotes = transcript;
    }
  };

  state.recognition.onerror = (e) => {
    console.warn("Speech recognition error:", e.error);
    state.isListeningVoice = false;
    updateVoiceUI(false);
  };

  state.recognition.onend = () => {
    state.isListeningVoice = false;
    updateVoiceUI(false);
  };

  const micBtn = document.getElementById("btn-voice-record");
  if (micBtn) {
    micBtn.addEventListener("click", toggleVoiceRecording);
  }
}

function toggleVoiceRecording() {
  if (!state.recognition) {
    showToast("Speech recognition is not supported in this browser. Please type your description in the box.", "warning");
    return;
  }

  if (state.isListeningVoice) {
    state.recognition.stop();
  } else {
    // Map currentLang to BCP-47 locale
    const langMap = {
      hi: "hi-IN",
      bn: "bn-IN",
      mr: "mr-IN",
      ta: "ta-IN",
      te: "te-IN",
      gu: "gu-IN",
      kn: "kn-IN",
      od: "or-IN",
      en: "en-IN"
    };
    state.recognition.lang = langMap[state.currentLang] || "hi-IN";
    try {
      state.recognition.start();
    } catch (e) {
      state.recognition.stop();
    }
  }
}

function updateVoiceUI(isListening) {
  const micBtn = document.getElementById("btn-voice-record");
  const pulseIndicator = document.getElementById("voice-pulse-status");
  if (micBtn) {
    if (isListening) {
      micBtn.classList.add("bg-red-600", "text-white", "voice-recording-pulse");
      micBtn.classList.remove("bg-amber-600");
      micBtn.innerHTML = `<span>🛑</span> <span>${t("stopListening")}</span>`;
    } else {
      micBtn.classList.remove("bg-red-600", "voice-recording-pulse");
      micBtn.classList.add("bg-amber-600", "text-white");
      micBtn.innerHTML = `<span>🎙️</span> <span>${t("tapToSpeak")}</span>`;
    }
  }
  if (pulseIndicator) {
    pulseIndicator.textContent = isListening ? t("listening") : "";
    pulseIndicator.classList.toggle("hidden", !isListening);
  }
}

// ==============================================================================
// 4. CAMERA & IMAGE UPLOAD
// ==============================================================================
function setupCameraAndUpload() {
  const cameraBtn = document.getElementById("btn-open-camera");
  const shutterBtn = document.getElementById("btn-shutter-snap");
  const closeCameraBtn = document.getElementById("btn-close-camera");
  const fileInput = document.getElementById("product-file-input");
  const uploadBox = document.getElementById("file-dropzone");

  if (cameraBtn) {
    cameraBtn.addEventListener("click", startCamera);
  }
  if (shutterBtn) {
    shutterBtn.addEventListener("click", captureSnapshot);
  }
  if (closeCameraBtn) {
    closeCameraBtn.addEventListener("click", stopCamera);
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) handleImageFile(file);
    });
  }

  if (uploadBox) {
    uploadBox.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadBox.classList.add("border-amber-500", "bg-amber-50");
    });
    uploadBox.addEventListener("dragleave", () => {
      uploadBox.classList.remove("border-amber-500", "bg-amber-50");
    });
    uploadBox.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadBox.classList.remove("border-amber-500", "bg-amber-50");
      const file = e.dataTransfer?.files?.[0];
      if (file) handleImageFile(file);
    });
  }
}

async function startCamera() {
  const video = document.getElementById("camera-stream");
  const cameraContainer = document.getElementById("camera-container");
  if (!video || !cameraContainer) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    state.cameraStream = stream;
    video.srcObject = stream;
    video.play();
    cameraContainer.classList.remove("hidden");
  } catch (err) {
    console.warn("Camera access failed or denied:", err);
    showToast("Unable to access camera. Please select a photo from your device or use one of the sample demo crafts.", "warning");
  }
}

function stopCamera() {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(t => t.stop());
    state.cameraStream = null;
  }
  const cameraContainer = document.getElementById("camera-container");
  if (cameraContainer) cameraContainer.classList.add("hidden");
}

function captureSnapshot() {
  const video = document.getElementById("camera-stream");
  if (!video) return;

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 800;
  canvas.height = video.videoHeight || 600;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const base64 = canvas.toDataURL("image/jpeg", 0.9);
  stopCamera();
  setDraftImage(base64);
}

function handleImageFile(file) {
  if (!file.type.startsWith("image/")) {
    showToast("Please upload a valid image file (JPEG, PNG, WebP).", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target?.result;
    if (base64) {
      setDraftImage(base64);
    }
  };
  reader.readAsDataURL(file);
}

function setupSampleCraftButtons() {
  const sampleBtns = document.querySelectorAll(".sample-craft-btn");
  sampleBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const craftType = btn.getAttribute("data-craft");
      loadSampleCraft(craftType);
    });
  });
}

function loadSampleCraft(craftType) {
  const sampleMap = {
    madhubani: {
      url: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80",
      voice: "Yeh Madhubani Tree of Life painting hai, Bihar Mithila ki, natural dyes aur handmade paper par 24 ghante lage hain.",
      color: "#991b1b",
      title: "Madhubani Tree of Life"
    },
    channapatna: {
      url: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=800&auto=format&fit=crop&q=80",
      voice: "Karnataka Channapatna wooden stacking toy, Hale wood aur vegetable lacquer use hua hai, bacchon ke liye 100% safe.",
      color: "#ea580c",
      title: "Channapatna Wooden Toy"
    },
    bluepottery: {
      url: "https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?w=800&auto=format&fit=crop&q=80",
      voice: "Jaipur Traditional Blue Pottery vase, quartz powder and cobalt blue glaze, hand-painted floral design.",
      color: "#1e40af",
      title: "Jaipur Blue Pottery Vase"
    },
    dhokra: {
      url: "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=800&auto=format&fit=crop&q=80",
      voice: "Bastar Dhokra brass musician statue, Chhattisgarh lost-wax bell metal casting, 16 hours of handwork.",
      color: "#854d0e",
      title: "Bastar Dhokra Brass Statue"
    }
  };

  const chosen = sampleMap[craftType] || sampleMap.channapatna;
  const voiceInput = document.getElementById("voice-input-text");
  if (voiceInput) {
    voiceInput.value = chosen.voice;
    state.draft.voiceNotes = chosen.voice;
  }

  // Pre-generate guaranteed local canvas artwork first for zero latency
  const localArt = createCraftSampleCanvas(chosen.title, chosen.color);
  setDraftImage(localArt);

  // Attempt external high-res load asynchronously if CORS permits
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setDraftImage(dataUrl);
    } catch (e) {
      // Local canvas art remains active
    }
  };
  img.src = chosen.url;
}

function setDraftImage(base64Data) {
  state.draft.rawImageBase64 = base64Data;
  state.draft.enhancedImageBase64 = base64Data;

  const preview = document.getElementById("uploaded-photo-preview");
  const previewContainer = document.getElementById("photo-preview-container");
  if (preview && previewContainer) {
    preview.src = base64Data;
    previewContainer.classList.remove("hidden");
  }

  const enhancedPreview = document.getElementById("enhanced-photo-preview");
  if (enhancedPreview) {
    enhancedPreview.src = base64Data;
  }

  const btnAnalyze = document.getElementById("btn-trigger-ai-analysis");
  if (btnAnalyze) {
    btnAnalyze.removeAttribute("disabled");
    btnAnalyze.classList.remove("opacity-50", "cursor-not-allowed");
  }
}

// ==============================================================================
// 5. AI PRODUCT CREATION (3-STEP WORKFLOW)
// ==============================================================================
function setupWizardControls() {
  const btnAnalyze = document.getElementById("btn-trigger-ai-analysis");
  if (btnAnalyze) {
    btnAnalyze.addEventListener("click", runAIAnalysis);
  }

  // Studio background selection buttons
  const bgButtons = document.querySelectorAll(".bg-style-btn");
  bgButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      bgButtons.forEach(b => b.classList.remove("ring-2", "ring-[#414A37]"));
      btn.classList.add("ring-2", "ring-[#414A37]");
      const style = btn.getAttribute("data-style") || "studio_white";
      state.draft.backgroundStyle = style;
      applyBackgroundStyle(style);
    });
  });

  // Wizard Step Next / Back Navigation
  document.querySelectorAll(".wizard-next-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const nextStep = Number(btn.getAttribute("data-next"));
      goToWizardStep(nextStep);
    });
  });

  document.querySelectorAll(".wizard-prev-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const prevStep = Number(btn.getAttribute("data-prev"));
      goToWizardStep(prevStep);
    });
  });

  // Final Publish Button
  const btnPublish = document.getElementById("btn-publish-craft");
  if (btnPublish) {
    btnPublish.addEventListener("click", publishDraftProduct);
  }

  // Translation in Review step
  const btnTranslate = document.getElementById("btn-translate-review");
  if (btnTranslate) {
    btnTranslate.addEventListener("click", translateReviewDetails);
  }
}

function goToWizardStep(stepNum) {
  state.draft.step = stepNum;
  document.querySelectorAll(".wizard-step-panel").forEach(panel => {
    panel.classList.add("hidden");
  });

  const targetPanel = document.getElementById(`wizard-step-${stepNum}`);
  if (targetPanel) {
    targetPanel.classList.remove("hidden");
  }

  // Update 3-step indicator pills
  document.querySelectorAll(".step-indicator-pill").forEach(pill => {
    const pStep = Number(pill.getAttribute("data-step"));
    pill.classList.remove("bg-[#B8C77B]", "bg-[#DCE5C5]", "bg-[#FAFAF8]", "text-[#292929]", "text-[#5C5C57]", "border", "border-[#E6E4DD]");
    if (pStep === stepNum) {
      pill.classList.add("bg-[#B8C77B]", "text-[#292929]");
    } else if (pStep < stepNum) {
      pill.classList.add("bg-[#DCE5C5]", "text-[#292929]");
    } else {
      pill.classList.add("bg-[#FAFAF8]", "text-[#5C5C57]", "border", "border-[#E6E4DD]");
    }
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function runAIAnalysis() {
  const voiceNotesInput = document.getElementById("voice-input-text");
  const enteredVoice = voiceNotesInput ? voiceNotesInput.value.trim() : "";

  if (!state.draft.rawImageBase64 && !enteredVoice) {
    loadSampleCraft("channapatna");
    showToast("Loaded sample craft photo. Generating details...", "info");
  }

  if (enteredVoice) {
    state.draft.voiceNotes = enteredVoice;
  }

  if (!state.draft.rawImageBase64) {
    const isToy = enteredVoice.toLowerCase().includes("toy") || enteredVoice.toLowerCase().includes("wood");
    const isBrass = enteredVoice.toLowerCase().includes("brass") || enteredVoice.toLowerCase().includes("metal");
    const craftTitle = isToy ? "Channapatna Wooden Craft" : isBrass ? "Bastar Dhokra Brass" : "Artisan Handcrafted Heritage";
    const craftColor = isToy ? "#B9674B" : isBrass ? "#89977B" : "#414A37";
    setDraftImage(createCraftSampleCanvas(craftTitle, craftColor));
  }

  const loadingOverlay = document.getElementById("ai-analysis-loading");
  if (loadingOverlay) loadingOverlay.classList.remove("hidden");

  try {
    const res = await fetch("/api/ai/analyze-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: state.draft.rawImageBase64,
        voiceDescription: state.draft.voiceNotes || enteredVoice,
        language: state.currentLang
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    if (loadingOverlay) loadingOverlay.classList.add("hidden");

    if (data.success && data.analysis) {
      state.draft.analysis = data.analysis;
      populateAnalysisResults(data.analysis);
      goToWizardStep(2);
      showToast("Product details ready! Please review them below.", "success");
    } else {
      showToast("Could not generate details right now. Please try again.", "error");
    }
  } catch (err) {
    console.error("AI Cataloging error:", err);
    if (loadingOverlay) loadingOverlay.classList.add("hidden");
    showToast("AI service is unreachable. Please check your connection or fill details in Step 3.", "warning");
  }
}

function populateAnalysisResults(analysis) {
  const catEl = document.getElementById("res-category");
  const matsEl = document.getElementById("res-materials");
  const colorsEl = document.getElementById("res-colors");
  const tagsEl = document.getElementById("res-tags");
  const storyEl = document.getElementById("res-story");
  const confBadge = document.getElementById("res-confidence-badge");
  const confText = document.getElementById("res-confidence-text");
  const giStatusText = document.getElementById("res-gi-status-text");
  const guardrailBanner = document.getElementById("res-guardrail-banner");
  const guardrailDesc = document.getElementById("res-guardrail-desc");
  const verificationNoticeEl = document.getElementById("res-verification-notice");

  if (catEl) catEl.textContent = analysis.category || "Traditional Handcraft";
  if (matsEl) {
    const mats = Array.isArray(analysis.materials) ? analysis.materials : [analysis.materials];
    matsEl.innerHTML = mats.map(m => `<span class="px-2.5 py-1 bg-white border border-[#DDD3C3] text-[#34332F] rounded-lg text-xs font-medium">${escapeHtml(m)}</span>`).join(" ");
  }
  if (colorsEl) {
    const colors = Array.isArray(analysis.primaryColors) ? analysis.primaryColors : [analysis.primaryColors];
    colorsEl.innerHTML = colors.map(c => `<span class="px-2.5 py-1 bg-[#E9DFD0] text-[#34332F] rounded-lg text-xs font-medium">${escapeHtml(c)}</span>`).join(" ");
  }
  if (tagsEl) {
    const tags = Array.isArray(analysis.tags) ? analysis.tags : [analysis.tags];
    tagsEl.innerHTML = tags.map(t => `<span class="px-2 py-0.5 bg-[#89977B]/20 text-[#414A37] rounded-md text-xs">#${escapeHtml(t)}</span>`).join(" ");
  }
  if (storyEl) {
    storyEl.textContent = analysis.culturalStory || analysis.description || "";
  }

  const enhancedPreview = document.getElementById("enhanced-photo-preview");
  if (enhancedPreview && (state.draft.enhancedImageBase64 || state.draft.rawImageBase64)) {
    enhancedPreview.src = state.draft.enhancedImageBase64 || state.draft.rawImageBase64;
  }

  const confidenceScore = typeof analysis.confidence_score === "number" ? analysis.confidence_score : 0.90;
  const isHighConfidence = confidenceScore >= 0.85;

  if (confBadge && confText) {
    if (isHighConfidence) {
      confBadge.className = "px-3 py-1 rounded-full bg-[#89977B]/20 text-[#414A37] text-xs font-semibold flex items-center gap-1";
      confText.textContent = `${Math.round(confidenceScore * 100)}% Match`;
    } else {
      confBadge.className = "px-3 py-1 rounded-full bg-[#E9DFD0] text-[#B9674B] text-xs font-semibold flex items-center gap-1";
      confText.textContent = `${Math.round(confidenceScore * 100)}% Please Check`;
    }
  }

  if (giStatusText) {
    const giStatus = analysis.gi_status || (analysis.hasGiTag ? "OFFICIALLY_VERIFIED" : "ESTIMATED_UNVERIFIED");
    giStatusText.textContent = giStatus === "OFFICIALLY_VERIFIED" ? "Verified Heritage" : "Estimated";
  }

  const warnings = Array.isArray(analysis.guardrail_warnings) ? analysis.guardrail_warnings : [];
  if (guardrailBanner) {
    if (!isHighConfidence || warnings.length > 0 || analysis.gi_status === "ESTIMATED_UNVERIFIED") {
      guardrailBanner.classList.remove("hidden");
      if (guardrailDesc) {
        if (!isHighConfidence) {
          guardrailDesc.textContent = `Please review the materials and craft name carefully in the next step before publishing.`;
        } else if (warnings.length > 0) {
          guardrailDesc.textContent = warnings.join(" • ");
        } else {
          guardrailDesc.textContent = "Heritage tag is estimated based on craft style. You can confirm or edit in the next step.";
        }
      }
      if (verificationNoticeEl && analysis.verification_notice) {
        verificationNoticeEl.textContent = analysis.verification_notice;
      }
    } else {
      guardrailBanner.classList.add("hidden");
    }
  }

  if (analysis.suggestedMaterialCost) {
    const matInput = document.getElementById("input-calc-material");
    if (matInput) matInput.value = analysis.suggestedMaterialCost;
  }
  if (analysis.suggestedLaborHours) {
    const hoursInput = document.getElementById("input-calc-hours");
    if (hoursInput) hoursInput.value = analysis.suggestedLaborHours;
  }
  if (analysis.suggestedHourlyRate) {
    const wageInput = document.getElementById("input-calc-wage");
    if (wageInput) wageInput.value = analysis.suggestedHourlyRate;
  }

  const reviewTitle = document.getElementById("input-review-title");
  const reviewDesc = document.getElementById("input-review-desc");
  if (reviewTitle) reviewTitle.value = analysis.title || "";
  if (reviewDesc) reviewDesc.value = `${analysis.description}\n\nCraft Story:\n${analysis.culturalStory}`;

  recalculatePricing();
}

function applyBackgroundStyle(style) {
  const previewImg = document.getElementById("enhanced-photo-preview");
  if (!previewImg || !state.draft.rawImageBase64) return;

  applyStudioEnhancement(state.draft.rawImageBase64, style, (enhancedDataUrl) => {
    state.draft.enhancedImageBase64 = enhancedDataUrl;
    previewImg.src = enhancedDataUrl;
  });
}

// ==============================================================================
// 6. SMART FAIR-PRICING CALCULATOR
// ==============================================================================
function setupPricingCalculator() {
  const matInput = document.getElementById("input-calc-material");
  const hoursInput = document.getElementById("input-calc-hours");
  const wageInput = document.getElementById("input-calc-wage");
  const overheadInput = document.getElementById("input-calc-overhead");
  const marginInput = document.getElementById("input-calc-margin");

  [matInput, hoursInput, wageInput, overheadInput, marginInput].forEach(inp => {
    if (inp) {
      inp.addEventListener("input", recalculatePricing);
    }
  });
}

function recalculatePricing() {
  const matCost = Number(document.getElementById("input-calc-material")?.value || 300);
  const hours = Number(document.getElementById("input-calc-hours")?.value || 12);
  const wage = Number(document.getElementById("input-calc-wage")?.value || 85);
  const overhead = Number(document.getElementById("input-calc-overhead")?.value || 100);
  const margin = Number(document.getElementById("input-calc-margin")?.value || 25);

  const directLabor = hours * wage;
  const baseCost = matCost + directLabor + overhead;
  const profit = Math.round((baseCost * margin) / 100);
  const finalPrice = Math.round(baseCost + profit);
  const retailBenchmark = Math.round(finalPrice * 1.55);
  const takeHome = Math.round(directLabor + profit);

  state.draft.pricing = {
    materialCost: matCost,
    laborHours: hours,
    hourlyRate: wage,
    overheadCost: overhead,
    profitMarginPercent: margin,
    finalPrice,
    marketBenchmark: retailBenchmark
  };

  const priceDisplay = document.getElementById("disp-fair-price");
  const retailDisplay = document.getElementById("disp-market-benchmark");
  const takeHomeDisplay = document.getElementById("disp-artisan-earnings");
  const reviewPriceDisplay = document.getElementById("review-final-price-badge");

  if (priceDisplay) priceDisplay.textContent = `₹${finalPrice.toLocaleString("en-IN")}`;
  if (retailDisplay) retailDisplay.textContent = `₹${retailBenchmark.toLocaleString("en-IN")}`;
  if (takeHomeDisplay) takeHomeDisplay.textContent = `₹${takeHome.toLocaleString("en-IN")}`;
  if (reviewPriceDisplay) reviewPriceDisplay.textContent = `₹${finalPrice.toLocaleString("en-IN")}`;
}

// ==============================================================================
// 7. REVIEW, EDIT & PUBLISH
// ==============================================================================
async function translateReviewDetails() {
  const select = document.getElementById("review-translate-lang");
  const targetLang = select?.value || "hi";
  const descInput = document.getElementById("input-review-desc");
  if (!descInput || !descInput.value) return;

  const btn = document.getElementById("btn-translate-review");
  if (btn) btn.textContent = "Translating...";

  try {
    const res = await fetch("/api/ai/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: descInput.value,
        targetLanguage: targetLang
      })
    });
    const data = await res.json();
    if (data.success && data.translatedText) {
      descInput.value = data.translatedText;
      showToast("Story translated!", "success");
    } else {
      showToast("Translation is unavailable right now.", "warning");
    }
  } catch (e) {
    console.warn("Translation failed:", e);
    showToast("Could not connect to translation service.", "warning");
  } finally {
    if (btn) btn.textContent = "Translate";
  }
}

function setupAudioTTS() {
  const btnTTS = document.getElementById("btn-tts-read-story");
  if (btnTTS) {
    btnTTS.addEventListener("click", () => {
      const descInput = document.getElementById("input-review-desc");
      const textToRead = descInput?.value || "";
      if (!textToRead) return;

      if (!window.speechSynthesis) {
        showToast("Voice reading is not supported in this browser.", "warning");
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToRead);
      const langMap = { hi: "hi-IN", bn: "bn-IN", mr: "mr-IN", ta: "ta-IN", te: "te-IN", gu: "gu-IN", en: "en-IN" };
      utterance.lang = langMap[state.currentLang] || "hi-IN";
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    });
  }
}

async function publishDraftProduct() {
  const titleInput = document.getElementById("input-review-title");
  const descInput = document.getElementById("input-review-desc");

  const title = titleInput?.value.trim() || state.draft.analysis?.title || "Artisan Handcrafted Creation";
  const description = descInput?.value.trim() || state.draft.analysis?.description || "";
  const category = state.draft.analysis?.category || "Paintings & Folk Art";
  const materials = state.draft.analysis?.materials || ["Natural Material"];
  const finalPrice = state.draft.pricing.finalPrice || 1800;

  const payload = {
    artisanId: state.currentArtisan.id,
    title,
    category,
    materials,
    primaryColors: state.draft.analysis?.primaryColors || ["Earthy"],
    craftTechnique: state.draft.analysis?.craftTechnique || "Handcrafted",
    description,
    culturalStory: state.draft.analysis?.culturalStory || "",
    tags: state.draft.analysis?.tags || ["Handmade", "ArtisanDirect"],
    materialCost: state.draft.pricing.materialCost,
    laborHours: state.draft.pricing.laborHours,
    hourlyRate: state.draft.pricing.hourlyRate,
    overheadCost: state.draft.pricing.overheadCost,
    profitMarginPercent: state.draft.pricing.profitMarginPercent,
    finalPrice,
    marketBenchmarkPrice: state.draft.pricing.marketBenchmark,
    imageUrl: state.draft.rawImageBase64 || "./assets/artisan_logo.jpg",
    enhancedImageUrl: state.draft.enhancedImageBase64 || state.draft.rawImageBase64 || "./assets/artisan_logo.jpg",
    backgroundStyle: state.draft.backgroundStyle,
    originState: state.currentArtisan.state || "Bihar",
    hasGiTag: Boolean(state.draft.analysis?.hasGiTag),
    isInStock: true,
    isApprovedByArtisan: true
  };

  let createdProduct = null;
  try {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.product) {
        createdProduct = data.product;
      }
    }
  } catch {
    // Fallback below if running statically without backend
  }

  if (!createdProduct) {
    createdProduct = {
      id: `prod-${Date.now()}`,
      ...payload,
      createdAt: new Date().toISOString()
    };
  }

  state.products.unshift(createdProduct);
  saveLocalProducts();
  showToast(t("publishSuccess"), "success");

  openMarketCardModal(createdProduct);
  resetWizard();
  renderDashboard();
  renderCatalog();
  renderArtisanStudio();
}

function resetWizard() {
  state.draft.rawImageBase64 = "";
  state.draft.enhancedImageBase64 = "";
  state.draft.analysis = null;
  const photoPreview = document.getElementById("photo-preview-container");
  if (photoPreview) photoPreview.classList.add("hidden");
  goToWizardStep(1);
}

// ==============================================================================
// 8. MARKET-READY PRINTABLE CARD MODAL
// ==============================================================================
function openMarketCardModal(product) {
  const modal = document.getElementById("market-card-modal");
  const cardCanvasPreview = document.getElementById("market-card-preview-img");
  const downloadBtn = document.getElementById("btn-download-stall-card");
  const closeBtn = document.getElementById("btn-close-card-modal");

  if (!modal || !cardCanvasPreview) return;

  generateMarketStallCard(product, state.currentArtisan, (cardDataUrl) => {
    cardCanvasPreview.src = cardDataUrl;
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        const link = document.createElement("a");
        link.download = `Artisan-${product.title.slice(0, 20).replace(/\s+/g, "_")}.png`;
        link.href = cardDataUrl;
        link.click();
      };
    }
  });

  modal.classList.remove("hidden");
  if (closeBtn) {
    closeBtn.onclick = () => modal.classList.add("hidden");
  }
}

// ==============================================================================
// 9. PRODUCT MANAGEMENT, FILTERS & EDIT MODAL
// ==============================================================================
async function fetchProducts() {
  try {
    const res = await fetch("/api/products");
    if (!res.ok) return;
    const data = await res.json();
    if (data.products && Array.isArray(data.products)) {
      state.products = data.products;
      renderHomeFeaturedProducts();
      renderPublicExplore();
      if (state.currentRoute?.name === "product" && state.currentRoute?.params?.id) {
        renderPublicProductDetail(state.currentRoute.params.id);
      }
      renderDashboard();
      renderCatalog();
      renderArtisanStudio();
    }
  } catch (e) {
    console.warn("Using local product catalog:", e);
  }
}

function setupCatalogFilters() {
  const searchInput = document.getElementById("catalog-search-input");
  const categorySelect = document.getElementById("catalog-category-filter");
  const stateSelect = document.getElementById("catalog-state-filter");
  const priceSlider = document.getElementById("catalog-price-slider");
  const priceValueLabel = document.getElementById("catalog-price-val");
  const statusButtons = document.querySelectorAll(".catalog-status-btn");

  if (categorySelect) {
    categorySelect.innerHTML = CRAFT_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");
    categorySelect.addEventListener("change", (e) => {
      state.selectedCategory = e.target.value;
      renderCatalog();
    });
  }

  if (stateSelect) {
    stateSelect.innerHTML = INDIAN_STATES.map(s => `<option value="${s}">${s}</option>`).join("");
    stateSelect.addEventListener("change", (e) => {
      state.selectedState = e.target.value;
      renderCatalog();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      renderCatalog();
    });
  }

  if (priceSlider) {
    priceSlider.addEventListener("input", (e) => {
      state.maxPrice = Number(e.target.value);
      if (priceValueLabel) priceValueLabel.textContent = `₹${state.maxPrice.toLocaleString("en-IN")}`;
      renderCatalog();
    });
  }

  statusButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      state.selectedStatus = btn.getAttribute("data-status") || "all";
      statusButtons.forEach(b => {
        const active = b === btn;
        b.classList.toggle("bg-[#B8C77B]", active);
        b.classList.toggle("text-[#292929]", active);
        b.classList.toggle("bg-[#FAFAF8]", !active);
        b.classList.toggle("border", !active);
        b.classList.toggle("border-[#E6E4DD]", !active);
      });
      renderCatalog();
    });
  });
}

function renderCatalog() {
  const grid = document.getElementById("catalog-products-grid");
  const countEl = document.getElementById("catalog-results-count");
  if (!grid) return;

  const q = state.searchQuery.toLowerCase().trim();
  const filtered = state.products.filter(p => {
    const isPublished = p.isApprovedByArtisan !== false;
    const matchesStatus =
      state.selectedStatus === "all" ||
      (state.selectedStatus === "published" && isPublished) ||
      (state.selectedStatus === "pending" && !isPublished);
    const matchesCat = state.selectedCategory === "All Categories" || p.category.toLowerCase() === state.selectedCategory.toLowerCase();
    const matchesState = state.selectedState === "All States" || (p.originState && p.originState.toLowerCase() === state.selectedState.toLowerCase());
    const matchesPrice = p.finalPrice <= state.maxPrice;
    const matchesSearch = !q ||
      p.title.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.originState && p.originState.toLowerCase().includes(q)) ||
      (Array.isArray(p.tags) && p.tags.some(t => t.toLowerCase().includes(q))) ||
      (p.description && p.description.toLowerCase().includes(q));

    return matchesStatus && matchesCat && matchesState && matchesPrice && matchesSearch;
  });

  if (countEl) {
    countEl.textContent = `${filtered.length} ${filtered.length === 1 ? "Product" : "Products"}`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-14 px-6 bg-white rounded-3xl border border-[#DDD3C3] text-center space-y-3">
        <div class="text-3xl">🏺</div>
        <p class="font-serif text-lg font-bold text-[#34332F]">No matching products found</p>
        <p class="text-xs sm:text-sm text-[#66625A]">Try clearing your search or choosing "All Categories".</p>
        <button type="button" id="btn-reset-catalog-filters" class="px-5 py-2.5 rounded-xl bg-[#414A37] text-white text-xs font-semibold cursor-pointer">
          Show All Products
        </button>
      </div>
    `;
    document.getElementById("btn-reset-catalog-filters")?.addEventListener("click", () => {
      state.searchQuery = "";
      state.selectedCategory = "All Categories";
      state.selectedState = "All States";
      state.selectedStatus = "all";
      state.maxPrice = 10000;
      const searchEl = document.getElementById("catalog-search-input");
      const catEl = document.getElementById("catalog-category-filter");
      const stateEl = document.getElementById("catalog-state-filter");
      const sliderEl = document.getElementById("catalog-price-slider");
      const valEl = document.getElementById("catalog-price-val");
      if (searchEl) searchEl.value = "";
      if (catEl) catEl.value = "All Categories";
      if (stateEl) stateEl.value = "All States";
      if (sliderEl) sliderEl.value = "10000";
      if (valEl) valEl.textContent = "₹10,000";
      document.querySelector(".catalog-status-btn[data-status='all']")?.click();
      renderCatalog();
    });
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const artisan = state.artisans.find(a => a.id === p.artisanId) || state.currentArtisan;
    const localizedTitle = (p.titleRegional && p.titleRegional[state.currentLang]) || p.title;
    const isPublished = p.isApprovedByArtisan !== false;

    return `
      <div class="craft-card rounded-2xl overflow-hidden flex flex-col group">
        <div class="relative aspect-[4/3] bg-[#F0EFF5] overflow-hidden">
          <img
            src="${p.enhancedImageUrl || p.imageUrl}"
            alt="${escapeHtml(localizedTitle)}"
            loading="lazy"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />
          <span class="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-semibold shadow-xs ${
            isPublished ? "bg-[#DCE5C5] text-[#292929]" : "bg-[#EBC5A9] text-[#292929]"
          }">
            ${isPublished ? "Published" : "Pending Approval"}
          </span>
          ${p.hasGiTag ? `
            <span class="absolute bottom-3 left-3 bg-white/95 text-[#292929] text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-[#E6E4DD]">
              GI Heritage
            </span>
          ` : ""}
          <span class="absolute bottom-3 right-3 bg-white/95 text-[#292929] text-[11px] font-medium px-2.5 py-0.5 rounded-full border border-[#E6E4DD]">
            ${escapeHtml(p.originState || "India")}
          </span>
        </div>

        <div class="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
          <div>
            <div class="flex items-center justify-between text-[11px] text-[#3F4D22] font-semibold uppercase tracking-wide mb-1">
              <span class="truncate">${escapeHtml(p.category)}</span>
              <span class="text-[#5C5C57] font-normal truncate ml-2">${escapeHtml(artisan.fullName)}</span>
            </div>
            <h3 class="font-serif font-bold text-[#292929] text-base leading-snug line-clamp-2">
              ${escapeHtml(localizedTitle)}
            </h3>
          </div>

          <div class="space-y-3 pt-3 border-t border-[#E6E4DD]">
            <div class="flex items-baseline justify-between">
              <span class="text-xs text-[#5C5C57]">Suggested Price</span>
              <span class="font-serif text-lg font-bold text-[#292929]">₹${Number(p.finalPrice).toLocaleString("en-IN")}</span>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-action="view-product"
                data-id="${p.id}"
                class="min-h-[40px] px-3 py-2 rounded-xl bg-[#FAFAF8] hover:bg-[#DCE5C5] text-[#292929] text-xs font-semibold border border-[#E6E4DD] transition-colors cursor-pointer"
              >
                View
              </button>
              <button
                type="button"
                data-action="edit-product"
                data-id="${p.id}"
                class="min-h-[40px] px-3 py-2 rounded-xl bg-[#B8C77B] hover:bg-[#a6b668] text-[#292929] text-xs font-semibold transition-colors cursor-pointer"
              >
                Edit
              </button>
            </div>

            <div class="flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                data-action="share-card"
                data-id="${p.id}"
                class="flex-1 py-1.5 rounded-lg text-[#3F4D22] hover:bg-[#DCE5C5]/50 font-medium cursor-pointer"
                title="Download Printable Card"
              >
                Share Card
              </button>
              <button
                type="button"
                data-action="open-inquiry"
                data-id="${p.id}"
                class="flex-1 py-1.5 rounded-lg text-[#292929] hover:bg-[#EBC5A9]/50 font-semibold cursor-pointer"
              >
                Buyer Enquiry
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  grid.querySelectorAll("button[data-action='view-product']").forEach(btn => {
    btn.addEventListener("click", () => {
      const prod = state.products.find(p => p.id === btn.getAttribute("data-id"));
      if (prod) openProductDetailModal(prod);
    });
  });

  grid.querySelectorAll("button[data-action='edit-product']").forEach(btn => {
    btn.addEventListener("click", () => {
      const prod = state.products.find(p => p.id === btn.getAttribute("data-id"));
      if (prod) openEditProductModal(prod);
    });
  });

  grid.querySelectorAll("button[data-action='share-card']").forEach(btn => {
    btn.addEventListener("click", () => {
      const prod = state.products.find(p => p.id === btn.getAttribute("data-id"));
      if (prod) openMarketCardModal(prod);
    });
  });

  grid.querySelectorAll("button[data-action='open-inquiry']").forEach(btn => {
    btn.addEventListener("click", () => {
      const prod = state.products.find(p => p.id === btn.getAttribute("data-id"));
      if (prod) openInquiryModal(prod);
    });
  });
}

function setupEditProductModal() {
  const modal = document.getElementById("product-edit-modal");
  const form = document.getElementById("product-edit-form");
  const closeBtn = document.getElementById("btn-close-edit-modal");
  const cancelBtn = document.getElementById("btn-cancel-edit-modal");
  const categorySelect = document.getElementById("edit-prod-category");

  if (categorySelect) {
    const editableCats = CRAFT_CATEGORIES.filter(c => c !== "All Categories");
    categorySelect.innerHTML = editableCats.map(c => `<option value="${c}">${c}</option>`).join("");
  }

  closeBtn?.addEventListener("click", () => modal?.classList.add("hidden"));
  cancelBtn?.addEventListener("click", () => modal?.classList.add("hidden"));

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("edit-prod-id")?.value;
    const title = document.getElementById("edit-prod-title")?.value.trim();
    const category = document.getElementById("edit-prod-category")?.value;
    const finalPrice = Number(document.getElementById("edit-prod-price")?.value || 0);
    const statusVal = document.getElementById("edit-prod-status")?.value;
    const description = document.getElementById("edit-prod-desc")?.value.trim() || "";

    if (!id || !title || finalPrice <= 0) {
      showToast("Please enter a valid product name and price.", "warning");
      return;
    }

    const idx = state.products.findIndex(p => p.id === id);
    if (idx === -1) return;

    const updatedFields = {
      title,
      category,
      finalPrice,
      description,
      isApprovedByArtisan: statusVal === "published"
    };

    state.products[idx] = { ...state.products[idx], ...updatedFields };
    saveLocalProducts();

    try {
      await fetch(`/api/products/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields)
      });
    } catch {
      // Local state & storage remain updated even on static hosting
    }

    modal?.classList.add("hidden");
    showToast(`Saved changes to "${title}".`, "success");
    renderDashboard();
    renderCatalog();
    renderArtisanStudio();
    renderArtisanProfilePage();
  });
}

function openEditProductModal(product) {
  const modal = document.getElementById("product-edit-modal");
  if (!modal) return;

  document.getElementById("edit-prod-id").value = product.id;
  document.getElementById("edit-prod-title").value = product.title || "";
  document.getElementById("edit-prod-category").value = product.category || "Paintings & Folk Art";
  document.getElementById("edit-prod-price").value = Number(product.finalPrice) || 1000;
  document.getElementById("edit-prod-status").value = product.isApprovedByArtisan !== false ? "published" : "pending";
  document.getElementById("edit-prod-desc").value = product.description || "";

  modal.classList.remove("hidden");
}

// ==============================================================================
// 10. PRODUCT DETAIL MODAL
// ==============================================================================
function openProductDetailModal(product) {
  const modal = document.getElementById("product-detail-modal");
  if (!modal) return;

  const artisan = state.artisans.find(a => a.id === product.artisanId) || state.currentArtisan;
  const localizedTitle = (product.titleRegional && product.titleRegional[state.currentLang]) || product.title;

  document.getElementById("detail-modal-img").src = product.enhancedImageUrl || product.imageUrl;
  document.getElementById("detail-modal-title").textContent = localizedTitle;
  document.getElementById("detail-modal-category").textContent = product.category;
  document.getElementById("detail-modal-price").textContent = `₹${Number(product.finalPrice).toLocaleString("en-IN")}`;
  document.getElementById("detail-modal-desc").textContent = product.description;
  document.getElementById("detail-modal-story").textContent = product.culturalStory || "Handcrafted according to ancestral traditions.";
  document.getElementById("detail-modal-artisan-name").textContent = artisan.fullName;
  document.getElementById("detail-modal-artisan-village").textContent = `${artisan.districtVillage || artisan.state} • ${artisan.yearsExperience} yrs experience`;

  const modalArtisanImg = document.getElementById("detail-modal-artisan-img");
  if (modalArtisanImg) {
    modalArtisanImg.src = artisan.profileImage || "./assets/sitadevi_profile.jpg";
  }

  // WhatsApp click to chat
  const waBtn = document.getElementById("detail-btn-whatsapp");
  if (waBtn) {
    const rawPhone = (artisan.phone || "").replace(/\D/g, "");
    const waText = encodeURIComponent(`Namaste ${artisan.fullName}! I am interested in your handcrafted item "${product.title}" listed on Artisan for ₹${product.finalPrice}. Is it available for order?`);
    waBtn.onclick = () => {
      window.open(`https://wa.me/${rawPhone || "919876543210"}?text=${waText}`, "_blank");
    };
  }

  // Call Artisan
  const callBtn = document.getElementById("detail-btn-call");
  if (callBtn) {
    callBtn.onclick = () => {
      window.location.href = `tel:${artisan.phone || "+919876543210"}`;
    };
  }

  // Inquire button
  const inqBtn = document.getElementById("detail-btn-inquiry");
  if (inqBtn) {
    inqBtn.onclick = () => {
      modal.classList.add("hidden");
      openInquiryModal(product);
    };
  }

  modal.classList.remove("hidden");
  document.getElementById("btn-close-detail-modal").onclick = () => modal.classList.add("hidden");
}

// ==============================================================================
// 11. BUYER INQUIRY & ORDER MODAL
// ==============================================================================
let activeInquiryProduct = null;
function setupInquiryModal() {
  const form = document.getElementById("buyer-inquiry-form");
  const closeBtn = document.getElementById("btn-close-inquiry-modal");
  const modal = document.getElementById("buyer-inquiry-modal");

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const buyerName = document.getElementById("inq-buyer-name")?.value;
      const buyerPhone = document.getElementById("inq-buyer-phone")?.value;
      const buyerLocation = document.getElementById("inq-buyer-location")?.value;
      const quantity = document.getElementById("inq-quantity")?.value;
      const message = document.getElementById("inq-message")?.value;

      if (!buyerName || !buyerPhone) {
        showToast("Please enter your name and phone number.", "warning");
        return;
      }

      const payload = {
        productId: activeInquiryProduct?.id,
        artisanId: activeInquiryProduct?.artisanId || "artisan-1",
        buyerName,
        buyerPhone,
        buyerLocation,
        quantity: Number(quantity) || 1,
        message
      };

      let savedInquiry = null;
      try {
        const res = await fetch("/api/inquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.inquiry) {
            savedInquiry = data.inquiry;
          }
        }
      } catch {
        // Fallback below on static hosting
      }

      if (!savedInquiry) {
        savedInquiry = {
          id: `inq-${Date.now()}`,
          ...payload,
          status: "pending",
          createdAt: new Date().toISOString()
        };
      }

      state.inquiries.unshift(savedInquiry);
      saveLocalInquiries();
      showToast(t("inquirySuccess"), "success");
      modal.classList.add("hidden");
      form.reset();
      renderDashboard();
      renderArtisanStudio();
    });
  }
}

function openInquiryModal(product) {
  activeInquiryProduct = product;
  const modal = document.getElementById("buyer-inquiry-modal");
  const titleEl = document.getElementById("inq-product-title-display");
  const priceEl = document.getElementById("inq-product-price-display");

  if (titleEl) titleEl.textContent = product.title;
  if (priceEl) priceEl.textContent = `₹${Number(product.finalPrice).toLocaleString("en-IN")}`;

  if (modal) modal.classList.remove("hidden");
}

// ==============================================================================
// 12. ARTISAN STUDIO & BUYER ENQUIRIES
// ==============================================================================
async function fetchInquiries() {
  try {
    const res = await fetch("/api/inquiries");
    if (!res.ok) return;
    const data = await res.json();
    if (data.inquiries && Array.isArray(data.inquiries)) {
      state.inquiries = data.inquiries;
      renderDashboard();
      renderArtisanStudio();
    }
  } catch (e) {
    console.warn("Could not fetch inquiries:", e);
  }
}

function buildInquiriesListHTML() {
  if (state.inquiries.length === 0) {
    return `
      <div class="p-8 text-center bg-white rounded-2xl border border-[#E6E4DD] space-y-2">
        <p class="font-serif font-bold text-[#292929]">No buyer enquiries yet</p>
        <p class="text-xs sm:text-sm text-[#5C5C57]">When buyers ask about your products, their phone and WhatsApp details will appear here.</p>
      </div>
    `;
  }

  return state.inquiries.map(inq => {
    const prod = state.products.find(p => p.id === inq.productId) || { title: "Handcrafted Product", finalPrice: 0 };
    const rawPhone = (inq.buyerPhone || "").replace(/\D/g, "");
    const waLink = `https://wa.me/${rawPhone}?text=${encodeURIComponent(`Namaste ${inq.buyerName}, thank you for asking about our handcrafted ${prod.title}. I am happy to help with your order!`)}`;

    return `
      <div class="p-4 sm:p-5 bg-white rounded-2xl border border-[#E6E4DD] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-serif font-bold text-[#292929] text-sm sm:text-base">${escapeHtml(inq.buyerName)}</span>
            <span class="text-xs px-2.5 py-0.5 rounded-full bg-[#EBC5A9] text-[#292929] font-semibold">${inq.quantity || 1} unit(s)</span>
            <span class="text-[11px] px-2 py-0.5 rounded-full bg-[#DCE5C5] text-[#292929] font-semibold">New</span>
            <span class="text-[11px] text-[#5C5C57]">${new Date(inq.createdAt).toLocaleDateString()}</span>
          </div>
          <div class="text-xs sm:text-sm text-[#292929] font-medium">
            Product: ${escapeHtml(prod.title)} (₹${Number(prod.finalPrice).toLocaleString("en-IN")})
          </div>
          <div class="text-xs text-[#5C5C57]">
            ${escapeHtml(inq.buyerLocation || "India")} • "${escapeHtml(inq.message || "Interested in ordering")}"
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <a href="${waLink}" target="_blank" class="px-4 py-2.5 rounded-xl bg-[#B8C77B] hover:bg-[#a6b668] text-[#292929] text-xs font-semibold transition-colors">
            WhatsApp
          </a>
          <a href="tel:${escapeHtml(inq.buyerPhone)}" class="px-4 py-2.5 rounded-xl bg-[#FAFAF8] hover:bg-[#DCE5C5] text-[#292929] border border-[#E6E4DD] text-xs font-semibold transition-colors">
            Call
          </a>
        </div>
      </div>
    `;
  }).join("");
}

function renderArtisanStudio() {
  const listingsCount = document.getElementById("studio-listings-count");
  const inquiriesCount = document.getElementById("studio-inquiries-count");
  const inquiriesList = document.getElementById("studio-inquiries-list");
  const inquiriesPageList = document.getElementById("inquiries-page-list");
  const studioProductsList = document.getElementById("studio-products-list");
  const studioAvatar = document.getElementById("artisan-profile-avatar");

  if (studioAvatar && state.currentArtisan?.profileImage) {
    studioAvatar.src = state.currentArtisan.profileImage;
  }

  const myCrafts = state.products.filter(p => p.artisanId === state.currentArtisan.id);
  if (listingsCount) listingsCount.textContent = String(myCrafts.length);
  if (inquiriesCount) inquiriesCount.textContent = String(state.inquiries.length);

  if (studioProductsList) {
    if (myCrafts.length === 0) {
      studioProductsList.innerHTML = `
        <div class="col-span-full p-6 bg-white rounded-2xl border border-[#E6E4DD] text-center text-xs sm:text-sm text-[#5C5C57]">
          No products in your studio yet. Tap "Add New Product" to create one.
        </div>
      `;
    } else {
      studioProductsList.innerHTML = myCrafts.map(p => {
        const isPublished = p.isApprovedByArtisan !== false;
        return `
          <div class="craft-card rounded-2xl overflow-hidden flex flex-col">
            <div class="relative aspect-[4/3] bg-[#F0EFF5] overflow-hidden">
              <img src="${p.enhancedImageUrl || p.imageUrl}" alt="${escapeHtml(p.title)}" class="w-full h-full object-cover" />
              <span class="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                isPublished ? "bg-[#DCE5C5] text-[#292929]" : "bg-[#EBC5A9] text-[#292929]"
              }">
                ${isPublished ? "Published" : "Pending"}
              </span>
            </div>
            <div class="p-4 flex-1 flex flex-col justify-between gap-3">
              <div>
                <div class="text-[11px] font-semibold text-[#3F4D22] uppercase">${escapeHtml(p.category)}</div>
                <h4 class="font-serif font-bold text-sm text-[#292929] line-clamp-1 mt-0.5">${escapeHtml(p.title)}</h4>
                <div class="font-serif text-base font-bold text-[#292929] mt-1">₹${Number(p.finalPrice).toLocaleString("en-IN")}</div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <button type="button" data-studio-view="${p.id}" class="py-2 rounded-xl bg-[#FAFAF8] hover:bg-[#DCE5C5] text-[#292929] text-xs font-semibold border border-[#E6E4DD] cursor-pointer">View</button>
                <button type="button" data-studio-edit="${p.id}" class="py-2 rounded-xl bg-[#B8C77B] hover:bg-[#a6b668] text-[#292929] text-xs font-semibold cursor-pointer">Edit</button>
              </div>
            </div>
          </div>
        `;
      }).join("");

      studioProductsList.querySelectorAll("[data-studio-view]").forEach(btn => {
        btn.addEventListener("click", () => {
          const prod = state.products.find(p => p.id === btn.getAttribute("data-studio-view"));
          if (prod) openProductDetailModal(prod);
        });
      });

      studioProductsList.querySelectorAll("[data-studio-edit]").forEach(btn => {
        btn.addEventListener("click", () => {
          const prod = state.products.find(p => p.id === btn.getAttribute("data-studio-edit"));
          if (prod) openEditProductModal(prod);
        });
      });
    }
  }

  const inquiriesHTML = buildInquiriesListHTML();
  if (inquiriesList) inquiriesList.innerHTML = inquiriesHTML;
  if (inquiriesPageList) inquiriesPageList.innerHTML = inquiriesHTML;
}

// ==============================================================================
// 12B. ARTISAN PROFILE PAGE & SETTINGS PAGE
// ==============================================================================
function renderArtisanProfilePage() {
  const profileGrid = document.getElementById("artisan-profile-products-grid");
  if (!profileGrid) return;

  const artisanProducts = state.products.filter(p => p.artisanId === "artisan-1");
  profileGrid.innerHTML = artisanProducts.map(p => {
    const localizedTitle = (p.titleRegional && p.titleRegional[state.currentLang]) || p.title;
    return `
      <div class="craft-card rounded-2xl overflow-hidden flex flex-col group">
        <div class="relative aspect-[4/3] bg-[#E9DFD0] overflow-hidden">
          <img src="${p.enhancedImageUrl || p.imageUrl}" alt="${escapeHtml(localizedTitle)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ${p.hasGiTag ? `
            <span class="absolute top-3 left-3 bg-[#F8F5EF]/95 text-[#B9674B] border border-[#DDD3C3] text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
              GI Heritage
            </span>
          ` : ""}
        </div>
        <div class="p-4 flex-1 flex flex-col justify-between">
          <div>
            <div class="text-xs text-[#89977B] font-semibold uppercase mb-1">${escapeHtml(p.category)}</div>
            <h4 class="font-serif font-bold text-[#34332F] text-sm leading-snug line-clamp-2 mb-2">${escapeHtml(localizedTitle)}</h4>
          </div>
          <div class="pt-3 border-t border-[#EAE2D5] flex items-center justify-between">
            <div class="font-serif text-base font-bold text-[#414A37]">₹${Number(p.finalPrice).toLocaleString("en-IN")}</div>
            <button data-action="view-product" data-id="${p.id}" class="px-3.5 py-1.5 rounded-xl bg-[#414A37] text-white text-xs font-semibold hover:bg-[#32392A] cursor-pointer">
              View
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  profileGrid.querySelectorAll("button[data-action='view-product']").forEach(btn => {
    btn.addEventListener("click", () => {
      const prod = state.products.find(p => p.id === btn.getAttribute("data-id"));
      if (prod) openProductDetailModal(prod);
    });
  });

  const waBtn = document.getElementById("artisan-profile-whatsapp");
  if (waBtn) {
    const rawPhone = (state.currentArtisan.phone || "").replace(/\D/g, "");
    waBtn.onclick = () => {
      const waText = encodeURIComponent(`Namaste Sitadevi Devi! I came across your profile on Artisan and would love to know more about your Madhubani paintings.`);
      window.open(`https://wa.me/${rawPhone || "919876543210"}?text=${waText}`, "_blank");
    };
  }

  const callBtn = document.getElementById("artisan-profile-call");
  if (callBtn) {
    callBtn.onclick = () => {
      window.location.href = `tel:${state.currentArtisan.phone || "+919876543210"}`;
    };
  }
}

function renderSettingsPage() {
  const settingsLang = document.getElementById("settings-lang-select");
  if (settingsLang) {
    settingsLang.innerHTML = SUPPORTED_LANGUAGES.map(
      l => `<option value="${l.code}" ${l.code === state.currentLang ? "selected" : ""}>${l.name} (${l.label})</option>`
    ).join("");
    settingsLang.onchange = (e) => {
      state.currentLang = e.target.value;
      const topSelect = document.getElementById("lang-select");
      if (topSelect) topSelect.value = state.currentLang;
      applyTranslations();
      syncAdvisorLangToggle();
      renderDashboard();
      renderCatalog();
      renderArtisanStudio();
    };
  }

  const contrastToggle = document.getElementById("settings-contrast-toggle");
  if (contrastToggle) {
    contrastToggle.checked = state.isHighContrast;
    contrastToggle.onchange = () => {
      state.isHighContrast = contrastToggle.checked;
      document.body.classList.toggle("high-contrast", state.isHighContrast);
    };
  }

  const fontToggle = document.getElementById("settings-font-toggle");
  if (fontToggle) {
    fontToggle.checked = state.isLargeFont;
    fontToggle.onchange = () => {
      state.isLargeFont = fontToggle.checked;
      document.body.classList.toggle("large-text", state.isLargeFont);
    };
  }

  const roleSelect = document.getElementById("settings-role-select");
  if (roleSelect) {
    roleSelect.value = state.userRole;
    roleSelect.onchange = () => {
      state.userRole = roleSelect.value;
      updateRoleBadge();
    };
  }

  const syncBtn = document.getElementById("settings-btn-sync-now");
  if (syncBtn) {
    syncBtn.onclick = () => {
      saveLocalProducts();
      saveLocalInquiries();
      showToast("All saved products and enquiries are backed up on this device.", "success");
    };
  }
}

// ==============================================================================
// 10. INTERACTIVE AI ARTISAN ADVISOR
// ==============================================================================
let aiChatHistory = [];

function syncAdvisorLangToggle() {
  const btnEn = document.getElementById("advisor-lang-en");
  const btnHi = document.getElementById("advisor-lang-hi");
  if (!btnEn || !btnHi) return;
  const isHi = state.currentLang === "hi";
  btnHi.classList.toggle("bg-[#B8C77B]", isHi);
  btnHi.classList.toggle("text-[#292929]", isHi);
  btnEn.classList.toggle("bg-[#B8C77B]", !isHi);
  btnEn.classList.toggle("text-[#292929]", !isHi);
}

function setupAIChatAdvisor() {
  const chatForm = document.getElementById("ai-chat-form");
  const chatInput = document.getElementById("ai-chat-input");
  const chatMessages = document.getElementById("ai-chat-messages");
  const clearBtn = document.getElementById("btn-clear-ai-chat");
  const micBtn = document.getElementById("btn-ai-chat-mic");
  const promptChips = document.querySelectorAll(".ai-prompt-chip");
  const btnEn = document.getElementById("advisor-lang-en");
  const btnHi = document.getElementById("advisor-lang-hi");

  syncAdvisorLangToggle();

  btnEn?.addEventListener("click", () => {
    state.currentLang = "en";
    const topSelect = document.getElementById("lang-select");
    if (topSelect) topSelect.value = "en";
    applyTranslations();
    syncAdvisorLangToggle();
    showToast("Advisor set to English", "info");
  });

  btnHi?.addEventListener("click", () => {
    state.currentLang = "hi";
    const topSelect = document.getElementById("lang-select");
    if (topSelect) topSelect.value = "hi";
    applyTranslations();
    syncAdvisorLangToggle();
    showToast("सलाहकार अब हिन्दी में उत्तर देंगे", "info");
  });

  promptChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const promptText = chip.getAttribute("data-prompt");
      if (promptText && chatInput) {
        chatInput.value = "";
        submitAIChatMessage(promptText);
      }
    });
  });

  if (chatForm && chatInput) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = "";
      submitAIChatMessage(text);
    });
  }

  if (clearBtn && chatMessages) {
    clearBtn.addEventListener("click", () => {
      aiChatHistory = [];
      chatMessages.innerHTML = `
        <div class="flex items-start gap-3 max-w-2xl">
          <div class="w-8 h-8 rounded-xl bg-[#414A37] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
            AI
          </div>
          <div class="bg-white p-4 rounded-2xl rounded-tl-xs border border-[#DDD3C3] text-xs sm:text-sm text-[#34332F] space-y-2 leading-relaxed">
            <div class="font-serif font-bold text-[#414A37]">Started a fresh conversation.</div>
            <p class="text-[#66625A] text-xs">Ask any question in English or Hindi about fair pricing, craft stories, or connecting with buyers.</p>
          </div>
        </div>
      `;
      showToast("Started a new chat", "info");
    });
  }

  if (micBtn && chatInput) {
    micBtn.addEventListener("click", () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        showToast("Voice input is not supported in this browser. Please type your question.", "info");
        return;
      }
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = state.currentLang === "hi" ? "hi-IN" : "en-IN";
        recognition.interimResults = false;

        micBtn.classList.add("bg-[#B9674B]", "text-white", "animate-pulse");
        showToast("Listening... Please speak your question", "info");

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            chatInput.value = transcript;
            submitAIChatMessage(transcript);
          }
        };

        recognition.onerror = () => {
          micBtn.classList.remove("bg-[#B9674B]", "text-white", "animate-pulse");
          showToast("Voice input stopped.", "info");
        };

        recognition.onend = () => {
          micBtn.classList.remove("bg-[#B9674B]", "text-white", "animate-pulse");
        };

        recognition.start();
      } catch {
        micBtn.classList.remove("bg-[#B9674B]", "text-white", "animate-pulse");
      }
    });
  }
}

async function submitAIChatMessage(messageText) {
  const chatMessages = document.getElementById("ai-chat-messages");
  const chatLoading = document.getElementById("ai-chat-loading");
  if (!chatMessages) return;

  const userBubble = document.createElement("div");
  userBubble.className = "flex items-start justify-end gap-2.5";
  userBubble.innerHTML = `
    <div class="bg-[#DCE5C5] text-[#292929] px-4 py-3 rounded-2xl rounded-tr-xs text-xs sm:text-sm max-w-xl leading-relaxed border border-[#B8C77B]/60">
      ${escapeHtml(messageText)}
    </div>
  `;
  chatMessages.appendChild(userBubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  if (chatLoading) chatLoading.classList.remove("hidden");

  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: messageText,
        history: aiChatHistory,
        language: state.currentLang
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    if (chatLoading) chatLoading.classList.add("hidden");

    const reply = data.reply || data.error || "Sorry, I could not answer right now. Please try again.";

    aiChatHistory.push({ role: "user", text: messageText });
    aiChatHistory.push({ role: "model", text: reply });

    const formattedReply = formatMarkdownSimple(reply);

    const aiBubble = document.createElement("div");
    aiBubble.className = "flex items-start gap-2.5 max-w-2xl";
    aiBubble.innerHTML = `
      <div class="w-8 h-8 rounded-xl bg-[#B8C77B] text-[#292929] flex items-center justify-center text-xs font-bold flex-shrink-0">
        AI
      </div>
      <div class="bg-white p-4 rounded-2xl rounded-tl-xs border border-[#E6E4DD] text-xs sm:text-sm text-[#292929] space-y-2 leading-relaxed">
        <div class="flex items-center justify-between text-[11px] text-[#5C5C57] border-b border-[#E6E4DD] pb-1.5 mb-1 font-medium">
          <span>Artisan Advisor</span>
          <button type="button" class="btn-copy-chat hover:text-[#292929] cursor-pointer" title="Copy answer">Copy</button>
        </div>
        <div class="chat-reply-content">
          ${formattedReply}
        </div>
      </div>
    `;

    const copyBtn = aiBubble.querySelector(".btn-copy-chat");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(reply);
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 2000);
      });
    }

    chatMessages.appendChild(aiBubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch {
    if (chatLoading) chatLoading.classList.add("hidden");
    const errBubble = document.createElement("div");
    errBubble.className = "flex items-start gap-2.5 max-w-2xl";
    errBubble.innerHTML = `
      <div class="w-8 h-8 rounded-xl bg-[#EBC5A9] text-[#292929] flex items-center justify-center text-xs font-bold flex-shrink-0">
        !
      </div>
      <div class="bg-[#EBC5A9]/50 p-4 rounded-2xl rounded-tl-xs border border-[#EBC5A9] text-xs sm:text-sm text-[#292929] leading-relaxed">
        Could not connect to the AI Advisor right now. Please make sure the server is running and try again.
      </div>
    `;
    chatMessages.appendChild(errBubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

function formatMarkdownSimple(text) {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Bullet lines starting with * or -
  html = html.replace(/^\s*[\*\-]\s+(.+)$/gm, '<li class="ml-4 list-disc">$1</li>');

  // Wrap lists
  html = html.replace(/((?:<li.*?>.*?<\/li>\s*)+)/g, '<ul class="my-2 space-y-1">$1</ul>');

  // Paragraphs
  html = html.replace(/\n\n+/g, '<p class="my-2"></p>');
  html = html.replace(/\n/g, '<br />');

  return html;
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

function createCraftSampleCanvas(title, primaryColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 300;
  const ctx = canvas.getContext("2d");
  
  const grad = ctx.createLinearGradient(0, 0, 400, 300);
  grad.addColorStop(0, "#1c1917");
  grad.addColorStop(1, primaryColor || "#78350f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 400, 300);
  
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(200, 140, 80, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.strokeStyle = "rgba(251,191,36,0.6)";
  ctx.lineWidth = 3;
  ctx.stroke();
  
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px serif";
  ctx.textAlign = "center";
  ctx.fillText(title, 200, 140);
  
  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#fef08a";
  ctx.fillText("Traditional Indian Artisan Heritage", 200, 168);
  
  return canvas.toDataURL("image/jpeg", 0.9);
}
