/**
 * ARTISAN MARKETPLACE: CLIENT-SIDE HISTORY ROUTER
 * File: src/router.ts
 *
 * Maps clean URLs (/, /explore, /product/:id, /about, /contact, /login, /register,
 * /artisan/dashboard, /buyer/dashboard) while respecting Vite's BASE_URL for
 * subpath hosting (e.g. GitHub Pages /Istart_Artisan/).
 */

export type RouteName =
  | "home"
  | "explore"
  | "product"
  | "public-artisan"
  | "about"
  | "contact"
  | "login"
  | "register"
  | "artisan-dashboard"
  | "buyer-dashboard";

export interface ParsedRoute {
  name: RouteName;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
}

export function getBasePath(): string {
  try {
    const raw = (import.meta as any)?.env?.BASE_URL || "/";
    if (raw === "./" || raw === "") return "/";
    return raw.endsWith("/") ? raw : `${raw}/`;
  } catch {
    return "/";
  }
}

export function stripBasePath(pathname: string): string {
  const base = getBasePath();
  if (base !== "/" && pathname.startsWith(base.slice(0, -1))) {
    const stripped = pathname.slice(base.length - 1);
    return stripped || "/";
  }
  return pathname || "/";
}

export function buildFullPath(appPath: string): string {
  const base = getBasePath();
  const clean = appPath.startsWith("/") ? appPath : `/${appPath}`;
  if (base === "/") return clean;
  return `${base.slice(0, -1)}${clean}`;
}

export function parseCurrentLocation(): ParsedRoute {
  // Recover GitHub Pages 404 redirect if present
  try {
    const redirected = sessionStorage.getItem("artisan_spa_redirect");
    if (redirected) {
      sessionStorage.removeItem("artisan_spa_redirect");
      window.history.replaceState(null, "", redirected);
    }
  } catch {
    // Ignore storage issues
  }

  const rawPath = stripBasePath(window.location.pathname);
  const path = rawPath.length > 1 && rawPath.endsWith("/") ? rawPath.slice(0, -1) : rawPath;
  const query = new URLSearchParams(window.location.search);

  if (path === "/" || path === "/index.html") {
    return { name: "home", path: "/", params: {}, query };
  }
  if (path === "/explore") {
    return { name: "explore", path, params: {}, query };
  }
  if (path.startsWith("/product/")) {
    const id = decodeURIComponent(path.slice("/product/".length));
    return { name: "product", path, params: { id }, query };
  }
  if (path.startsWith("/artisan/") && path !== "/artisan/dashboard") {
    const id = decodeURIComponent(path.slice("/artisan/".length));
    return { name: "public-artisan", path, params: { id }, query };
  }
  if (path === "/about") {
    return { name: "about", path, params: {}, query };
  }
  if (path === "/contact") {
    return { name: "contact", path, params: {}, query };
  }
  if (path === "/login") {
    return { name: "login", path, params: {}, query };
  }
  if (path === "/register") {
    return { name: "register", path, params: {}, query };
  }
  if (path === "/artisan/dashboard") {
    return { name: "artisan-dashboard", path, params: {}, query };
  }
  if (path === "/buyer/dashboard") {
    return { name: "buyer-dashboard", path, params: {}, query };
  }

  return { name: "home", path: "/", params: {}, query };
}

export function navigateTo(appPath: string, replace = false): ParsedRoute {
  const targetUrl = buildFullPath(appPath);
  if (replace) {
    window.history.replaceState(null, "", targetUrl);
  } else {
    window.history.pushState(null, "", targetUrl);
  }
  return parseCurrentLocation();
}
