/**
 * ARTISAN SCROLLYTELLING & AMBIENT PARTICLE ENGINE
 * File: src/services/scrollytelling.ts
 *
 * Implements scroll-driven narrative scrubbing (inspired by Corn Revolution),
 * kinetic hero depth parallax, chapter transitions, and ambient particle motion
 * using pure browser APIs (requestAnimationFrame + IntersectionObserver).
 */

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
}

const PARTICLE_COLORS = ["#B8C77B", "#DCE5C5", "#EBC5A9", "#FFFFFF"];

export class ArtisanScrollChoreographer {
  private rafId: number | null = null;
  private particles: Particle[] = [];
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private mouseX = 0.5;
  private mouseY = 0.5;
  private lastScrollY = 0;
  private scrollVelocity = 0;
  private initialized = false;
  private reducedMotion = false;

  public init(): void {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;
    this.reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    this.setupScrollRevealObserver();
    this.setupCrackingText();
    this.setupMouseParallax();
    this.runPreloaderSequence();

    if (!this.reducedMotion) {
      this.setupParticles();
      this.startLoop();
    } else {
      this.updateScrollTimeline();
    }

    window.addEventListener("scroll", () => this.onScroll(), { passive: true });
    window.addEventListener("resize", () => this.resizeCanvas(), { passive: true });
  }

  private runPreloaderSequence(): void {
    const preloader = document.getElementById("artisan-preloader");
    const heroTitle = document.getElementById("artisan-hero-title");
    if (!preloader) {
      heroTitle?.classList.add("is-cracked-in");
      return;
    }

    // Only play the full loading curtain when opening the public homepage directly
    const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
    const isRootLanding = normalizedPath === "/" || normalizedPath.endsWith("/Istart_Artisan") || normalizedPath.endsWith("/index.html");
    if (!isRootLanding || this.reducedMotion) {
      preloader.classList.add("hidden");
      heroTitle?.classList.add("is-cracked-in");
      return;
    }

    const percentEl = document.getElementById("preloader-percent");
    const barEl = document.getElementById("preloader-bar");
    const ringEl = document.getElementById("preloader-ring") as unknown as SVGCircleElement | null;
    const circumference = 276.46;
    const duration = 1150;
    const startTime = performance.now();

    const stepLoader = (now: number) => {
      const elapsed = now - startTime;
      const raw = Math.min(1, elapsed / duration);
      // Smooth easeOutCubic progression
      const eased = 1 - Math.pow(1 - raw, 3);
      const pct = Math.round(eased * 100);

      if (percentEl) percentEl.textContent = `${pct}%`;
      if (barEl) barEl.style.transform = `scaleX(${eased})`;
      if (ringEl) ringEl.style.strokeDashoffset = String(circumference * (1 - eased));

      if (raw < 1) {
        window.requestAnimationFrame(stepLoader);
      } else {
        preloader.classList.add("is-loaded");
        window.setTimeout(() => {
          heroTitle?.classList.add("is-cracked-in");
        }, 160);
        window.setTimeout(() => {
          preloader.classList.add("hidden");
        }, 720);
      }
    };

    window.requestAnimationFrame(stepLoader);
  }

  private setupCrackingText(): void {
    const targets = document.querySelectorAll<HTMLElement>("[data-crack-text]");
    targets.forEach((el) => {
      const rawText = (el.textContent || "").trim().replace(/\s+/g, " ");
      if (!rawText) return;

      el.setAttribute("aria-label", rawText);
      el.classList.add("crack-heading");
      el.innerHTML = "";

      const words = rawText.split(" ");
      let charCounter = 0;

      words.forEach((word, wordIdx) => {
        const wordSpan = document.createElement("span");
        wordSpan.className = "crack-word";
        wordSpan.setAttribute("aria-hidden", "true");

        Array.from(word).forEach((ch) => {
          const charWrap = document.createElement("span");
          charWrap.className = "crack-char";
          charWrap.style.setProperty("--crack-delay", `${Math.min(charCounter * 22, 520)}ms`);

          const ghost = document.createElement("span");
          ghost.className = "crack-ghost";
          ghost.textContent = ch;

          const top = document.createElement("span");
          top.className = "crack-shard-top";
          top.textContent = ch;

          const bottom = document.createElement("span");
          bottom.className = "crack-shard-bottom";
          bottom.textContent = ch;

          const seam = document.createElement("span");
          seam.className = "crack-seam";

          charWrap.append(ghost, top, bottom, seam);
          wordSpan.appendChild(charWrap);
          charCounter += 1;
        });

        el.appendChild(wordSpan);
        if (wordIdx < words.length - 1) {
          const space = document.createElement("span");
          space.className = "crack-space";
          space.setAttribute("aria-hidden", "true");
          space.textContent = " ";
          el.appendChild(space);
        }
      });

      if (this.reducedMotion) {
        el.classList.add("is-cracked-in");
      }
    });

    if (this.reducedMotion) return;

    const scrollCrackTargets = Array.from(targets).filter((el) => el.id !== "artisan-hero-title");
    if (!("IntersectionObserver" in window)) {
      scrollCrackTargets.forEach((el) => el.classList.add("is-cracked-in"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-cracked-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.25 }
    );

    scrollCrackTargets.forEach((el) => observer.observe(el));
  }

  private setupScrollRevealObserver(): void {
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!("IntersectionObserver" in window)) {
      elements.forEach(el => el.classList.add("is-revealed"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -40px 0px" }
    );

    elements.forEach((el) => observer.observe(el));
  }

  private setupMouseParallax(): void {
    window.addEventListener(
      "mousemove",
      (e) => {
        this.mouseX = e.clientX / Math.max(1, window.innerWidth);
        this.mouseY = e.clientY / Math.max(1, window.innerHeight);
      },
      { passive: true }
    );
  }

  private setupParticles(): void {
    this.canvas = document.getElementById("artisan-ambient-canvas") as HTMLCanvasElement | null;
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.resizeCanvas();

    this.particles = Array.from({ length: 34 }, () => ({
      x: Math.random() * (this.canvas?.width || 1200),
      y: Math.random() * (this.canvas?.height || 800),
      r: 1.5 + Math.random() * 3.5,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -0.15 - Math.random() * 0.35,
      alpha: 0.25 + Math.random() * 0.45,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    }));
  }

  private resizeCanvas(): void {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.canvas.width = parent.clientWidth || window.innerWidth;
    this.canvas.height = parent.clientHeight || window.innerHeight;
  }

  private onScroll(): void {
    const currentY = window.scrollY;
    this.scrollVelocity = Math.min(30, Math.abs(currentY - this.lastScrollY));
    this.lastScrollY = currentY;
    if (this.reducedMotion) {
      this.updateScrollTimeline();
    }
  }

  private startLoop(): void {
    const tick = () => {
      this.updateScrollTimeline();
      this.drawParticles();
      this.scrollVelocity *= 0.9;
      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  private updateScrollTimeline(): void {
    const homePage = document.getElementById("public-page-home");
    if (!homePage || homePage.classList.contains("hidden")) return;

    const scrollY = window.scrollY;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const globalProgress = Math.min(1, Math.max(0, scrollY / maxScroll));

    const progressBar = document.getElementById("artisan-scroll-progress");
    if (progressBar) {
      progressBar.style.transform = `scaleX(${globalProgress})`;
    }

    // 1. Hero Parallax & Title Spread
    const heroEl = document.getElementById("artisan-hero-stage");
    const heroSculpture = document.getElementById("artisan-hero-sculpture");
    const heroTitle = document.getElementById("artisan-hero-title");
    if (heroEl) {
      const heroRect = heroEl.getBoundingClientRect();
      const heroProgress = Math.min(1, Math.max(0, -heroRect.top / Math.max(1, heroRect.height)));
      const tiltX = (this.mouseX - 0.5) * 18;
      const tiltY = (this.mouseY - 0.5) * 14;

      if (heroSculpture) {
        const scale = 1 + heroProgress * 0.16;
        const translateY = heroProgress * 55;
        heroSculpture.style.transform = `translate3d(${tiltX}px, ${translateY + tiltY}px, 0) scale(${scale})`;
      }
      if (heroTitle) {
        const opacity = Math.max(0, 1 - heroProgress * 1.4);
        heroTitle.style.opacity = String(opacity);
        heroTitle.style.transform = `translate3d(0, ${heroProgress * -28}px, 0)`;
      }
    }

    // 2. Scrollytelling Sticky Craft Cycle Chapter Scrubbing
    const scrollySection = document.getElementById("artisan-scrolly-section");
    if (scrollySection) {
      const rect = scrollySection.getBoundingClientRect();
      const totalDist = Math.max(1, scrollySection.offsetHeight - window.innerHeight);
      const localProgress = Math.min(1, Math.max(0, -rect.top / totalDist));

      const stageOrb = document.getElementById("scrolly-stage-orb");
      const stageRing = document.getElementById("scrolly-stage-ring");
      const stageImg = document.getElementById("scrolly-stage-img") as HTMLImageElement | null;
      const stageBadge = document.getElementById("scrolly-stage-badge");
      const stageCaption = document.getElementById("scrolly-stage-caption");

      const chapters = [
        {
          badge: "01 • Earth & Raw Material",
          caption: "Clay, handspun yarn, seasoned wood, and natural dyes gathered with respect for nature.",
          bg: "#DCE5C5",
          img: "https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?w=800&auto=format&fit=crop&q=80",
        },
        {
          badge: "02 • Master Hands",
          caption: "Days of patient craftsmanship shaped by techniques passed through generations.",
          bg: "#EBC5A9",
          img: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80",
        },
        {
          badge: "03 • Fair Living Wage",
          caption: "Every material cost and skilled hour is valued transparently—no hidden cuts.",
          bg: "#F0EFF5",
          img: "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=800&auto=format&fit=crop&q=80",
        },
        {
          badge: "04 • Direct Market",
          caption: "Artisans connect directly with conscious patrons around the world.",
          bg: "#B8C77B",
          img: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80",
        },
      ];

      const chapterIndex = Math.min(chapters.length - 1, Math.floor(localProgress * chapters.length));
      const activeChapter = chapters[chapterIndex];

      if (stageRing) {
        stageRing.style.transform = `rotate(${localProgress * 220}deg) scale(${0.95 + Math.sin(localProgress * Math.PI) * 0.08})`;
      }
      if (stageOrb) {
        stageOrb.style.backgroundColor = activeChapter.bg;
        stageOrb.style.transform = `scale(${0.96 + Math.sin(localProgress * Math.PI * 2) * 0.04})`;
      }
      if (stageImg && stageImg.dataset.chapterIdx !== String(chapterIndex)) {
        stageImg.dataset.chapterIdx = String(chapterIndex);
        stageImg.src = activeChapter.img;
      }
      if (stageBadge) stageBadge.textContent = activeChapter.badge;
      if (stageCaption) stageCaption.textContent = activeChapter.caption;

      document.querySelectorAll<HTMLElement>(".scrolly-step-card").forEach((card, idx) => {
        const isActive = idx === chapterIndex;
        card.classList.toggle("is-active-chapter", isActive);
      });
    }
  }

  private drawParticles(): void {
    if (!this.canvas || !this.ctx) return;
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    const speedBoost = 1 + this.scrollVelocity * 0.14;
    for (const p of this.particles) {
      p.x += p.vx + (this.mouseX - 0.5) * 0.2;
      p.y += p.vy * speedBoost;

      if (p.y < -10) {
        p.y = height + 10;
        p.x = Math.random() * width;
      }
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
  }

  public destroy(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

export const scrollChoreographer = new ArtisanScrollChoreographer();
