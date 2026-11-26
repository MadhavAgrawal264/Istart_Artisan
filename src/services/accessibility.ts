/**
 * ARTISAN MARKETPLACE: VILLAGE ACCESSIBILITY & AUDIO NARRATION HELPER
 * File: src/services/accessibility.ts
 * 
 * Implements accessible Text-To-Speech (TTS) using the browser's native
 * Web Speech API (window.speechSynthesis) and tactile auditory chimes.
 * Designed specifically for rural creators with limited digital or textual literacy.
 */

/**
 * Text-to-Speech Assistant for Village Creators
 */
export class VillageAudioAssistant {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private activeAudioButton: HTMLElement | null = null;
  private preferredLang: string;

  constructor(preferredLang = "hi-IN") {
    this.preferredLang = preferredLang;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.synth = window.speechSynthesis;
    } else {
      console.warn("[Speech] Web Speech API (speechSynthesis) is not supported in this browser.");
    }
  }

  /**
   * Checks if native speech synthesis is operational.
   */
  public isSupported(): boolean {
    return Boolean(this.synth);
  }

  /**
   * Sets user's preferred spoken language code (e.g. 'hi-IN', 'en-IN', 'ta-IN').
   */
  public setLanguage(langCode: string): void {
    this.preferredLang = langCode;
  }

  /**
   * Resolves the best available synthetic voice for the target language.
   */
  private getBestVoice(): SpeechSynthesisVoice | null {
    if (!this.synth) return null;

    const voices = this.synth.getVoices();
    if (!voices || voices.length === 0) return null;

    // 1. Direct language code match
    const langPrefix = this.preferredLang.split("-")[0].toLowerCase();
    const exactMatch = voices.find(v => v.lang.toLowerCase() === this.preferredLang.toLowerCase());
    if (exactMatch) return exactMatch;

    // 2. Regional prefix match (e.g. 'hi', 'en-IN')
    const regionalMatch = voices.find(v => v.lang.toLowerCase().startsWith(langPrefix));
    if (regionalMatch) return regionalMatch;

    // 3. Fallback to default system voice
    return voices.find(v => v.default) || voices[0] || null;
  }

  /**
   * Audibly speaks a string of text.
   * Cancels any prior queued speech to prevent audio overlapping.
   * 
   * @param text The sentence or form label to read aloud.
   * @param sourceButton Optional triggering button element to apply pulse animation.
   */
  public speak(text: string, sourceButton?: HTMLElement): void {
    if (!this.synth) {
      console.warn("[Speech] Cannot speak: SpeechSynthesis is unavailable.");
      return;
    }

    const cleanText = text.trim();
    if (!cleanText) return;

    // Immediately stop ongoing utterances
    this.stop();

    // Play subtle soft chime tone before speaking to signal audio start
    this.playTactileChime();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    this.currentUtterance = utterance;

    // Configure pitch and speed for village clarity (slightly slower for high comprehension)
    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    utterance.lang = this.preferredLang;

    const matchedVoice = this.getBestVoice();
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    // Visual feedback bindings
    if (sourceButton) {
      this.activeAudioButton = sourceButton;
      sourceButton.classList.add("audio-active-pulse");
      sourceButton.setAttribute("aria-pressed", "true");
    }

    utterance.onend = () => {
      this.clearActiveButtonState();
    };

    utterance.onerror = (e) => {
      console.error("[Speech] Utterance error:", e);
      this.clearActiveButtonState();
    };

    this.synth.speak(utterance);
  }

  /**
   * Halts any active or queued speech immediately.
   */
  public stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
    this.clearActiveButtonState();
  }

  /**
   * Removes visual pulse indicator from active speaker button.
   */
  private clearActiveButtonState(): void {
    if (this.activeAudioButton) {
      this.activeAudioButton.classList.remove("audio-active-pulse");
      this.activeAudioButton.setAttribute("aria-pressed", "false");
      this.activeAudioButton = null;
    }
    this.currentUtterance = null;
  }

  /**
   * Produces an accessible, synthetic audio confirmation chime
   * using the native Web Audio API (zero external mp3 assets needed).
   */
  private playTactileChime(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      // Gentle melodic frequency pair (520Hz rising to 650Hz)
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(650, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // AudioContext may be restricted by autoplay policy; fail gracefully
    }
  }

  /**
   * Automatically scans the document and attaches click listeners to all
   * floating speaker buttons matching the `.audio-btn` selector.
   */
  public attachToAllButtons(container: HTMLElement | Document = document): void {
    const buttons = container.querySelectorAll<HTMLButtonElement>(".audio-btn");

    buttons.forEach((btn) => {
      // Avoid duplicate listener attachments
      if (btn.dataset.audioBound === "true") return;
      btn.dataset.audioBound = "true";

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // 1. Check data-audio-text attribute
        let textToRead = btn.getAttribute("data-audio-text");

        // 2. If missing, look for linked input/label via data-audio-target
        if (!textToRead) {
          const targetId = btn.getAttribute("data-audio-target");
          if (targetId) {
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
              const label = document.querySelector(`label[for="${targetId}"]`);
              textToRead = label?.textContent || targetEl.getAttribute("aria-label") || targetEl.getAttribute("placeholder");
            }
          }
        }

        // 3. Fallback to closest label or parent text
        if (!textToRead) {
          const parentLabel = btn.closest("label") || btn.parentElement?.querySelector("label");
          textToRead = parentLabel?.textContent || btn.getAttribute("aria-label") || "";
        }

        if (textToRead) {
          // If currently speaking this button, toggle stop; else speak
          if (btn.classList.contains("audio-active-pulse")) {
            this.stop();
          } else {
            this.speak(textToRead, btn);
          }
        }
      });
    });
  }
}
