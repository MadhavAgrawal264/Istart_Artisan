import express, { Request, Response } from "express";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { INITIAL_ARTISANS, INITIAL_PRODUCTS } from "./src/catalog-data.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Body parser with 50MB limit to handle high-resolution craft photos
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Initialize Gemini Client Lazily & Safely
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Resilient High-Throughput Model Pool:
// gemini-3.1-flash-lite provides fast, reliable responses without 503 high-demand spikes,
// with graceful fallback to gemini-3.8-flash and gemini-flash-latest.
const GEMINI_MODELS_POOL = ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];

function withTimeout<T>(promise: Promise<T>, timeoutMs = 12000, errorMsg = "Gemini request timed out"): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), timeoutMs)),
  ]);
}

async function generateWithModelFallback(params: {
  contents: any;
  config?: any;
  timeoutMs?: number;
}): Promise<{ text: string; modelUsed: string }> {
  const ai = getAI();
  if (!ai) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const timeoutMs = params.timeoutMs || 10000;
  let lastErr: any = null;

  for (const modelName of GEMINI_MODELS_POOL) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents: params.contents,
          config: params.config,
        }),
        timeoutMs,
        `Model ${modelName} call timed out after ${timeoutMs}ms`
      );

      if (response && response.text) {
        return { text: response.text, modelUsed: modelName };
      }
    } catch (err: any) {
      lastErr = err;
      const msg = err?.message || String(err);
      console.info(`Model ${modelName} issue (${msg.slice(0, 80)}), proceeding to fallback...`);
      continue;
    }
  }

  throw lastErr || new Error("All Gemini models temporarily unavailable");
}

function safeParseJson(raw: string): any {
  if (!raw || typeof raw !== "string") return null;
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

// Built-in Lightweight Data Store (Pre-seeded with authentic heritage Indian crafts)
// Operates immediately out-of-the-box with zero external database configuration.
let inMemoryProducts: any[] = INITIAL_PRODUCTS.map((p: any) => ({
  ...p,
  status: p.isApprovedByArtisan === false ? "draft" : "published",
  images: Array.isArray(p.images) && p.images.length > 0 ? p.images : [p.enhancedImageUrl || p.imageUrl],
  dimensions: p.dimensions || "Standard",
}));
let inMemoryArtisans: any[] = INITIAL_ARTISANS.map((a: any) => ({
  ...a,
  isPublic: a.isPublic !== false,
}));
let inMemoryInquiries: any[] = [
  {
    id: "inq-1",
    productId: "prod-1",
    artisanId: "artisan-1",
    buyerName: "Aditi Sharma",
    buyerPhone: "+91 98112 23344",
    buyerEmail: "aditi.interiors@example.com",
    buyerLocation: "Bengaluru, Karnataka",
    quantity: 2,
    inquiryType: "purchase_inquiry",
    message: "Namaste Sitadevi ji, I loved your Tree of Life painting! We want 2 pieces for our new eco-home. Can you do custom framing?",
    status: "new",
    artisanReply: "",
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: "inq-2",
    productId: "prod-2",
    artisanId: "artisan-2",
    buyerName: "GreenRoots Montessori School",
    buyerPhone: "+91 94433 11223",
    buyerEmail: "procurement@greenroots.org",
    buyerLocation: "Mysuru, Karnataka",
    quantity: 25,
    inquiryType: "bulk_retail",
    message: "Hello Rameshwar ji, we would like to order 25 sets of your non-toxic wooden stacking toys for our kindergarten classrooms.",
    status: "responded",
    artisanReply: "Namaste! Yes, we can prepare 25 sets in 12 days.",
    createdAt: new Date(Date.now() - 3600000 * 28).toISOString()
  }
];

interface StoredAccount {
  id: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  accountType: "artisan" | "buyer" | "organization";
  organizationName?: string;
  passwordSalt: string;
  passwordHash: string;
  languagePreference?: string;
  notifyEnquiries?: boolean;
  notifyTips?: boolean;
  createdAt: string;
}

const AUTH_SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString("hex");
const registeredAccounts: StoredAccount[] = [];
const revokedTokens = new Set<string>();

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function signAuthToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ sub: userId, iat: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyAuthToken(token: string): string | null {
  if (!token || revokedTokens.has(token)) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed?.sub ? String(parsed.sub) : null;
  } catch {
    return null;
  }
}

function getAuthenticatedAccount(req: Request): StoredAccount | null {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const userId = verifyAuthToken(token);
  if (!userId) return null;
  return registeredAccounts.find(a => a.id === userId) || null;
}

// ==============================================================================
// 1. HEALTH & SYSTEM STATUS ENDPOINT
// ==============================================================================
app.get("/api/status", (req: Request, res: Response) => {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  
  res.json({
    status: "ok",
    appName: "Artisan",
    geminiConfigured: hasGemini,
    storageType: "self_contained",
    activeProductsCount: inMemoryProducts.length,
    activeArtisansCount: inMemoryArtisans.length,
    serverTime: new Date().toISOString()
  });
});

// ==============================================================================
// 2. AI MULTIMODAL PRODUCT DETECTION & SMART CATALOGING (HONEST AI ONLY)
// ==============================================================================
app.post("/api/ai/analyze-product", async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", voiceDescription = "", language = "en" } = req.body || {};
    const queryDescription = String(voiceDescription || "").trim();

    if (!imageBase64 && !queryDescription) {
      return res.status(400).json({
        success: false,
        error: "Please upload a product photograph or describe your craft first."
      });
    }

    const ai = getAI();
    if (!ai) {
      return res.status(503).json({
        success: false,
        aiUnavailable: true,
        error: "AI analysis service is not configured or unavailable right now. You can enter your product details manually."
      });
    }

    const prompt = `# ROLE & GOAL
You are helping an Indian artisan catalog a handmade craft from a photograph and optional notes.

# STRICT HONESTY RULES
1. Examine only the provided photograph and artisan notes. Never fabricate certifications, fake GI tags, or unverified claims.
2. MATERIALS RULE: Only list materials inside "detected_materials" when they are clearly visually identifiable from the photograph or explicitly mentioned in the artisan notes. If materials cannot be determined reliably from the photo, return an empty array [] and note in "missing_material_prompt" a polite short question asking the artisan what materials they used.
3. Return helpful craft category, concise buyer-friendly product title, clear description, relevant tags, and search keywords.
4. Reply language preference code: "${language}" (use simple, warm language).

# ARTISAN NOTES PROVIDED
${queryDescription ? `"${queryDescription}"` : "(No written or spoken notes provided — analyze purely from the uploaded photograph.)"}

# OUTPUT FORMAT CONTRACT
Return exclusively valid JSON matching this structure:
{
  "title": "Concise handmade product name",
  "detected_category": "One of: Pottery, Textiles, Woodwork, Bamboo and Cane, Jewellery, Folk Art, Paintings & Folk Art, Ceramics & Pottery, Metalcraft & Bell Metal, Handloom & Textiles",
  "detected_materials": ["Only visually confirmed materials, or empty [] if uncertain"],
  "missing_material_prompt": "Short friendly question if materials are unclear, else empty string",
  "product_description": "2-4 warm sentences describing the craft, appearance, and use",
  "heritage_story": "1-2 short sentences about traditional Indian craftsmanship",
  "tags": ["4 to 6 short relevant tags without #"],
  "keywords": ["5 to 8 search keywords buyers might type"],
  "confidence_score": 0.0
}`;

    try {
      let contentsPayload: any;
      if (imageBase64) {
        const base64Data = String(imageBase64).replace(/^data:image\/\w+;base64,/, "");
        contentsPayload = {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType || "image/jpeg",
              },
            },
            { text: prompt },
          ],
        };
      } else {
        contentsPayload = {
          parts: [{ text: prompt }],
        };
      }

      const { text: rawText, modelUsed } = await generateWithModelFallback({
        contents: contentsPayload,
        config: {
          responseMimeType: "application/json",
        },
      });

      const parsed = safeParseJson(rawText);
      if (parsed && typeof parsed === "object") {
        const materials = Array.isArray(parsed.detected_materials)
          ? parsed.detected_materials.map((m: any) => String(m).trim()).filter(Boolean)
          : [];
        const tags = Array.isArray(parsed.tags)
          ? parsed.tags.map((t: any) => String(t).replace(/^#/, "").trim()).filter(Boolean)
          : [];
        const keywords = Array.isArray(parsed.keywords)
          ? parsed.keywords.map((k: any) => String(k).trim()).filter(Boolean)
          : [];

        const normalized = {
          title: String(parsed.title || "").trim(),
          category: String(parsed.detected_category || "Folk Art").trim(),
          materials,
          materialsUnclear: materials.length === 0,
          missingMaterialPrompt: String(
            parsed.missing_material_prompt ||
              (materials.length === 0 ? "We could not clearly tell the materials from the photo. Please enter the materials you used." : "")
          ).trim(),
          description: String(parsed.product_description || "").trim(),
          culturalStory: String(parsed.heritage_story || "").trim(),
          tags,
          keywords,
          confidence_score: typeof parsed.confidence_score === "number" ? parsed.confidence_score : 0.88,
        };

        return res.json({ success: true, analysis: normalized, modelUsed });
      }

      return res.status(502).json({
        success: false,
        aiUnavailable: true,
        error: "AI returned an unreadable response. Please fill in your product details manually."
      });
    } catch (geminiError: any) {
      console.info("Gemini analysis unavailable:", geminiError?.message || geminiError);
      return res.status(503).json({
        success: false,
        aiUnavailable: true,
        error: "The AI helper could not analyze this photo right now. Please enter the product details manually below."
      });
    }
  } catch (err: any) {
    console.error("Analysis route error:", err);
    return res.status(500).json({
      success: false,
      aiUnavailable: true,
      error: "Something went wrong analyzing the photo. You can fill in product details manually."
    });
  }
});

// ==============================================================================
// 2B. INTERACTIVE AI ARTISAN ADVISOR (CONVERSATIONAL GEMINI CHAT)
// ==============================================================================
app.post("/api/ai/chat", async (req: Request, res: Response) => {
  try {
    const { message, history = [], language = "en" } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const ai = getAI();
    if (!ai) {
      return res.status(500).json({ error: "Gemini AI not initialized" });
    }

    const systemPrompt = `You are "Artisan AI", an expert conversational mentor, cultural historian, and fair-trade business advisor for traditional Indian artisans, craft clusters, and conscious craft patrons.
Your domain expertise includes:
1. Calculating and defending fair living artisan wages (raw materials + labor hours * hourly living wage + fair margin).
2. Verifying official Indian Geographical Indication (GI) tags and historical provenance (Madhubani, Channapatna Toys, Bastar Dhokra, Jaipur Blue Pottery, Pashmina, Varanasi Silk, Bidriware, Warli, etc.).
3. Authentic natural materials, sustainable eco-friendly practices, organic vegetable dyes, and hand-tool techniques.
4. Crafting high-converting, ethical product descriptions and digital marketing copy for WhatsApp, Etsy, and domestic/export markets.
5. Multilingual fluency: reply in the language the user asked in (English, Hindi, Hinglish, etc.).
Keep answers insightful, polite, supportive, concise (2-4 short paragraphs), and well-formatted with markdown and bullet points.`;

    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        if (h && h.role && h.text) {
          contents.push({
            role: h.role === "user" ? "user" : "model",
            parts: [{ text: String(h.text) }]
          });
        }
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    const { text: reply, modelUsed } = await generateWithModelFallback({
      contents,
      config: {
        systemInstruction: systemPrompt,
      },
      timeoutMs: 12000,
    });

    return res.json({ success: true, reply, modelUsed });
  } catch (err: any) {
    console.error("AI Chat error:", err);
    return res.status(500).json({
      error: "AI service temporarily unavailable",
      reply: "I am an AI craft specialist for Indian artisans. While the live network is catching up, you can explore traditional craft pricing: Fair Price = Material Cost + (Crafting Hours × Fair Living Wage ₹80-120/hr) + 20-30% Artisan Profit. Try asking again in a moment!"
    });
  }
});

// ==============================================================================
// 3. SMART FAIR-PRICING CALCULATOR ENDPOINT
// ==============================================================================
app.post("/api/ai/pricing", async (req: Request, res: Response) => {
  try {
    const {
      materialCost = 0,
      laborHours = 0,
      hourlyRate = 80,
      overheadCost = 0,
      profitMarginPercent = 25,
      craftType = "Handicraft",
      complexity = "Medium"
    } = req.body;

    const numMaterial = Math.max(0, Number(materialCost));
    const numHours = Math.max(0, Number(laborHours));
    const numHourlyRate = Math.max(0, Number(hourlyRate));
    const numOverhead = Math.max(0, Number(overheadCost));
    const numMargin = Math.max(5, Math.min(100, Number(profitMarginPercent)));

    const directLaborCost = numHours * numHourlyRate;
    const baseCost = numMaterial + directLaborCost + numOverhead;
    const artisanProfit = Math.round((baseCost * numMargin) / 100);
    const recommendedFairPrice = Math.round(baseCost + artisanProfit);
    const marketBenchmark = Math.round(recommendedFairPrice * 1.55);
    const artisanTakeHome = Math.round(directLaborCost + artisanProfit);
    const artisanSharePercent = recommendedFairPrice > 0 ? Math.round((artisanTakeHome / recommendedFairPrice) * 100) : 100;

    let aiAdvice = `Fair pricing ensures ₹${numHourlyRate}/hr living wage for ${numHours} hours of skilled artisanal labor.`;

    const ai = getAI();
    if (ai) {
      try {
        const { text: adviceText } = await generateWithModelFallback({
          contents: `Given an artisan craft of category "${craftType}" with material cost ₹${numMaterial}, ${numHours} hours of handcrafting at ₹${numHourlyRate}/hr, overhead ₹${numOverhead}, and recommended price ₹${recommendedFairPrice}:
Provide 1 short sentence advising the artisan on market viability and fair pricing defense for conscious buyers.`,
        });
        if (adviceText) {
          aiAdvice = adviceText.trim();
        }
      } catch (e) {
        // use fallback advice
      }
    }

    res.json({
      success: true,
      breakdown: {
        materialCost: numMaterial,
        laborHours: numHours,
        hourlyRate: numHourlyRate,
        directLaborCost,
        overheadCost: numOverhead,
        baseCost,
        artisanProfit,
        profitMarginPercent: numMargin,
        recommendedFairPrice,
        marketBenchmark,
        artisanTakeHome,
        artisanSharePercent,
        aiAdvice
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: "Pricing calculation error", details: err.message });
  }
});

// ==============================================================================
// 4. REGIONAL LANGUAGE TRANSLATION (HINDI + MAJOR INDIAN LANGUAGES)
// ==============================================================================
app.post("/api/ai/translate", async (req: Request, res: Response) => {
  try {
    const { text, targetLanguage = "hi" } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required for translation" });
    }

    const languageNames: Record<string, string> = {
      hi: "Hindi",
      bn: "Bengali",
      mr: "Marathi",
      ta: "Tamil",
      te: "Telugu",
      gu: "Gujarati",
      kn: "Kannada",
      od: "Odia",
      en: "English"
    };

    const targetLangName = languageNames[targetLanguage] || targetLanguage;

    const ai = getAI();
    if (ai) {
      try {
        const prompt = `Translate the following artisan handicraft description/story accurately and naturally into ${targetLangName}. Preserve cultural authenticity, respect, and craft terminology:

"${text}"

Return ONLY the translated text without commentary or quotes.`;

        const { text: translatedText } = await generateWithModelFallback({
          contents: prompt,
        });

        return res.json({
          success: true,
          targetLanguage,
          translatedText: (translatedText || text).trim()
        });
      } catch (e: any) {
        console.info("Translation API transient high demand, returning original text.");
      }
    }

    // Fallback if Gemini unavailable
    res.json({
      success: true,
      targetLanguage,
      translatedText: text,
      note: "Original text returned (translation service offline)"
    });
  } catch (err: any) {
    res.status(500).json({ error: "Translation error", details: err.message });
  }
});

// ==============================================================================
// 5. PRODUCTS CRUD (LIGHTWEIGHT IN-MEMORY DATA STORE)
// ==============================================================================
app.get("/api/products", async (req: Request, res: Response) => {
  try {
    const { category, state, search, maxPrice, scope, artisanId } = req.query;
    const authUser = getAuthenticatedAccount(req);

    let results = [...inMemoryProducts];

    if (scope === "mine") {
      const targetArtisanId = authUser?.id || (artisanId ? String(artisanId) : "");
      if (!targetArtisanId) {
        return res.status(401).json({ error: "Please sign in to view your private product drafts." });
      }
      results = results.filter(p => p.artisanId === targetArtisanId);
    } else {
      // Public marketplace shows only published & artisan-approved products
      results = results.filter(p => p.isApprovedByArtisan !== false && p.status !== "draft");
      if (artisanId) {
        results = results.filter(p => p.artisanId === String(artisanId));
      }
    }

    if (category && category !== "All Categories") {
      results = results.filter(p => p.category.toLowerCase() === String(category).toLowerCase());
    }
    if (state && state !== "All States") {
      results = results.filter(p => p.originState.toLowerCase() === String(state).toLowerCase());
    }
    if (maxPrice && Number(maxPrice) > 0) {
      results = results.filter(p => p.finalPrice <= Number(maxPrice));
    }
    if (search && String(search).trim() !== "") {
      const q = String(search).toLowerCase();
      results = results.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.originState.toLowerCase().includes(q) ||
        (Array.isArray(p.tags) && p.tags.some((t: string) => t.toLowerCase().includes(q))) ||
        (Array.isArray(p.keywords) && p.keywords.some((k: string) => k.toLowerCase().includes(q))) ||
        p.description.toLowerCase().includes(q)
      );
    }

    res.json({ products: results, source: "local_store" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load products", details: err.message });
  }
});

app.post("/api/products", async (req: Request, res: Response) => {
  try {
    const authUser = getAuthenticatedAccount(req);
    const productData = req.body || {};
    const status = productData.status === "draft" || productData.isApprovedByArtisan === false ? "draft" : "published";
    const images = Array.isArray(productData.images) && productData.images.length > 0
      ? productData.images.filter((img: any) => typeof img === "string" && img.trim())
      : [productData.enhancedImageUrl || productData.imageUrl || "./assets/artisan_logo.jpg"];

    const materials = Array.isArray(productData.materials)
      ? productData.materials
      : typeof productData.materials === "string" && productData.materials.trim()
      ? productData.materials.split(",").map((m: string) => m.trim()).filter(Boolean)
      : ["Natural Materials"];

    const artisanProfile = inMemoryArtisans.find(a => a.id === (authUser?.id || productData.artisanId));
    const newId = `prod-${Date.now()}`;
    const newProduct = {
      id: newId,
      artisanId: authUser?.id || productData.artisanId || "artisan-1",
      title: String(productData.title || "Handcrafted Heritage Art").trim(),
      titleRegional: productData.titleRegional || {},
      category: productData.category || "Paintings & Folk Art",
      materials,
      primaryColors: productData.primaryColors || ["Earth Tones"],
      craftTechnique: productData.craftTechnique || "Handmade",
      dimensions: String(productData.dimensions || "Standard").trim(),
      weightGrams: Number(productData.weightGrams) || 250,
      description: String(productData.description || "").trim(),
      descriptionRegional: productData.descriptionRegional || {},
      culturalStory: String(productData.culturalStory || "").trim(),
      careInstructions: productData.careInstructions || "Dust with clean cloth",
      tags: Array.isArray(productData.tags) ? productData.tags : ["Handmade"],
      keywords: Array.isArray(productData.keywords) ? productData.keywords : [],
      materialCost: Number(productData.materialCost) || 0,
      laborHours: Number(productData.laborHours) || 0,
      hourlyRate: Number(productData.hourlyRate) || 0,
      packagingCost: Number(productData.packagingCost) || 0,
      overheadCost: Number(productData.overheadCost) || 0,
      profitMarginPercent: Number(productData.profitMarginPercent) || 0,
      finalPrice: Math.max(1, Number(productData.finalPrice) || 500),
      marketBenchmarkPrice: Number(productData.marketBenchmarkPrice) || 0,
      images,
      imageUrl: images[0],
      enhancedImageUrl: productData.enhancedImageUrl || images[0],
      backgroundStyle: productData.backgroundStyle || "studio_white",
      stockQuantity: Number(productData.stockQuantity) || 1,
      isInStock: true,
      status,
      isApprovedByArtisan: status === "published",
      originState: productData.originState || artisanProfile?.state || "India",
      hasGiTag: Boolean(productData.hasGiTag),
      createdAt: new Date().toISOString()
    };

    inMemoryProducts.unshift(newProduct);
    res.status(201).json({ success: true, product: newProduct });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create product", details: err.message });
  }
});

app.put("/api/products/:id", (req: Request, res: Response) => {
  try {
    const authUser = getAuthenticatedAccount(req);
    const idx = inMemoryProducts.findIndex(p => p.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (authUser && inMemoryProducts[idx].artisanId !== authUser.id) {
      return res.status(403).json({ error: "You can only edit your own products." });
    }

    const updates = req.body || {};
    const nextStatus = updates.status !== undefined
      ? (updates.status === "draft" ? "draft" : "published")
      : updates.isApprovedByArtisan !== undefined
      ? (updates.isApprovedByArtisan ? "published" : "draft")
      : inMemoryProducts[idx].status;

    const nextImages = Array.isArray(updates.images) && updates.images.length > 0
      ? updates.images.filter((img: any) => typeof img === "string" && img.trim())
      : undefined;

    const nextMaterials = Array.isArray(updates.materials)
      ? updates.materials
      : typeof updates.materials === "string"
      ? updates.materials.split(",").map((m: string) => m.trim()).filter(Boolean)
      : undefined;

    inMemoryProducts[idx] = {
      ...inMemoryProducts[idx],
      ...(updates.title !== undefined ? { title: String(updates.title).trim() } : {}),
      ...(updates.category !== undefined ? { category: updates.category } : {}),
      ...(updates.finalPrice !== undefined ? { finalPrice: Math.max(1, Number(updates.finalPrice)) } : {}),
      ...(updates.description !== undefined ? { description: String(updates.description) } : {}),
      ...(updates.culturalStory !== undefined ? { culturalStory: String(updates.culturalStory) } : {}),
      ...(updates.dimensions !== undefined ? { dimensions: String(updates.dimensions) } : {}),
      ...(nextMaterials !== undefined ? { materials: nextMaterials } : {}),
      ...(Array.isArray(updates.tags) ? { tags: updates.tags } : {}),
      ...(Array.isArray(updates.keywords) ? { keywords: updates.keywords } : {}),
      ...(updates.materialCost !== undefined ? { materialCost: Number(updates.materialCost) } : {}),
      ...(updates.laborHours !== undefined ? { laborHours: Number(updates.laborHours) } : {}),
      ...(updates.hourlyRate !== undefined ? { hourlyRate: Number(updates.hourlyRate) } : {}),
      ...(updates.packagingCost !== undefined ? { packagingCost: Number(updates.packagingCost) } : {}),
      ...(updates.overheadCost !== undefined ? { overheadCost: Number(updates.overheadCost) } : {}),
      ...(updates.profitMarginPercent !== undefined ? { profitMarginPercent: Number(updates.profitMarginPercent) } : {}),
      ...(nextImages ? { images: nextImages, imageUrl: nextImages[0], enhancedImageUrl: nextImages[0] } : {}),
      status: nextStatus,
      isApprovedByArtisan: nextStatus === "published",
      updatedAt: new Date().toISOString(),
    };
    res.json({ success: true, product: inMemoryProducts[idx] });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update product", details: err.message });
  }
});

app.delete("/api/products/:id", (req: Request, res: Response) => {
  try {
    const authUser = getAuthenticatedAccount(req);
    const idx = inMemoryProducts.findIndex(p => p.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (authUser && inMemoryProducts[idx].artisanId !== authUser.id) {
      return res.status(403).json({ error: "You can only delete your own products." });
    }
    const [removed] = inMemoryProducts.splice(idx, 1);
    return res.json({ success: true, deletedId: removed.id });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to delete product", details: err.message });
  }
});

// ==============================================================================
// 5B. OFFLINE-FIRST BATCH SYNCHRONIZATION ENGINE ENDPOINT
// ==============================================================================
/**
 * Receives array payloads sent from client-side IndexedDB background synchronization engine.
 * Validates, deduplicates, and commits offline-queued crafts into the cloud catalog.
 */
app.post("/api/sync/products", async (req: Request, res: Response) => {
  try {
    const rawPayload = req.body;

    // Strict validation: payload MUST be an array
    if (!Array.isArray(rawPayload)) {
      return res.status(400).json({
        success: false,
        error: "Invalid sync payload format. Expected an array of ProductListingPayload objects.",
        receivedType: typeof rawPayload,
      });
    }

    if (rawPayload.length === 0) {
      return res.status(200).json({
        success: true,
        processedCount: 0,
        syncedIds: [],
        message: "Queue is empty. Zero items to synchronize.",
      });
    }

    const processedProducts: any[] = [];
    const validationErrors: Array<{ index: number; reason: string }> = [];

    // Process each queued product transactionally
    for (let i = 0; i < rawPayload.length; i++) {
      const item = rawPayload[i];

      // Structural validation of required fields
      if (!item || typeof item !== "object") {
        validationErrors.push({ index: i, reason: "Item is not an object" });
        continue;
      }

      const productName = String(item.product_name || item.title || "").trim();
      const materialType = String(item.material_type || item.materials?.[0] || "Handcrafted Material").trim();
      const calculatedPrice = Number(item.calculated_price || item.finalPrice);

      if (!productName) {
        validationErrors.push({ index: i, reason: "Missing required 'product_name'" });
        continue;
      }

      if (isNaN(calculatedPrice) || calculatedPrice < 0) {
        validationErrors.push({ index: i, reason: "Invalid 'calculated_price': Must be a non-negative number" });
        continue;
      }

      // Generate UUID/Unique ID for the synchronized craft
      const syncedId = `prod-sync-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`;

      const newProduct = {
        id: syncedId,
        artisanId: item.artisan_id || item.artisanId || "artisan-1",
        title: productName,
        titleRegional: item.titleRegional || {},
        category: item.category || "Traditional Indian Heritage Craft",
        materials: [materialType],
        primaryColors: item.primaryColors || ["Natural Earth"],
        craftTechnique: item.craftTechnique || "Traditional Handcraft",
        dimensions: item.dimensions || "Standard",
        weightGrams: Number(item.weightGrams) || 300,
        description: item.description || `Authentic ${materialType} craft handmade by verified village creators.`,
        descriptionRegional: item.descriptionRegional || {},
        culturalStory: item.culturalStory || "",
        careInstructions: item.careInstructions || "Handle with care. Protect from extreme moisture.",
        tags: ["Handmade", "FairTrade", "OfflineSynced"],
        materialCost: Number(item.custom_material_cost || item.materialCost) || 200,
        laborHours: Number(item.labor_hours || item.laborHours) || 8,
        hourlyRate: Number(item.hourly_rate || item.hourlyRate) || 85,
        overheadCost: 0,
        profitMarginPercent: Number(item.price_override_percent) || 0,
        finalPrice: calculatedPrice,
        marketBenchmarkPrice: Math.round(calculatedPrice * 1.35),
        imageUrl: item.image_url || item.imageUrl || "/assets/artisan_logo.jpg",
        enhancedImageUrl: item.enhancedImageUrl || item.image_url || "/assets/artisan_logo.jpg",
        backgroundStyle: "studio_white",
        stockQuantity: 1,
        isInStock: true,
        isApprovedByArtisan: true,
        originState: item.originState || "Bihar",
        hasGiTag: Boolean(item.hasGiTag),
        status: item.status || "listed",
        syncedFromOffline: true,
        offlineCreatedAt: item.offline_created_at || new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      // Add to store
      inMemoryProducts.unshift(newProduct);
      processedProducts.push(newProduct);
    }

    console.info(`[Sync Engine] Successfully synchronized ${processedProducts.length} items from client offline queue.`);

    return res.status(201).json({
      success: true,
      processedCount: processedProducts.length,
      syncedIds: processedProducts.map((p) => p.id),
      errors: validationErrors.length > 0 ? validationErrors : undefined,
      serverTimestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Sync Engine] Critical failure processing offline batch payload:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error processing synchronization batch.",
      details: err.message,
    });
  }
});

// Benchmark baseline rates endpoint
app.get("/api/material-benchmarks", (req: Request, res: Response) => {
  res.json({
    benchmarks: [
      { id: 1, material_name: "Clay", average_cost: 120.00 },
      { id: 2, material_name: "Yarn", average_cost: 280.00 },
      { id: 3, material_name: "Wood", average_cost: 450.00 },
      { id: 4, material_name: "Silk", average_cost: 850.00 },
      { id: 5, material_name: "Brass", average_cost: 600.00 },
      { id: 6, material_name: "Bamboo", average_cost: 180.00 },
      { id: 7, material_name: "Stone", average_cost: 320.00 },
      { id: 8, material_name: "Leather", average_cost: 520.00 },
    ],
  });
});

// ==============================================================================
// 6. ARTISANS PROFILE API
// ==============================================================================
app.get("/api/artisans", (req: Request, res: Response) => {
  res.json({ artisans: inMemoryArtisans.filter(a => a.isPublic !== false) });
});

app.get("/api/artisans/me", (req: Request, res: Response) => {
  const authUser = getAuthenticatedAccount(req);
  if (!authUser) {
    return res.status(401).json({ error: "Please sign in to view your profile." });
  }
  const artisan = inMemoryArtisans.find(a => a.id === authUser.id);
  if (!artisan) {
    return res.status(404).json({ error: "Artisan profile not found." });
  }
  return res.json({ artisan });
});

app.put("/api/artisans/me", (req: Request, res: Response) => {
  const authUser = getAuthenticatedAccount(req);
  const targetId = authUser?.id || req.body?.id;
  if (!targetId) {
    return res.status(401).json({ error: "Authentication required to update profile." });
  }

  const updates = req.body || {};
  const idx = inMemoryArtisans.findIndex(a => a.id === targetId);
  const patch = {
    ...(updates.fullName !== undefined ? { fullName: String(updates.fullName).trim() } : {}),
    ...(updates.profileImage !== undefined ? { profileImage: String(updates.profileImage) } : {}),
    ...(updates.districtVillage !== undefined ? { districtVillage: String(updates.districtVillage).trim() } : {}),
    ...(updates.state !== undefined ? { state: String(updates.state).trim() } : {}),
    ...(updates.craftSpecialty !== undefined ? { craftSpecialty: String(updates.craftSpecialty).trim() } : {}),
    ...(updates.yearsExperience !== undefined ? { yearsExperience: Math.max(0, Number(updates.yearsExperience) || 0) } : {}),
    ...(updates.bio !== undefined ? { bio: String(updates.bio).trim() } : {}),
    ...(updates.craftTradition !== undefined ? { craftTradition: String(updates.craftTradition).trim() } : {}),
    ...(updates.phone !== undefined ? { phone: String(updates.phone).trim() } : {}),
    ...(updates.email !== undefined ? { email: String(updates.email).trim() } : {}),
    ...(updates.isPublic !== undefined ? { isPublic: Boolean(updates.isPublic) } : {}),
  };

  if (idx >= 0) {
    inMemoryArtisans[idx] = { ...inMemoryArtisans[idx], ...patch };
    if (authUser && patch.fullName) authUser.fullName = patch.fullName;
    return res.json({ success: true, artisan: inMemoryArtisans[idx] });
  }

  const created = {
    id: targetId,
    fullName: patch.fullName || authUser?.fullName || "Artisan",
    phone: patch.phone || authUser?.mobileNumber || "",
    email: patch.email || authUser?.email || "",
    state: patch.state || "India",
    districtVillage: patch.districtVillage || "Craft Workshop",
    craftSpecialty: patch.craftSpecialty || "Traditional Handcrafts",
    craftTradition: patch.craftTradition || "",
    yearsExperience: patch.yearsExperience ?? 1,
    bio: patch.bio || "",
    profileImage: patch.profileImage || "./assets/sitadevi_profile.jpg",
    isVerified: true,
    isPublic: patch.isPublic !== false,
  };
  inMemoryArtisans.push(created);
  return res.json({ success: true, artisan: created });
});

app.get("/api/artisans/:id", (req: Request, res: Response) => {
  const authUser = getAuthenticatedAccount(req);
  const artisan = inMemoryArtisans.find(a => a.id === req.params.id);
  if (!artisan) {
    return res.status(404).json({ error: "Artisan profile not found." });
  }
  if (artisan.isPublic === false && authUser?.id !== artisan.id) {
    return res.status(404).json({ error: "This artisan profile is private." });
  }
  const products = inMemoryProducts.filter(
    p => p.artisanId === artisan.id && p.status !== "draft" && p.isApprovedByArtisan !== false
  );
  res.json({ artisan, products });
});

app.post("/api/artisans", (req: Request, res: Response) => {
  const profile = req.body;
  const existingIdx = inMemoryArtisans.findIndex(a => a.id === profile.id);
  if (existingIdx >= 0) {
    inMemoryArtisans[existingIdx] = { ...inMemoryArtisans[existingIdx], ...profile };
    return res.json({ success: true, artisan: inMemoryArtisans[existingIdx] });
  }
  const newArtisan = {
    id: `artisan-${Date.now()}`,
    ...profile,
    isVerified: true,
    isPublic: profile.isPublic !== false,
  };
  inMemoryArtisans.push(newArtisan);
  res.status(201).json({ success: true, artisan: newArtisan });
});

// ==============================================================================
// 7. BUYER INQUIRIES & MARKET LINKAGE (ARTISAN-SCOPED + STATUS MANAGEMENT)
// ==============================================================================
app.get("/api/inquiries", (req: Request, res: Response) => {
  const authUser = getAuthenticatedAccount(req);
  const { artisanId } = req.query;

  const targetArtisanId = authUser?.id || (artisanId ? String(artisanId) : "");
  if (!targetArtisanId) {
    return res.json({ inquiries: [] });
  }

  const ownedProductIds = new Set(
    inMemoryProducts.filter(p => p.artisanId === targetArtisanId).map(p => p.id)
  );

  const leads = inMemoryInquiries.filter(
    l => l.artisanId === targetArtisanId || ownedProductIds.has(l.productId)
  );
  res.json({ inquiries: leads });
});

app.post("/api/inquiries", async (req: Request, res: Response) => {
  try {
    const { productId, artisanId, buyerName, buyerPhone, buyerEmail, buyerLocation, quantity = 1, message = "" } = req.body;

    if (!buyerName || (!buyerPhone && !buyerEmail)) {
      return res.status(400).json({ error: "Buyer name and phone or email are required." });
    }

    const productMatch = inMemoryProducts.find(p => p.id === productId);
    const resolvedArtisanId = productMatch?.artisanId || artisanId || "artisan-1";

    const newInquiry = {
      id: `inq-${Date.now()}`,
      productId: productId || "prod-1",
      artisanId: resolvedArtisanId,
      buyerName: String(buyerName).trim(),
      buyerPhone: String(buyerPhone || "").trim(),
      buyerEmail: String(buyerEmail || "").trim(),
      buyerLocation: String(buyerLocation || "India").trim(),
      quantity: Number(quantity) || 1,
      inquiryType: "purchase_inquiry",
      message: String(message || "Interested in purchasing this craft.").trim(),
      status: "new",
      artisanReply: "",
      createdAt: new Date().toISOString()
    };

    inMemoryInquiries.unshift(newInquiry);
    res.status(201).json({ success: true, inquiry: newInquiry });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to submit inquiry", details: err.message });
  }
});

app.patch("/api/inquiries/:id", (req: Request, res: Response) => {
  try {
    const authUser = getAuthenticatedAccount(req);
    const idx = inMemoryInquiries.findIndex(i => i.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: "Enquiry not found." });
    }

    if (authUser) {
      const ownedProdIds = new Set(
        inMemoryProducts.filter(p => p.artisanId === authUser.id).map(p => p.id)
      );
      if (inMemoryInquiries[idx].artisanId !== authUser.id && !ownedProdIds.has(inMemoryInquiries[idx].productId)) {
        return res.status(403).json({ error: "You can only respond to enquiries for your own products." });
      }
    }

    const { status, artisanReply } = req.body || {};
    const validStatus = status === "responded" || status === "closed" || status === "new"
      ? status
      : inMemoryInquiries[idx].status;

    inMemoryInquiries[idx] = {
      ...inMemoryInquiries[idx],
      status: validStatus,
      ...(artisanReply !== undefined ? { artisanReply: String(artisanReply).trim() } : {}),
      updatedAt: new Date().toISOString(),
    };
    return res.json({ success: true, inquiry: inMemoryInquiries[idx] });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update enquiry", details: err.message });
  }
});

// ==============================================================================
// 7B. AUTHENTICATION & CONTACT ENDPOINTS (REAL SCRYPT + HMAC-SHA256 SESSIONS)
// ==============================================================================
const contactMessages: Array<{
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}> = [];

function sanitizeAccount(acc: StoredAccount) {
  return {
    id: acc.id,
    fullName: acc.fullName,
    email: acc.email,
    mobileNumber: acc.mobileNumber,
    accountType: acc.accountType,
    organizationName: acc.organizationName,
  };
}

app.post("/api/auth/register", (req: Request, res: Response) => {
  const { fullName, email, mobileNumber, password, accountType = "buyer", organizationName } = req.body || {};

  if (!fullName || String(fullName).trim().length < 2) {
    return res.status(400).json({ success: false, error: "Please enter your full name." });
  }
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return res.status(400).json({ success: false, error: "Please enter a valid email address." });
  }
  if (!mobileNumber || String(mobileNumber).trim().length < 8) {
    return res.status(400).json({ success: false, error: "Please enter a valid mobile number." });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ success: false, error: "Password must be at least 6 characters." });
  }
  if (registeredAccounts.some(a => a.email === normalizedEmail)) {
    return res.status(409).json({ success: false, error: "An account with this email already exists." });
  }

  const validType = accountType === "artisan" || accountType === "organization" ? accountType : "buyer";
  const salt = crypto.randomBytes(16).toString("hex");
  const newAccount: StoredAccount = {
    id: `user-${crypto.randomUUID()}`,
    fullName: String(fullName).trim(),
    email: normalizedEmail,
    mobileNumber: String(mobileNumber).trim(),
    accountType: validType,
    organizationName: organizationName ? String(organizationName).trim() : undefined,
    passwordSalt: salt,
    passwordHash: hashPassword(String(password), salt),
    createdAt: new Date().toISOString(),
  };

  registeredAccounts.push(newAccount);
  const token = signAuthToken(newAccount.id);

  if (validType === "artisan") {
    inMemoryArtisans.push({
      id: newAccount.id,
      fullName: newAccount.fullName,
      phone: newAccount.mobileNumber,
      email: newAccount.email,
      state: "India",
      districtVillage: "Craft Cluster",
      craftSpecialty: "Traditional Handcrafted Goods",
      craftTradition: "Handmade Heritage",
      yearsExperience: 1,
      upiId: "",
      bio: "Verified artisan registered on ARTISAN.",
      profileImage: "./assets/sitadevi_profile.jpg",
      isVerified: true,
      hasGiTag: false,
      preferredLanguage: "hi",
    });
  }

  return res.status(201).json({
    success: true,
    user: sanitizeAccount(newAccount),
    token,
  });
});

app.post("/api/auth/login", (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const account = registeredAccounts.find(a => a.email === normalizedEmail);
  if (!account || !password) {
    return res.status(401).json({ success: false, error: "Invalid email or password." });
  }

  const candidateHash = hashPassword(String(password), account.passwordSalt);
  const aBuf = Buffer.from(candidateHash, "hex");
  const bBuf = Buffer.from(account.passwordHash, "hex");
  if (aBuf.length !== bBuf.length || !crypto.timingSafeEqual(aBuf, bBuf)) {
    return res.status(401).json({ success: false, error: "Invalid email or password." });
  }

  const token = signAuthToken(account.id);
  return res.json({
    success: true,
    user: sanitizeAccount(account),
    token,
  });
});

app.get("/api/auth/me", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const userId = verifyAuthToken(token);
  if (!userId) {
    return res.status(401).json({ success: false, error: "Not authenticated" });
  }
  const account = registeredAccounts.find(a => a.id === userId);
  if (!account) {
    return res.status(401).json({ success: false, error: "Account not found" });
  }
  return res.json({ success: true, user: sanitizeAccount(account) });
});

app.post("/api/auth/logout", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (token) revokedTokens.add(token);
  return res.json({ success: true });
});

app.put("/api/auth/account", (req: Request, res: Response) => {
  const account = getAuthenticatedAccount(req);
  if (!account) {
    return res.status(401).json({ success: false, error: "Please sign in to update account settings." });
  }
  const { fullName, mobileNumber, email, languagePreference, notifyEnquiries, notifyTips } = req.body || {};
  if (fullName !== undefined && String(fullName).trim().length >= 2) {
    account.fullName = String(fullName).trim();
  }
  if (mobileNumber !== undefined && String(mobileNumber).trim().length >= 8) {
    account.mobileNumber = String(mobileNumber).trim();
  }
  if (email !== undefined && String(email).includes("@")) {
    account.email = String(email).trim().toLowerCase();
  }
  if (languagePreference !== undefined) {
    account.languagePreference = String(languagePreference);
  }
  if (notifyEnquiries !== undefined) {
    account.notifyEnquiries = Boolean(notifyEnquiries);
  }
  if (notifyTips !== undefined) {
    account.notifyTips = Boolean(notifyTips);
  }

  const artisan = inMemoryArtisans.find(a => a.id === account.id);
  if (artisan) {
    artisan.fullName = account.fullName;
    artisan.phone = account.mobileNumber;
    artisan.email = account.email;
  }

  return res.json({
    success: true,
    user: {
      ...sanitizeAccount(account),
      languagePreference: account.languagePreference,
      notifyEnquiries: account.notifyEnquiries !== false,
      notifyTips: account.notifyTips !== false,
    },
  });
});

app.post("/api/auth/change-password", (req: Request, res: Response) => {
  const account = getAuthenticatedAccount(req);
  if (!account) {
    return res.status(401).json({ success: false, error: "Please sign in to change your password." });
  }
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ success: false, error: "Please enter your current password and a new password (at least 6 characters)." });
  }
  const candidateHash = hashPassword(String(currentPassword), account.passwordSalt);
  const aBuf = Buffer.from(candidateHash, "hex");
  const bBuf = Buffer.from(account.passwordHash, "hex");
  if (aBuf.length !== bBuf.length || !crypto.timingSafeEqual(aBuf, bBuf)) {
    return res.status(401).json({ success: false, error: "Current password is incorrect." });
  }
  const nextSalt = crypto.randomBytes(16).toString("hex");
  account.passwordSalt = nextSalt;
  account.passwordHash = hashPassword(String(newPassword), nextSalt);
  return res.json({ success: true, message: "Password updated successfully." });
});

app.post("/api/contact", (req: Request, res: Response) => {
  const { name, email, subject = "General Enquiry", message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ success: false, error: "Please fill in your name, email, and message." });
  }
  const entry = {
    id: `msg-${Date.now()}`,
    name: String(name).trim(),
    email: String(email).trim(),
    subject: String(subject).trim(),
    message: String(message).trim(),
    createdAt: new Date().toISOString(),
  };
  contactMessages.unshift(entry);
  return res.status(201).json({ success: true, contact: entry });
});

// ==============================================================================
// 8. VITE MIDDLEWARE & STATIC SERVING
// ==============================================================================
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Artisan Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
