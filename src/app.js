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
  myProducts: [],
  artisans: [...INITIAL_ARTISANS],
  inquiries: [],
  currentArtisan: INITIAL_ARTISANS[0],
  editModalImages: [],
  pendingDeleteProductId: null,

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
  setupEnquiryFiltersAndResponseModal();
  setupArtisanProfileEditor();
  setupHelpSupport();
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

  // Setup Fair Pricing & Offline Sync Suite + Product Sync Bridges
  window.__artisanGetMyProducts = () => getMyProducts();
  window.__artisanGetCurrentId = () => getMyArtisanId();

  window.addEventListener("artisan-price-applied", (e) => {
    const { productId, updates } = e.detail || {};
    if (!productId || !updates) return;
    const mIdx = state.myProducts.findIndex(p => p.id === productId);
    if (mIdx >= 0) state.myProducts[mIdx] = { ...state.myProducts[mIdx], ...updates };
    const pIdx = state.products.findIndex(p => p.id === productId);
    if (pIdx >= 0) state.products[pIdx] = { ...state.products[pIdx], ...updates };
    saveLocalProducts();
    renderHomeFeaturedProducts();
    renderPublicExplore();
    renderDashboard();
    renderCatalog();
    renderArtisanStudio();
  });

  window.addEventListener("artisan-refresh-products", () => {
    fetchProducts();
  });

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
  // Navigation tabs + sidebar collapse + mobile drawer + topbar dropdowns
  const navButtons = document.querySelectorAll(".nav-tab-btn");
  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      if (targetTab) {
        closeMobileDrawer();
        closeTopDropdowns();
        switchTab(targetTab);
      }
    });
  });

  document.getElementById("btn-toggle-sidebar")?.addEventListener("click", () => {
    document.getElementById("artisan-dashboard-shell")?.classList.toggle("sidebar-collapsed");
  });

  document.getElementById("btn-mobile-drawer")?.addEventListener("click", openMobileDrawer);
  document.getElementById("btn-close-mobile-drawer")?.addEventListener("click", closeMobileDrawer);
  document.getElementById("artisan-drawer-backdrop")?.addEventListener("click", closeMobileDrawer);

  const notifBtn = document.getElementById("btn-dash-notifications");
  const notifMenu = document.getElementById("dash-notifications-dropdown");
  const profBtn = document.getElementById("btn-dash-profile-menu");
  const profMenu = document.getElementById("dash-profile-dropdown");

  notifBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    profMenu?.classList.add("hidden");
    notifMenu?.classList.toggle("hidden");
  });

  profBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    notifMenu?.classList.add("hidden");
    profMenu?.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#dash-notifications-dropdown") && !e.target.closest("#btn-dash-notifications")) {
      notifMenu?.classList.add("hidden");
    }
    if (!e.target.closest("#dash-profile-dropdown") && !e.target.closest("#btn-dash-profile-menu")) {
      profMenu?.classList.add("hidden");
    }
  });

  document.getElementById("btn-open-add-product-modal")?.addEventListener("click", () => {
    openAddProductModal();
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

function openMobileDrawer() {
  const sidebar = document.getElementById("artisan-sidebar");
  const backdrop = document.getElementById("artisan-drawer-backdrop");
  sidebar?.classList.remove("-translate-x-full");
  sidebar?.classList.add("translate-x-0");
  backdrop?.classList.remove("hidden");
}

function closeMobileDrawer() {
  const sidebar = document.getElementById("artisan-sidebar");
  const backdrop = document.getElementById("artisan-drawer-backdrop");
  sidebar?.classList.add("-translate-x-full");
  sidebar?.classList.remove("translate-x-0");
  backdrop?.classList.add("hidden");
}

function closeTopDropdowns() {
  document.getElementById("dash-notifications-dropdown")?.classList.add("hidden");
  document.getElementById("dash-profile-dropdown")?.classList.add("hidden");
}

function getAuthHeaders(extra = {}) {
  const token = authService.getAccessToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

function getMyArtisanId() {
  return state.authUser?.id || state.currentArtisan?.id || "artisan-1";
}

function getMyProducts() {
  if (state.authUser?.id) {
    return state.myProducts.filter(p => p.artisanId === state.authUser.id);
  }
  return state.myProducts.length > 0 ? state.myProducts : state.products;
}

function getMyInquiries() {
  if (!state.authUser?.id) return state.inquiries;
  const myId = state.authUser.id;
  const myProdIds = new Set(getMyProducts().map(p => p.id));
  return state.inquiries.filter(inq => inq.artisanId === myId || myProdIds.has(inq.productId));
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
    const artisanMatch = state.artisans.find(a => a.id === state.authUser.id);
    if (artisanMatch) {
      state.currentArtisan = artisanMatch;
    } else {
      state.currentArtisan = {
        ...state.currentArtisan,
        id: state.authUser.id,
        fullName: state.authUser.fullName || state.currentArtisan.fullName,
        email: state.authUser.email || state.currentArtisan.email,
        phone: state.authUser.mobileNumber || state.currentArtisan.phone,
      };
    }
    fetchProducts();
    fetchInquiries();
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
  } else if (route.name === "public-artisan") {
    renderPublicArtisanPage(route.params.id);
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
            <p class="text-xs text-[#5C5C57] mt-1">
              <a href="/artisan/${encodeURIComponent(artisan.id)}" data-route="/artisan/${encodeURIComponent(artisan.id)}" class="hover:text-[#292929] hover:underline">${escapeHtml(artisan.fullName)}</a>
              • ${escapeHtml(p.originState || artisan.state || "India")}
            </p>
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
            <p class="text-xs text-[#5C5C57] mt-1">
              <a href="/artisan/${encodeURIComponent(artisan.id)}" data-route="/artisan/${encodeURIComponent(artisan.id)}" class="hover:text-[#292929] hover:underline">${escapeHtml(artisan.fullName)}</a>
            </p>
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
              <a href="/artisan/${encodeURIComponent(artisan.id)}" data-route="/artisan/${encodeURIComponent(artisan.id)}" class="font-serif font-bold text-sm text-[#292929] hover:underline">${escapeHtml(artisan.fullName)}</a>
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
  document.getElementById("top-btn-logout")?.addEventListener("click", handleLogout);

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
  const displayName = state.authUser?.fullName || state.currentArtisan?.fullName || "Artisan";
  const displayEmail = state.authUser?.email || state.currentArtisan?.email || "";
  const avatarSrc = state.currentArtisan?.profileImage || "./assets/sitadevi_profile.jpg";

  const greetingName = document.getElementById("dash-greeting-name");
  const topNavName = document.getElementById("top-nav-artisan-name");
  const profMenuName = document.getElementById("profile-menu-name");
  const profMenuEmail = document.getElementById("profile-menu-email");
  const topNavAvatar = document.getElementById("top-nav-avatar");

  if (greetingName) greetingName.textContent = displayName;
  if (topNavName) topNavName.textContent = displayName;
  if (profMenuName) profMenuName.textContent = displayName;
  if (profMenuEmail) profMenuEmail.textContent = displayEmail;
  if (topNavAvatar) topNavAvatar.src = avatarSrc;

  const myProducts = getMyProducts();
  const myInquiries = getMyInquiries();
  const totalCount = myProducts.length;
  const publishedCount = myProducts.filter(p => p.status !== "draft" && p.isApprovedByArtisan !== false).length;
  const draftCount = totalCount - publishedCount;
  const newEnquiriesCount = myInquiries.filter(i => i.status === "new" || i.status === "pending" || !i.status).length;

  const elTotal = document.getElementById("dash-total-products");
  const elPub = document.getElementById("dash-published-products");
  const elPend = document.getElementById("dash-pending-approvals");
  const elInq = document.getElementById("dash-buyer-enquiries");
  const sidebarBadge = document.getElementById("sidebar-inquiries-badge");
  const notifDot = document.getElementById("dash-notif-dot");
  const notifList = document.getElementById("dash-notifications-list");

  if (elTotal) elTotal.textContent = String(totalCount);
  if (elPub) elPub.textContent = String(publishedCount);
  if (elPend) elPend.textContent = String(draftCount);
  if (elInq) elInq.textContent = String(newEnquiriesCount);
  if (sidebarBadge) sidebarBadge.textContent = String(myInquiries.length);
  if (notifDot) {
    notifDot.textContent = String(newEnquiriesCount);
    notifDot.classList.toggle("hidden", newEnquiriesCount === 0);
  }
  if (notifList) {
    if (myInquiries.length === 0) {
      notifList.innerHTML = `<p class="text-[#5C5C57] py-2">No notifications yet.</p>`;
    } else {
      notifList.innerHTML = myInquiries.slice(0, 4).map(inq => {
        const prod = myProducts.find(p => p.id === inq.productId) || state.products.find(p => p.id === inq.productId) || { title: "Craft Item" };
        return `
          <div class="p-2.5 rounded-xl bg-[#FAFAF8] border border-[#E6E4DD]">
            <div class="font-semibold text-[#292929] truncate">${escapeHtml(inq.buyerName)} asked about ${escapeHtml(prod.title)}</div>
            <div class="text-[11px] text-[#5C5C57] mt-0.5">${new Date(inq.createdAt).toLocaleDateString()}</div>
          </div>
        `;
      }).join("");
    }
  }

  const recentGrid = document.getElementById("dash-recent-products");
  if (recentGrid) {
    const recent = myProducts.slice(0, 4);
    if (recent.length === 0) {
      recentGrid.innerHTML = `
        <div class="col-span-full p-8 rounded-2xl bg-white border border-[#E6E4DD] text-center space-y-2">
          <p class="font-serif font-bold text-[#292929]">No products added yet</p>
          <p class="text-xs text-[#5C5C57]">Tap "+ Add New Product" above to create your first craft listing.</p>
        </div>
      `;
    } else {
      recentGrid.innerHTML = recent.map(p => {
        const localizedTitle = (p.titleRegional && p.titleRegional[state.currentLang]) || p.title;
        const isPublished = p.status !== "draft" && p.isApprovedByArtisan !== false;
        const coverImg = (Array.isArray(p.images) && p.images[0]) || p.enhancedImageUrl || p.imageUrl || "./assets/artisan_logo.jpg";
        return `
          <div class="craft-card rounded-2xl overflow-hidden flex flex-col">
            <div class="relative aspect-[4/3] bg-[#F0EFF5] overflow-hidden">
              <img src="${coverImg}" alt="${escapeHtml(localizedTitle)}" loading="lazy" class="w-full h-full object-cover" />
              <span class="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                isPublished ? "bg-[#DCE5C5] text-[#292929]" : "bg-[#F0EFF5] text-[#292929]"
              }">
                ${isPublished ? "Published" : "Draft"}
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
          const prod = myProducts.find(p => p.id === btn.getAttribute("data-id"));
          if (prod) openProductDetailModal(prod);
        });
      });

      recentGrid.querySelectorAll("[data-dash-action='edit']").forEach(btn => {
        btn.addEventListener("click", () => {
          const prod = myProducts.find(p => p.id === btn.getAttribute("data-id"));
          if (prod) openEditProductModal(prod);
        });
      });
    }
  }

  const recentEnqEl = document.getElementById("dash-recent-enquiries");
  if (recentEnqEl) {
    const latest = myInquiries.slice(0, 3);
    if (latest.length === 0) {
      recentEnqEl.innerHTML = `
        <div class="p-4 rounded-2xl bg-[#FAFAF8] border border-[#E6E4DD] text-xs text-[#5C5C57] text-center">
          No buyer enquiries yet. When buyers ask about your crafts, they appear here.
        </div>
      `;
    } else {
      recentEnqEl.innerHTML = latest.map(inq => {
        const prod = myProducts.find(p => p.id === inq.productId) || state.products.find(p => p.id === inq.productId) || { title: "Handcrafted Item" };
        const st = inq.status === "responded" || inq.status === "accepted" ? "Responded" : inq.status === "closed" ? "Closed" : "New";
        return `
          <div class="p-3 rounded-2xl bg-[#FAFAF8] border border-[#E6E4DD] flex items-start justify-between gap-2.5">
            <div class="min-w-0">
              <div class="text-xs font-bold text-[#292929] truncate">${escapeHtml(inq.buyerName)}</div>
              <div class="text-[11px] text-[#5C5C57] truncate">${escapeHtml(prod.title)} • ${inq.quantity || 1} pc</div>
            </div>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EBC5A9] text-[#292929] flex-shrink-0">${st}</span>
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
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        files.forEach((file, idx) => handleImageFile(file, idx > 0));
      }
    });
  }

  if (uploadBox) {
    uploadBox.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadBox.classList.add("border-[#556436]", "bg-[#DCE5C5]/35");
    });
    uploadBox.addEventListener("dragleave", () => {
      uploadBox.classList.remove("border-[#556436]", "bg-[#DCE5C5]/35");
    });
    uploadBox.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadBox.classList.remove("border-[#556436]", "bg-[#DCE5C5]/35");
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) {
        files.forEach((file, idx) => handleImageFile(file, idx > 0));
      }
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

function handleImageFile(file, append = false) {
  if (!file.type.startsWith("image/")) {
    showToast("Please upload a valid image file (JPEG, PNG, WebP).", "error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast(`"${file.name}" is larger than 5MB. Please pick a smaller photo.`, "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target?.result;
    if (base64) {
      setDraftImage(base64, append);
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

function setDraftImage(base64Data, append = false) {
  if (!Array.isArray(state.draft.images) || !append) {
    state.draft.images = [base64Data];
    state.draft.rawImageBase64 = base64Data;
    state.draft.enhancedImageBase64 = base64Data;
  } else if (state.draft.images.length < 5) {
    state.draft.images.push(base64Data);
  }

  const preview = document.getElementById("uploaded-photo-preview");
  const previewContainer = document.getElementById("photo-preview-container");
  const countEl = document.getElementById("wizard-photo-count");
  if (preview && previewContainer) {
    preview.src = state.draft.rawImageBase64;
    previewContainer.classList.remove("hidden");
  }
  if (countEl) {
    countEl.textContent = String(state.draft.images.length);
  }

  const enhancedPreview = document.getElementById("enhanced-photo-preview");
  if (enhancedPreview) {
    enhancedPreview.src = state.draft.enhancedImageBase64;
  }

  const btnAnalyze = document.getElementById("btn-trigger-ai-analysis");
  if (btnAnalyze) {
    btnAnalyze.removeAttribute("disabled");
    btnAnalyze.classList.remove("opacity-50", "cursor-not-allowed");
  }
}

// ==============================================================================
// 5. AI PRODUCT CREATION (HONEST AI + EDITABLE FIELDS + DRAFT OR PUBLISH)
// ==============================================================================
function setupWizardControls() {
  const catSelect = document.getElementById("input-review-category");
  if (catSelect) {
    const cats = CRAFT_CATEGORIES.filter(c => c !== "All Categories");
    catSelect.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join("");
  }

  const btnAnalyze = document.getElementById("btn-trigger-ai-analysis");
  if (btnAnalyze) {
    btnAnalyze.addEventListener("click", runAIAnalysis);
  }

  const btnSkipAi = document.getElementById("btn-skip-ai-manual");
  if (btnSkipAi) {
    btnSkipAi.addEventListener("click", () => {
      document.getElementById("ai-unavailable-banner")?.classList.add("hidden");
      document.getElementById("res-confidence-badge")?.classList.add("hidden");
      document.getElementById("materials-missing-prompt")?.classList.add("hidden");
      goToWizardStep(2);
    });
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
      if (nextStep === 3) {
        const title = document.getElementById("input-review-title")?.value.trim();
        if (!title) {
          showToast("Please enter a product name before moving to Step 3.", "warning");
          return;
        }
      }
      goToWizardStep(nextStep);
    });
  });

  document.querySelectorAll(".wizard-prev-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const prevStep = Number(btn.getAttribute("data-prev"));
      goToWizardStep(prevStep);
    });
  });

  // Save as Draft vs Explicit Approve & Publish
  document.getElementById("btn-save-draft-craft")?.addEventListener("click", () => publishDraftProduct("draft"));
  document.getElementById("btn-publish-craft")?.addEventListener("click", () => publishDraftProduct("published"));

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
    showToast("Please upload a craft photograph or enter a short description first.", "warning");
    return;
  }

  if (enteredVoice) {
    state.draft.voiceNotes = enteredVoice;
  }

  const loadingOverlay = document.getElementById("ai-analysis-loading");
  const unavailableBanner = document.getElementById("ai-unavailable-banner");
  const unavailableReason = document.getElementById("ai-unavailable-reason");
  if (loadingOverlay) loadingOverlay.classList.remove("hidden");

  try {
    const res = await fetch("/api/ai/analyze-product", {
      method: "POST",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        imageBase64: state.draft.rawImageBase64 || "",
        voiceDescription: state.draft.voiceNotes || enteredVoice,
        language: state.currentLang
      })
    });

    const data = await res.json().catch(() => ({}));
    if (loadingOverlay) loadingOverlay.classList.add("hidden");

    if (res.ok && data.success && data.analysis) {
      unavailableBanner?.classList.add("hidden");
      state.draft.analysis = data.analysis;
      populateAnalysisResults(data.analysis);
      goToWizardStep(2);
      showToast("AI suggestions ready! Review and edit any detail below.", "success");
    } else {
      // Honest error fallback: no fake data, open manual fields cleanly
      if (unavailableBanner) unavailableBanner.classList.remove("hidden");
      if (unavailableReason) {
        unavailableReason.textContent = data.error || "The AI helper is not available right now. Please enter your product details manually below.";
      }
      document.getElementById("res-confidence-badge")?.classList.add("hidden");
      goToWizardStep(2);
      showToast("AI unavailable — switched to manual entry.", "warning");
    }
  } catch (err) {
    console.error("AI Cataloging error:", err);
    if (loadingOverlay) loadingOverlay.classList.add("hidden");
    if (unavailableBanner) unavailableBanner.classList.remove("hidden");
    if (unavailableReason) {
      unavailableReason.textContent = "Could not reach the AI service right now. Please enter your product details manually below.";
    }
    document.getElementById("res-confidence-badge")?.classList.add("hidden");
    goToWizardStep(2);
    showToast("AI unavailable — you can still enter details manually.", "warning");
  }
}

function populateAnalysisResults(analysis) {
  const titleInput = document.getElementById("input-review-title");
  const catSelect = document.getElementById("input-review-category");
  const matsInput = document.getElementById("input-review-materials");
  const matsPrompt = document.getElementById("materials-missing-prompt");
  const descInput = document.getElementById("input-review-desc");
  const tagsInput = document.getElementById("input-review-tags");
  const keywordsInput = document.getElementById("input-review-keywords");
  const confBadge = document.getElementById("res-confidence-badge");
  const confText = document.getElementById("res-confidence-text");

  if (titleInput) titleInput.value = analysis.title || "";
  if (catSelect && analysis.category) {
    const options = Array.from(catSelect.options).map(o => o.value);
    if (options.includes(analysis.category)) {
      catSelect.value = analysis.category;
    }
  }

  const mats = Array.isArray(analysis.materials) ? analysis.materials.filter(Boolean) : [];
  if (matsInput) matsInput.value = mats.join(", ");
  if (matsPrompt) {
    const needsAsk = Boolean(analysis.materialsUnclear) || mats.length === 0;
    matsPrompt.textContent = analysis.missingMaterialPrompt || "We could not see the materials clearly in the photo — please type what materials you used.";
    matsPrompt.classList.toggle("hidden", !needsAsk);
  }

  if (descInput) {
    const parts = [analysis.description, analysis.culturalStory].filter(Boolean);
    descInput.value = parts.join("\n\n");
  }

  if (tagsInput) {
    tagsInput.value = Array.isArray(analysis.tags) ? analysis.tags.join(", ") : "";
  }
  if (keywordsInput) {
    keywordsInput.value = Array.isArray(analysis.keywords) ? analysis.keywords.join(", ") : "";
  }

  const enhancedPreview = document.getElementById("enhanced-photo-preview");
  if (enhancedPreview && (state.draft.enhancedImageBase64 || state.draft.rawImageBase64)) {
    enhancedPreview.src = state.draft.enhancedImageBase64 || state.draft.rawImageBase64;
  }

  if (confBadge && confText) {
    confBadge.classList.remove("hidden");
    const confidenceScore = typeof analysis.confidence_score === "number" ? analysis.confidence_score : 0.88;
    confText.textContent = `AI Suggestion (${Math.round(confidenceScore * 100)}%)`;
  }
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
  const priceInput = document.getElementById("input-review-price");

  [matInput, hoursInput, wageInput, overheadInput, marginInput].forEach(inp => {
    if (inp) {
      inp.addEventListener("input", () => recalculatePricing(true));
    }
  });

  if (priceInput) {
    priceInput.addEventListener("input", () => {
      const val = Math.max(1, Number(priceInput.value) || 0);
      state.draft.pricing.finalPrice = val;
      const badge = document.getElementById("review-final-price-badge");
      if (badge) badge.textContent = `₹${val.toLocaleString("en-IN")}`;
    });
  }
}

function recalculatePricing(updatePriceInput = true) {
  const matCost = Math.max(0, Number(document.getElementById("input-calc-material")?.value || 0));
  const hours = Math.max(0, Number(document.getElementById("input-calc-hours")?.value || 0));
  const wage = Math.max(0, Number(document.getElementById("input-calc-wage")?.value || 0));
  const overhead = Math.max(0, Number(document.getElementById("input-calc-overhead")?.value || 0));
  const margin = Math.max(0, Number(document.getElementById("input-calc-margin")?.value || 20));

  const directLabor = hours * wage;
  const totalCost = matCost + directLabor + overhead;
  const finalPrice = Math.max(1, Math.round(totalCost * (1 + margin / 100)));

  state.draft.pricing = {
    materialCost: matCost,
    laborHours: hours,
    hourlyRate: wage,
    overheadCost: overhead,
    profitMarginPercent: margin,
    finalPrice,
    marketBenchmark: 0
  };

  const reviewPriceInput = document.getElementById("input-review-price");
  const reviewPriceDisplay = document.getElementById("review-final-price-badge");
  if (reviewPriceInput && updatePriceInput) reviewPriceInput.value = String(finalPrice);
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

async function publishDraftProduct(targetStatus = "published") {
  const titleInput = document.getElementById("input-review-title");
  const catSelect = document.getElementById("input-review-category");
  const matsInput = document.getElementById("input-review-materials");
  const descInput = document.getElementById("input-review-desc");
  const tagsInput = document.getElementById("input-review-tags");
  const keywordsInput = document.getElementById("input-review-keywords");
  const dimInput = document.getElementById("input-review-dimensions");
  const priceInput = document.getElementById("input-review-price");

  const title = titleInput?.value.trim() || "";
  if (!title || title.length < 2) {
    showToast("Please enter a product name before saving.", "warning");
    return;
  }

  const finalPrice = Math.max(1, Number(priceInput?.value) || state.draft.pricing.finalPrice || 500);
  const category = catSelect?.value || state.draft.analysis?.category || "Folk Art";
  const materials = (matsInput?.value || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const tags = (tagsInput?.value || "")
    .split(",")
    .map(s => s.replace(/^#/, "").trim())
    .filter(Boolean);
  const keywords = (keywordsInput?.value || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const description = descInput?.value.trim() || "";
  const dimensions = dimInput?.value.trim() || "Standard";

  const images = Array.isArray(state.draft.images) && state.draft.images.length > 0
    ? [...state.draft.images]
    : [state.draft.enhancedImageBase64 || state.draft.rawImageBase64 || "./assets/artisan_logo.jpg"];

  if (state.draft.enhancedImageBase64 && images[0]) {
    images[0] = state.draft.enhancedImageBase64;
  }

  const status = targetStatus === "draft" ? "draft" : "published";

  const payload = {
    artisanId: getMyArtisanId(),
    title,
    category,
    materials: materials.length > 0 ? materials : ["Handmade Material"],
    dimensions,
    description,
    culturalStory: state.draft.analysis?.culturalStory || "",
    tags: tags.length > 0 ? tags : ["Handmade"],
    keywords,
    materialCost: state.draft.pricing.materialCost,
    laborHours: state.draft.pricing.laborHours,
    hourlyRate: state.draft.pricing.hourlyRate,
    overheadCost: state.draft.pricing.overheadCost,
    profitMarginPercent: state.draft.pricing.profitMarginPercent,
    finalPrice,
    images,
    imageUrl: images[0],
    enhancedImageUrl: images[0],
    backgroundStyle: state.draft.backgroundStyle,
    originState: state.currentArtisan?.state || "India",
    status,
    isInStock: true,
    isApprovedByArtisan: status === "published"
  };

  let createdProduct = null;
  try {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
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

  state.myProducts.unshift(createdProduct);
  if (status === "published") {
    state.products.unshift(createdProduct);
  }
  saveLocalProducts();
  showToast(
    status === "draft" ? `Saved "${title}" as a draft.` : `Published "${title}" to the marketplace!`,
    "success"
  );

  if (status === "published") {
    openMarketCardModal(createdProduct);
  }
  resetWizard();
  renderHomeFeaturedProducts();
  renderPublicExplore();
  renderDashboard();
  renderCatalog();
  renderArtisanStudio();
  window.dispatchEvent(new CustomEvent("artisan-products-updated"));
}

function resetWizard() {
  state.draft.rawImageBase64 = "";
  state.draft.enhancedImageBase64 = "";
  state.draft.images = [];
  state.draft.analysis = null;
  const photoPreview = document.getElementById("photo-preview-container");
  if (photoPreview) photoPreview.classList.add("hidden");
  ["input-review-title", "input-review-materials", "input-review-desc", "input-review-tags", "input-review-keywords", "input-review-dimensions", "voice-input-text"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("ai-unavailable-banner")?.classList.add("hidden");
  document.getElementById("materials-missing-prompt")?.classList.add("hidden");
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
    const pubRes = await fetch("/api/products");
    if (pubRes.ok) {
      const pubData = await pubRes.json();
      if (pubData.products && Array.isArray(pubData.products)) {
        state.products = pubData.products;
      }
    }

    if (state.authUser?.id) {
      const token = authService.getAccessToken();
      if (token) {
        const myRes = await fetch(`/api/products?scope=mine`, {
          headers: getAuthHeaders(),
        });
        if (myRes.ok) {
          const myData = await myRes.json();
          if (Array.isArray(myData.products)) {
            state.myProducts = myData.products;
          }
        }
      } else {
        state.myProducts = state.products.filter(p => p.artisanId === state.authUser.id);
      }
    }

    renderHomeFeaturedProducts();
    renderPublicExplore();
    if (state.currentRoute?.name === "product" && state.currentRoute?.params?.id) {
      renderPublicProductDetail(state.currentRoute.params.id);
    }
    renderDashboard();
    renderCatalog();
    renderArtisanStudio();
    window.dispatchEvent(new CustomEvent("artisan-products-updated"));
  } catch (e) {
    console.warn("Using local product catalog:", e);
  }
}

function setupCatalogFilters() {
  const searchInput = document.getElementById("catalog-search-input");
  const categorySelect = document.getElementById("catalog-category-filter");
  const statusButtons = document.querySelectorAll(".catalog-status-btn");

  if (categorySelect) {
    categorySelect.innerHTML = CRAFT_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");
    categorySelect.addEventListener("change", (e) => {
      state.selectedCategory = e.target.value;
      renderCatalog();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
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
        b.classList.toggle("font-semibold", active);
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

  const myProducts = getMyProducts();
  const q = state.searchQuery.toLowerCase().trim();
  const filtered = myProducts.filter(p => {
    const isPublished = p.status !== "draft" && p.isApprovedByArtisan !== false;
    const matchesStatus =
      state.selectedStatus === "all" ||
      (state.selectedStatus === "published" && isPublished) ||
      ((state.selectedStatus === "draft" || state.selectedStatus === "pending") && !isPublished);
    const matchesCat = state.selectedCategory === "All Categories" || p.category.toLowerCase() === state.selectedCategory.toLowerCase();
    const matchesSearch = !q ||
      p.title.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (Array.isArray(p.materials) && p.materials.some(m => m.toLowerCase().includes(q))) ||
      (p.description && p.description.toLowerCase().includes(q));

    return matchesStatus && matchesCat && matchesSearch;
  });

  if (countEl) {
    countEl.textContent = `${filtered.length} ${filtered.length === 1 ? "Product" : "Products"}`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 px-6 bg-white rounded-3xl border border-[#E6E4DD] text-center space-y-3">
        <p class="font-serif text-lg font-bold text-[#292929]">${myProducts.length === 0 ? "You have not added any products yet" : "No matching products found"}</p>
        <p class="text-xs sm:text-sm text-[#5C5C57]">${myProducts.length === 0 ? "Add your first craft manually or try AI Cataloging." : "Try clearing your search or selecting All status."}</p>
        <div class="flex flex-wrap justify-center gap-2 pt-1">
          ${myProducts.length === 0 ? `<button type="button" id="btn-empty-add-product" class="px-5 py-2.5 rounded-xl bg-[#B8C77B] text-[#292929] text-xs font-semibold cursor-pointer">+ Add Product</button>` : `<button type="button" id="btn-reset-catalog-filters" class="px-5 py-2.5 rounded-xl bg-[#B8C77B] text-[#292929] text-xs font-semibold cursor-pointer">Show All Products</button>`}
        </div>
      </div>
    `;
    document.getElementById("btn-empty-add-product")?.addEventListener("click", openAddProductModal);
    document.getElementById("btn-reset-catalog-filters")?.addEventListener("click", () => {
      state.searchQuery = "";
      state.selectedCategory = "All Categories";
      state.selectedStatus = "all";
      const searchEl = document.getElementById("catalog-search-input");
      const catEl = document.getElementById("catalog-category-filter");
      if (searchEl) searchEl.value = "";
      if (catEl) catEl.value = "All Categories";
      document.querySelector(".catalog-status-btn[data-status='all']")?.click();
      renderCatalog();
    });
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const localizedTitle = (p.titleRegional && p.titleRegional[state.currentLang]) || p.title;
    const isPublished = p.status !== "draft" && p.isApprovedByArtisan !== false;
    const images = Array.isArray(p.images) && p.images.length > 0 ? p.images : [p.enhancedImageUrl || p.imageUrl || "./assets/artisan_logo.jpg"];

    return `
      <div class="craft-card rounded-2xl overflow-hidden flex flex-col group">
        <div class="relative aspect-[4/3] bg-[#F0EFF5] overflow-hidden">
          <img
            src="${images[0]}"
            alt="${escapeHtml(localizedTitle)}"
            loading="lazy"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />
          <span class="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-semibold shadow-xs ${
            isPublished ? "bg-[#DCE5C5] text-[#292929]" : "bg-[#F0EFF5] text-[#292929]"
          }">
            ${isPublished ? "Published" : "Draft"}
          </span>
          ${images.length > 1 ? `
            <span class="absolute bottom-3 right-3 bg-white/95 text-[#292929] text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-[#E6E4DD]">
              ${images.length} Photos
            </span>
          ` : ""}
        </div>

        <div class="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
          <div>
            <div class="text-[11px] text-[#3F4D22] font-semibold uppercase tracking-wide mb-1 truncate">${escapeHtml(p.category)}</div>
            <h3 class="font-serif font-bold text-[#292929] text-base leading-snug line-clamp-2">
              ${escapeHtml(localizedTitle)}
            </h3>
          </div>

          <div class="space-y-3 pt-3 border-t border-[#E6E4DD]">
            <div class="flex items-baseline justify-between">
              <span class="text-xs text-[#5C5C57]">Price</span>
              <span class="font-serif text-lg font-bold text-[#292929]">₹${Number(p.finalPrice).toLocaleString("en-IN")}</span>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-action="edit-product"
                data-id="${p.id}"
                class="min-h-[40px] px-3 py-2 rounded-xl bg-[#B8C77B] hover:bg-[#a6b668] text-[#292929] text-xs font-semibold transition-colors cursor-pointer"
              >
                Edit
              </button>
              <button
                type="button"
                data-action="delete-product"
                data-id="${p.id}"
                class="min-h-[40px] px-3 py-2 rounded-xl bg-[#FAFAF8] hover:bg-[#EBC5A9]/60 text-[#292929] text-xs font-semibold border border-[#E6E4DD] transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  grid.querySelectorAll("button[data-action='edit-product']").forEach(btn => {
    btn.addEventListener("click", () => {
      const prod = myProducts.find(p => p.id === btn.getAttribute("data-id"));
      if (prod) openEditProductModal(prod);
    });
  });

  grid.querySelectorAll("button[data-action='delete-product']").forEach(btn => {
    btn.addEventListener("click", () => {
      const prod = myProducts.find(p => p.id === btn.getAttribute("data-id"));
      if (prod) openDeleteProductModal(prod);
    });
  });
}

function renderEditModalPhotosPreview() {
  const wrap = document.getElementById("edit-prod-photos-preview");
  if (!wrap) return;
  if (state.editModalImages.length === 0) {
    wrap.innerHTML = `<span class="text-[11px] text-[#5C5C57]">No photos selected yet.</span>`;
    return;
  }
  wrap.innerHTML = state.editModalImages.map((src, idx) => `
    <div class="relative w-16 h-16 rounded-xl overflow-hidden border border-[#E6E4DD] bg-[#F0EFF5]">
      <img src="${src}" alt="Product photo ${idx + 1}" class="w-full h-full object-cover" />
      <button type="button" data-remove-photo="${idx}" class="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white/90 text-[#292929] text-[10px] font-bold flex items-center justify-center border border-[#E6E4DD] cursor-pointer" title="Remove photo">✕</button>
    </div>
  `).join("");

  wrap.querySelectorAll("[data-remove-photo]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-remove-photo"));
      state.editModalImages.splice(idx, 1);
      renderEditModalPhotosPreview();
    });
  });
}

function setupEditProductModal() {
  const modal = document.getElementById("product-edit-modal");
  const form = document.getElementById("product-edit-form");
  const closeBtn = document.getElementById("btn-close-edit-modal");
  const cancelBtn = document.getElementById("btn-cancel-edit-modal");
  const photosInput = document.getElementById("edit-prod-photos-input");
  const draftBtn = document.getElementById("btn-save-product-draft");
  const publishBtn = document.getElementById("btn-save-product-publish");
  const categorySelect = document.getElementById("edit-prod-category");

  const deleteModal = document.getElementById("product-delete-modal");
  const cancelDelBtn = document.getElementById("btn-cancel-delete-modal");
  const confirmDelBtn = document.getElementById("btn-confirm-delete-prod");

  if (categorySelect) {
    const editableCats = CRAFT_CATEGORIES.filter(c => c !== "All Categories");
    categorySelect.innerHTML = editableCats.map(c => `<option value="${c}">${c}</option>`).join("");
  }

  closeBtn?.addEventListener("click", () => modal?.classList.add("hidden"));
  cancelBtn?.addEventListener("click", () => modal?.classList.add("hidden"));
  cancelDelBtn?.addEventListener("click", () => {
    state.pendingDeleteProductId = null;
    deleteModal?.classList.add("hidden");
  });

  photosInput?.addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (state.editModalImages.length >= 5) {
        showToast("You can upload up to 5 photos per product.", "warning");
        return;
      }
      if (!file.type.startsWith("image/")) {
        showToast(`"${file.name}" is not a valid image file.`, "error");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast(`"${file.name}" exceeds the 5MB photo limit.`, "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          state.editModalImages.push(ev.target.result);
          renderEditModalPhotosPreview();
        }
      };
      reader.readAsDataURL(file);
    });
    photosInput.value = "";
  });

  const submitProduct = async (targetStatus) => {
    const id = document.getElementById("edit-prod-id")?.value;
    const title = document.getElementById("edit-prod-title")?.value.trim();
    const category = document.getElementById("edit-prod-category")?.value || "Pottery";
    const finalPrice = Number(document.getElementById("edit-prod-price")?.value || 0);
    const materialsText = document.getElementById("edit-prod-materials")?.value.trim() || "";
    const dimensions = document.getElementById("edit-prod-dimensions")?.value.trim() || "Standard";
    const description = document.getElementById("edit-prod-desc")?.value.trim() || "";

    if (!title || title.length < 2) {
      showToast("Please enter a valid product name.", "warning");
      return;
    }
    if (isNaN(finalPrice) || finalPrice <= 0) {
      showToast("Please enter a valid price greater than ₹0.", "warning");
      return;
    }

    const materials = materialsText
      ? materialsText.split(",").map(m => m.trim()).filter(Boolean)
      : ["Natural Materials"];
    const images = state.editModalImages.length > 0 ? [...state.editModalImages] : ["./assets/artisan_logo.jpg"];

    const payload = {
      artisanId: getMyArtisanId(),
      title,
      category,
      finalPrice,
      materials,
      dimensions,
      description,
      images,
      imageUrl: images[0],
      enhancedImageUrl: images[0],
      status: targetStatus,
      isApprovedByArtisan: targetStatus === "published",
    };

    if (id) {
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload)
        });
        const data = res.ok ? await res.json() : null;
        const saved = data?.product || payload;

        const mIdx = state.myProducts.findIndex(p => p.id === id);
        if (mIdx >= 0) state.myProducts[mIdx] = { ...state.myProducts[mIdx], ...saved };

        const pIdx = state.products.findIndex(p => p.id === id);
        if (targetStatus === "published") {
          if (pIdx >= 0) state.products[pIdx] = { ...state.products[pIdx], ...saved };
          else state.products.unshift({ id, ...saved });
        } else if (pIdx >= 0) {
          state.products.splice(pIdx, 1);
        }
      } catch {
        const mIdx = state.myProducts.findIndex(p => p.id === id);
        if (mIdx >= 0) state.myProducts[mIdx] = { ...state.myProducts[mIdx], ...payload };
      }
      showToast(targetStatus === "draft" ? `Saved "${title}" as draft.` : `Published "${title}"!`, "success");
    } else {
      let created = null;
      try {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.product) created = data.product;
        }
      } catch {
        // fallback below
      }
      if (!created) {
        created = { id: `prod-${Date.now()}`, ...payload, createdAt: new Date().toISOString() };
      }
      state.myProducts.unshift(created);
      if (targetStatus === "published") {
        state.products.unshift(created);
      }
      showToast(targetStatus === "draft" ? `Saved "${title}" to drafts.` : `Published "${title}" to marketplace!`, "success");
    }

    saveLocalProducts();
    modal?.classList.add("hidden");
    renderHomeFeaturedProducts();
    renderPublicExplore();
    renderDashboard();
    renderCatalog();
    renderArtisanStudio();
    renderArtisanProfilePage();
  };

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    submitProduct("published");
  });
  draftBtn?.addEventListener("click", () => submitProduct("draft"));
  publishBtn?.addEventListener("click", () => submitProduct("published"));

  confirmDelBtn?.addEventListener("click", async () => {
    const id = state.pendingDeleteProductId;
    if (!id) return;

    try {
      const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok && res.status === 403) {
        showToast("You can only delete your own products.", "error");
        deleteModal?.classList.add("hidden");
        return;
      }
    } catch {
      // static fallback removes from local arrays below
    }

    state.myProducts = state.myProducts.filter(p => p.id !== id);
    state.products = state.products.filter(p => p.id !== id);
    saveLocalProducts();
    state.pendingDeleteProductId = null;
    deleteModal?.classList.add("hidden");
    showToast("Product removed.", "info");
    renderHomeFeaturedProducts();
    renderPublicExplore();
    renderDashboard();
    renderCatalog();
    renderArtisanStudio();
  });
}

function openAddProductModal() {
  const modal = document.getElementById("product-edit-modal");
  if (!modal) return;
  document.getElementById("product-modal-heading").textContent = "Add New Product";
  document.getElementById("edit-prod-id").value = "";
  document.getElementById("edit-prod-title").value = "";
  document.getElementById("edit-prod-category").value = "Pottery";
  document.getElementById("edit-prod-price").value = "";
  document.getElementById("edit-prod-materials").value = "";
  document.getElementById("edit-prod-dimensions").value = "";
  document.getElementById("edit-prod-desc").value = "";
  state.editModalImages = [];
  renderEditModalPhotosPreview();
  modal.classList.remove("hidden");
}

function openEditProductModal(product) {
  const modal = document.getElementById("product-edit-modal");
  if (!modal) return;

  document.getElementById("product-modal-heading").textContent = "Edit Product";
  document.getElementById("edit-prod-id").value = product.id;
  document.getElementById("edit-prod-title").value = product.title || "";
  document.getElementById("edit-prod-category").value = product.category || "Pottery";
  document.getElementById("edit-prod-price").value = Number(product.finalPrice) || 500;
  document.getElementById("edit-prod-materials").value = Array.isArray(product.materials) ? product.materials.join(", ") : (product.materials || "");
  document.getElementById("edit-prod-dimensions").value = product.dimensions || "";
  document.getElementById("edit-prod-desc").value = product.description || "";
  state.editModalImages = Array.isArray(product.images) && product.images.length > 0
    ? [...product.images]
    : [product.enhancedImageUrl || product.imageUrl].filter(Boolean);
  renderEditModalPhotosPreview();

  modal.classList.remove("hidden");
}

function openDeleteProductModal(product) {
  const modal = document.getElementById("product-delete-modal");
  const txt = document.getElementById("delete-prod-confirm-text");
  state.pendingDeleteProductId = product.id;
  if (txt) txt.textContent = `Are you sure you want to delete "${product.title}"? This cannot be undone.`;
  modal?.classList.remove("hidden");
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
      const buyerEmail = document.getElementById("inq-buyer-email")?.value || "";
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
        buyerEmail,
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
          status: "new",
          artisanReply: "",
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
let selectedInquiryStatus = "all";

async function fetchInquiries() {
  try {
    const token = authService.getAccessToken();
    const artisanId = getMyArtisanId();
    const url = token ? "/api/inquiries" : `/api/inquiries?artisanId=${encodeURIComponent(artisanId)}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
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

function normalizeEnquiryStatus(raw) {
  if (raw === "responded" || raw === "accepted") return "responded";
  if (raw === "closed") return "closed";
  return "new";
}

function setupEnquiryFiltersAndResponseModal() {
  document.querySelectorAll(".inq-status-filter").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedInquiryStatus = btn.getAttribute("data-inq-status") || "all";
      document.querySelectorAll(".inq-status-filter").forEach(b => {
        const active = b === btn;
        b.classList.toggle("bg-[#B8C77B]", active);
        b.classList.toggle("font-semibold", active);
        b.classList.toggle("bg-white", !active);
        b.classList.toggle("border", !active);
        b.classList.toggle("border-[#E6E4DD]", !active);
      });
      renderArtisanStudio();
    });
  });

  const modal = document.getElementById("enquiry-response-modal");
  const closeBtn = document.getElementById("btn-close-enquiry-resp");
  const form = document.getElementById("enquiry-response-form");

  closeBtn?.addEventListener("click", () => modal?.classList.add("hidden"));

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("resp-inq-id")?.value;
    const status = document.getElementById("resp-inq-status")?.value || "responded";
    const artisanReply = document.getElementById("resp-inq-reply")?.value.trim() || "";
    if (!id) return;

    const idx = state.inquiries.findIndex(i => i.id === id);
    if (idx >= 0) {
      state.inquiries[idx] = { ...state.inquiries[idx], status, artisanReply };
      saveLocalInquiries();
    }

    try {
      await fetch(`/api/inquiries/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ status, artisanReply }),
      });
    } catch {
      // static fallback kept
    }

    modal?.classList.add("hidden");
    showToast("Enquiry status & reply saved.", "success");
    renderDashboard();
    renderArtisanStudio();
  });
}

function openEnquiryResponseModal(inq) {
  const modal = document.getElementById("enquiry-response-modal");
  if (!modal) return;

  const myProds = getMyProducts();
  const prod = myProds.find(p => p.id === inq.productId) || state.products.find(p => p.id === inq.productId) || { title: "Handmade Craft" };
  const contactParts = [inq.buyerPhone, inq.buyerEmail, inq.buyerLocation].filter(Boolean).join(" • ");

  document.getElementById("resp-inq-id").value = inq.id;
  document.getElementById("resp-inq-buyer").textContent = inq.buyerName || "Buyer";
  document.getElementById("resp-inq-contact").textContent = contactParts || "No contact info provided";
  document.getElementById("resp-inq-product").textContent = `Product: ${prod.title} (${inq.quantity || 1} unit)`;
  document.getElementById("resp-inq-message").textContent = `"${inq.message || ""}"`;
  document.getElementById("resp-inq-status").value = normalizeEnquiryStatus(inq.status);
  document.getElementById("resp-inq-reply").value = inq.artisanReply || "";

  const waLink = document.getElementById("resp-inq-wa-link");
  const rawPhone = (inq.buyerPhone || "").replace(/\D/g, "");
  if (waLink) {
    waLink.setAttribute(
      "href",
      `https://wa.me/${rawPhone}?text=${encodeURIComponent(`Namaste ${inq.buyerName}, thank you for asking about "${prod.title}" on ARTISAN.`)}`
    );
    waLink.classList.toggle("hidden", !rawPhone);
  }

  const mailLink = document.getElementById("resp-inq-mail-link");
  if (mailLink) {
    if (inq.buyerEmail) {
      mailLink.setAttribute("href", `mailto:${encodeURIComponent(inq.buyerEmail)}?subject=${encodeURIComponent(`Regarding ${prod.title} on ARTISAN`)}`);
      mailLink.classList.remove("hidden");
    } else {
      mailLink.classList.add("hidden");
    }
  }

  modal.classList.remove("hidden");
}

function buildInquiriesListHTML() {
  const myInquiries = getMyInquiries().filter(inq => {
    const st = normalizeEnquiryStatus(inq.status);
    return selectedInquiryStatus === "all" || st === selectedInquiryStatus;
  });

  if (myInquiries.length === 0) {
    return `
      <div class="p-8 text-center bg-white rounded-2xl border border-[#E6E4DD] space-y-2">
        <p class="font-serif font-bold text-[#292929]">No buyer enquiries found</p>
        <p class="text-xs sm:text-sm text-[#5C5C57]">When buyers ask about your products, their enquiries appear here for you to reply.</p>
      </div>
    `;
  }

  const myProds = getMyProducts();
  return myInquiries.map(inq => {
    const prod = myProds.find(p => p.id === inq.productId) || state.products.find(p => p.id === inq.productId) || { title: "Handcrafted Product", finalPrice: 0 };
    const st = normalizeEnquiryStatus(inq.status);
    const badgeCls = st === "responded"
      ? "bg-[#DCE5C5] text-[#292929]"
      : st === "closed"
      ? "bg-[#F0EFF5] text-[#5C5C57]"
      : "bg-[#EBC5A9] text-[#292929]";
    const badgeLabel = st === "responded" ? "Responded" : st === "closed" ? "Closed" : "New";
    const contactLine = [inq.buyerEmail, inq.buyerPhone, inq.buyerLocation].filter(Boolean).join(" • ");

    return `
      <div class="p-4 sm:p-5 bg-white rounded-2xl border border-[#E6E4DD] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="space-y-1.5 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-serif font-bold text-[#292929] text-sm sm:text-base">${escapeHtml(inq.buyerName)}</span>
            <span class="text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${badgeCls}">${badgeLabel}</span>
            <span class="text-[11px] text-[#5C5C57]">${new Date(inq.createdAt).toLocaleDateString()}</span>
          </div>
          <div class="text-xs sm:text-sm text-[#292929] font-medium">
            Product: ${escapeHtml(prod.title)} • ${inq.quantity || 1} unit(s)
          </div>
          <div class="text-xs text-[#5C5C57]">${escapeHtml(contactLine || "India")}</div>
          <p class="text-xs sm:text-sm text-[#292929] bg-[#FAFAF8] p-2.5 rounded-xl border border-[#E6E4DD]">"${escapeHtml(inq.message || "Interested in ordering")}"</p>
          ${inq.artisanReply ? `<p class="text-xs text-[#3F4D22] font-medium">Your Reply: ${escapeHtml(inq.artisanReply)}</p>` : ""}
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <button type="button" data-open-inq-resp="${inq.id}" class="px-4 py-2.5 rounded-xl bg-[#B8C77B] hover:bg-[#a6b668] text-[#292929] text-xs font-semibold transition-colors cursor-pointer">
            View & Respond
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function renderArtisanStudio() {
  const inquiriesPageList = document.getElementById("inquiries-page-list");
  const inquiriesHTML = buildInquiriesListHTML();
  if (inquiriesPageList) {
    inquiriesPageList.innerHTML = inquiriesHTML;
    inquiriesPageList.querySelectorAll("[data-open-inq-resp]").forEach(btn => {
      btn.addEventListener("click", () => {
        const inq = state.inquiries.find(i => i.id === btn.getAttribute("data-open-inq-resp"));
        if (inq) openEnquiryResponseModal(inq);
      });
    });
  }
}

// ==============================================================================
// 12B. MY ARTISAN PROFILE, PUBLIC STORY PAGE & SETTINGS
// ==============================================================================
const LOCAL_PROFILE_KEY = "artisan_local_profile_v1";

function setupArtisanProfileEditor() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_PROFILE_KEY) || "null");
    if (saved && saved.id) {
      const idx = state.artisans.findIndex(a => a.id === saved.id);
      if (idx >= 0) state.artisans[idx] = { ...state.artisans[idx], ...saved };
      else state.artisans.push(saved);
    }
  } catch {
    // ignore storage errors
  }

  const photoInput = document.getElementById("prof-photo-input");
  const photoPreview = document.getElementById("prof-photo-preview");
  const form = document.getElementById("artisan-profile-form");
  const publicBtn = document.getElementById("btn-view-my-public-profile");

  photoInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please select a valid image file (JPG, PNG, WebP).", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("Profile photo must be under 5MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result && photoPreview) {
        photoPreview.src = ev.target.result;
      }
    };
    reader.readAsDataURL(file);
  });

  publicBtn?.addEventListener("click", () => {
    const id = getMyArtisanId();
    navigateAndRender(`/artisan/${encodeURIComponent(id)}`);
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullName = document.getElementById("prof-full-name")?.value.trim();
    if (!fullName || fullName.length < 2) {
      showToast("Please enter your full name.", "warning");
      return;
    }

    const patch = {
      id: getMyArtisanId(),
      fullName,
      craftSpecialty: document.getElementById("prof-specialty")?.value.trim() || "Traditional Handcrafts",
      districtVillage: document.getElementById("prof-location")?.value.trim() || "",
      state: document.getElementById("prof-state")?.value.trim() || "India",
      yearsExperience: Math.max(0, Number(document.getElementById("prof-experience")?.value || 0)),
      phone: document.getElementById("prof-phone")?.value.trim() || "",
      email: document.getElementById("prof-email")?.value.trim() || "",
      bio: document.getElementById("prof-bio")?.value.trim() || "",
      craftTradition: document.getElementById("prof-story")?.value.trim() || "",
      profileImage: photoPreview?.src || state.currentArtisan?.profileImage || "./assets/sitadevi_profile.jpg",
      isPublic: document.getElementById("prof-is-public")?.checked !== false,
    };

    try {
      const res = await fetch("/api/artisans/me", {
        method: "PUT",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.artisan) Object.assign(patch, data.artisan);
      }
    } catch {
      // keep local updates
    }

    state.currentArtisan = { ...state.currentArtisan, ...patch };
    if (state.authUser) state.authUser.fullName = patch.fullName;
    const idx = state.artisans.findIndex(a => a.id === patch.id);
    if (idx >= 0) state.artisans[idx] = { ...state.artisans[idx], ...patch };
    else state.artisans.push(patch);

    try {
      localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(patch));
    } catch {
      // ignore
    }

    showToast("Artisan profile updated!", "success");
    renderDashboard();
    renderArtisanProfilePage();
  });
}

function renderArtisanProfilePage() {
  const art = state.currentArtisan || INITIAL_ARTISANS[0];
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? "";
  };

  const preview = document.getElementById("prof-photo-preview");
  if (preview) preview.src = art.profileImage || "./assets/sitadevi_profile.jpg";
  setVal("prof-full-name", state.authUser?.fullName || art.fullName || "");
  setVal("prof-specialty", art.craftSpecialty || "");
  setVal("prof-location", art.districtVillage || "");
  setVal("prof-state", art.state || "");
  setVal("prof-experience", art.yearsExperience ?? 1);
  setVal("prof-phone", art.phone || state.authUser?.mobileNumber || "");
  setVal("prof-email", art.email || state.authUser?.email || "");
  setVal("prof-bio", art.bio || "");
  setVal("prof-story", art.craftTradition || "");
  const pubCheck = document.getElementById("prof-is-public");
  if (pubCheck) pubCheck.checked = art.isPublic !== false;

  const profileGrid = document.getElementById("artisan-profile-products-grid");
  if (!profileGrid) return;

  const artisanProducts = getMyProducts().filter(p => p.status !== "draft" && p.isApprovedByArtisan !== false);
  if (artisanProducts.length === 0) {
    profileGrid.innerHTML = `<div class="col-span-full p-6 bg-white rounded-2xl border border-[#E6E4DD] text-xs text-[#5C5C57] text-center">No published products yet. Publish a product to show it on your public artisan page.</div>`;
    return;
  }

  profileGrid.innerHTML = artisanProducts.map(p => {
    const localizedTitle = (p.titleRegional && p.titleRegional[state.currentLang]) || p.title;
    return `
      <div class="craft-card rounded-2xl overflow-hidden flex flex-col">
        <div class="aspect-[4/3] bg-[#F0EFF5] overflow-hidden">
          <img src="${p.enhancedImageUrl || p.imageUrl}" alt="${escapeHtml(localizedTitle)}" class="w-full h-full object-cover" />
        </div>
        <div class="p-4 flex-1 flex flex-col justify-between gap-2">
          <div>
            <div class="text-xs text-[#3F4D22] font-semibold uppercase mb-1">${escapeHtml(p.category)}</div>
            <h4 class="font-serif font-bold text-[#292929] text-sm line-clamp-2">${escapeHtml(localizedTitle)}</h4>
          </div>
          <div class="font-serif text-base font-bold text-[#292929]">₹${Number(p.finalPrice).toLocaleString("en-IN")}</div>
        </div>
      </div>
    `;
  }).join("");
}

async function renderPublicArtisanPage(artisanId) {
  const container = document.getElementById("public-artisan-profile-container");
  if (!container) return;

  let artisan = state.artisans.find(a => a.id === artisanId) || (state.currentArtisan?.id === artisanId ? state.currentArtisan : null);
  let artisanProducts = state.products.filter(
    p => p.artisanId === artisanId && p.status !== "draft" && p.isApprovedByArtisan !== false
  );

  try {
    const res = await fetch(`/api/artisans/${encodeURIComponent(artisanId)}`, { headers: getAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.artisan) artisan = data.artisan;
      if (Array.isArray(data.products)) artisanProducts = data.products;
    }
  } catch {
    // local state fallback
  }

  if (!artisan || (artisan.isPublic === false && state.authUser?.id !== artisan.id)) {
    container.innerHTML = `
      <div class="bg-white rounded-3xl border border-[#E6E4DD] p-10 text-center space-y-3">
        <h1 class="font-serif text-2xl font-bold text-[#292929]">Artisan Profile Unavailable</h1>
        <p class="text-sm text-[#5C5C57]">This profile may be set to private or does not exist.</p>
        <a href="/explore" data-route="/explore" class="inline-block px-5 py-2.5 rounded-xl bg-[#B8C77B] text-[#292929] text-sm font-semibold">Explore Crafts</a>
      </div>
    `;
    return;
  }

  const locationStr = [artisan.districtVillage, artisan.state].filter(Boolean).join(", ") || "India";
  const rawPhone = (artisan.phone || "").replace(/\D/g, "");
  const waText = encodeURIComponent(`Namaste ${artisan.fullName}! I saw your craft profile on ARTISAN and would love to know more.`);

  container.innerHTML = `
    <div class="bg-white rounded-3xl border border-[#E6E4DD] p-6 sm:p-10 flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-8">
      <img src="${artisan.profileImage || "./assets/sitadevi_profile.jpg"}" alt="${escapeHtml(artisan.fullName)}" class="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl object-cover border-2 border-[#B8C77B] flex-shrink-0" />
      <div class="flex-1 space-y-3 text-center md:text-left">
        <div class="flex flex-wrap items-center justify-center md:justify-start gap-2">
          <span class="px-3 py-1 rounded-full bg-[#DCE5C5] text-[#292929] text-xs font-semibold">${escapeHtml(artisan.craftSpecialty || "Indian Handicrafts")}</span>
          <span class="px-3 py-1 rounded-full bg-[#FAFAF8] border border-[#E6E4DD] text-[#5C5C57] text-xs font-medium">${escapeHtml(locationStr)}</span>
          ${artisan.yearsExperience ? `<span class="px-3 py-1 rounded-full bg-[#EBC5A9]/60 text-[#292929] text-xs font-medium">${artisan.yearsExperience} Years Experience</span>` : ""}
        </div>
        <h1 class="font-serif text-2xl sm:text-4xl font-bold text-[#292929]">${escapeHtml(artisan.fullName)}</h1>
        ${artisan.bio ? `<p class="text-sm sm:text-base text-[#292929] leading-relaxed">${escapeHtml(artisan.bio)}</p>` : ""}
        ${artisan.craftTradition ? `
          <div class="p-4 rounded-2xl bg-[#FAFAF8] border border-[#E6E4DD]">
            <div class="text-xs font-semibold uppercase tracking-wide text-[#3F4D22] mb-1">Traditional Craft Story</div>
            <p class="text-xs sm:text-sm text-[#5C5C57] leading-relaxed">${escapeHtml(artisan.craftTradition)}</p>
          </div>
        ` : ""}
        <div class="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1">
          ${rawPhone ? `<a href="https://wa.me/${rawPhone}?text=${waText}" target="_blank" rel="noopener noreferrer" class="px-5 py-2.5 rounded-xl bg-[#B8C77B] hover:bg-[#a6b668] text-[#292929] text-xs sm:text-sm font-semibold">Message on WhatsApp</a>` : ""}
          ${artisan.phone ? `<a href="tel:${escapeHtml(artisan.phone)}" class="px-5 py-2.5 rounded-xl bg-[#FAFAF8] border border-[#E6E4DD] text-[#292929] text-xs sm:text-sm font-semibold">Call Artisan</a>` : ""}
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <h2 class="font-serif text-2xl font-bold text-[#292929]">Crafts by ${escapeHtml(artisan.fullName)} (${artisanProducts.length})</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        ${artisanProducts.length === 0
          ? `<div class="col-span-full p-8 bg-white rounded-2xl border border-[#E6E4DD] text-center text-sm text-[#5C5C57]">No published products listed yet.</div>`
          : artisanProducts.map(p => `
              <div class="craft-card rounded-2xl overflow-hidden flex flex-col">
                <div class="aspect-[4/3] bg-[#F0EFF5] overflow-hidden">
                  <img src="${p.enhancedImageUrl || p.imageUrl}" alt="${escapeHtml(p.title)}" class="w-full h-full object-cover" />
                </div>
                <div class="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <div class="text-[11px] font-semibold text-[#3F4D22] uppercase">${escapeHtml(p.category)}</div>
                    <h3 class="font-serif font-bold text-sm text-[#292929] line-clamp-2 mt-0.5">${escapeHtml(p.title)}</h3>
                  </div>
                  <div class="flex items-center justify-between pt-2 border-t border-[#E6E4DD]">
                    <span class="font-serif font-bold text-base text-[#292929]">₹${Number(p.finalPrice).toLocaleString("en-IN")}</span>
                    <a href="/product/${encodeURIComponent(p.id)}" data-route="/product/${encodeURIComponent(p.id)}" class="px-3.5 py-1.5 rounded-xl bg-[#DCE5C5] hover:bg-[#B8C77B] text-[#292929] text-xs font-semibold">View</a>
                  </div>
                </div>
              </div>
            `).join("")}
      </div>
    </div>
  `;
}

function setupHelpSupport() {
  const form = document.getElementById("dash-support-form");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msgInput = document.getElementById("dash-support-message");
    const feedback = document.getElementById("dash-support-feedback");
    const message = msgInput?.value.trim() || "";
    if (!message) return;

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.authUser?.fullName || state.currentArtisan?.fullName || "Artisan User",
          email: state.authUser?.email || state.currentArtisan?.email || "support@artisan.local",
          subject: "Artisan Dashboard Support Request",
          message,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      if (feedback) {
        feedback.textContent = "Your message has been sent! Our support team will reply soon.";
        feedback.className = "text-xs p-3 rounded-xl bg-[#DCE5C5] text-[#292929] font-medium";
        feedback.classList.remove("hidden");
      }
      msgInput.value = "";
      showToast("Support message sent!", "success");
    } catch {
      if (feedback) {
        feedback.textContent = "Could not send online right now. Please try again later.";
        feedback.className = "text-xs p-3 rounded-xl bg-[#EBC5A9] text-[#292929] font-medium";
        feedback.classList.remove("hidden");
      }
    }
  });
}

function renderSettingsPage() {
  const acctName = document.getElementById("settings-acct-name");
  const acctMobile = document.getElementById("settings-acct-mobile");
  const acctEmail = document.getElementById("settings-acct-email");

  if (acctName) acctName.value = state.authUser?.fullName || state.currentArtisan?.fullName || "";
  if (acctMobile) acctMobile.value = state.authUser?.mobileNumber || state.currentArtisan?.phone || "";
  if (acctEmail) acctEmail.value = state.authUser?.email || state.currentArtisan?.email || "";

  const acctForm = document.getElementById("settings-account-form");
  if (acctForm) {
    acctForm.onsubmit = async (e) => {
      e.preventDefault();
      const fullName = acctName?.value.trim() || "";
      const mobileNumber = acctMobile?.value.trim() || "";
      const email = acctEmail?.value.trim() || "";
      if (fullName.length < 2 || mobileNumber.length < 8 || !email.includes("@")) {
        showToast("Please enter a valid name, mobile number, and email.", "warning");
        return;
      }
      const res = await authService.updateAccount({ fullName, mobileNumber, email });
      if (res.success) {
        if (state.authUser) {
          state.authUser = { ...state.authUser, fullName, mobileNumber, email };
        }
        state.currentArtisan = { ...state.currentArtisan, fullName, phone: mobileNumber, email };
        showToast("Account details saved.", "success");
        renderDashboard();
      } else {
        showToast(res.error || "Could not update account.", "error");
      }
    };
  }

  const passForm = document.getElementById("settings-password-form");
  if (passForm) {
    passForm.onsubmit = async (e) => {
      e.preventDefault();
      const curPass = document.getElementById("settings-cur-password")?.value || "";
      const newPass = document.getElementById("settings-new-password")?.value || "";
      const msgBox = document.getElementById("settings-password-msg");
      if (newPass.length < 6) {
        showToast("New password must be at least 6 characters.", "warning");
        return;
      }
      const res = await authService.changePassword(curPass, newPass);
      if (msgBox) {
        msgBox.textContent = res.success ? "Password changed successfully." : (res.error || "Could not change password.");
        msgBox.className = `text-xs p-3 rounded-xl font-medium ${res.success ? "bg-[#DCE5C5] text-[#292929]" : "bg-[#EBC5A9] text-[#292929]"}`;
        msgBox.classList.remove("hidden");
      }
      if (res.success) {
        passForm.reset();
        showToast("Password updated!", "success");
      }
    };
  }

  const notifEnq = document.getElementById("settings-notif-enquiries");
  const notifTips = document.getElementById("settings-notif-tips");
  try {
    const prefs = JSON.parse(localStorage.getItem("artisan_prefs_v1") || "{}");
    if (notifEnq && prefs.notifyEnquiries !== undefined) notifEnq.checked = Boolean(prefs.notifyEnquiries);
    if (notifTips && prefs.notifyTips !== undefined) notifTips.checked = Boolean(prefs.notifyTips);
  } catch {
    // ignore
  }
  const saveNotifPrefs = () => {
    const payload = {
      notifyEnquiries: notifEnq ? notifEnq.checked : true,
      notifyTips: notifTips ? notifTips.checked : true,
    };
    try {
      localStorage.setItem("artisan_prefs_v1", JSON.stringify(payload));
    } catch {
      // ignore
    }
    authService.updateAccount(payload);
    showToast("Notification preference saved.", "info");
  };
  if (notifEnq) notifEnq.onchange = saveNotifPrefs;
  if (notifTips) notifTips.onchange = saveNotifPrefs;

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
      showToast("Language updated.", "info");
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

  const logoutBtn = document.getElementById("settings-btn-logout");
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await authService.logout();
      state.authUser = null;
      syncPublicAuthHeader();
      showToast("You have been logged out.", "info");
      navigateAndRender("/");
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
