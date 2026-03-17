import { v } from "convex/values";
import { action } from "./_generated/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── The core rewriting prompt ─────────────────────────────────────────
// This is the single most important thing. One focused, clear prompt
// that targets exactly what AI detectors measure.
const REWRITE_SYSTEM = `You are a human. Not an AI pretending to be human. A real person who writes imperfectly.

HARD RULES YOU MUST FOLLOW:
1. Use passive voice in roughly 30-40% of sentences. Example: "The data was collected over three months" instead of "We collected data over three months." AI almost never uses passive voice enough, and detectors know this.
2. Vary sentence length dramatically. Follow this pattern loosely: long (20+ words), short (under 8 words), medium (10-15 words), very short (3-6 words), long again. Never write 3 sentences of similar length in a row.
3. Use contractions naturally: don't, it's, won't, they're, can't, wouldn't, shouldn't.
4. Start 2-3 sentences with "And", "But", "So", or "Because". Teachers say not to. People do it anyway.
5. Include at least one sentence fragment. Not a full sentence. Just a thought.
6. Occasionally repeat a word in nearby sentences instead of finding a synonym. Humans repeat words. AI obsessively avoids repetition.
7. Use at least 2-3 simple filler/hedge phrases: "I think", "probably", "sort of", "in a way", "it seems like", "to be fair", "honestly", "at least from what I can tell".
8. Make one or two slightly wordy or awkward constructions. Don't make every sentence perfectly concise.
9. End abruptly or with an open thought. Never wrap up with a tidy conclusion paragraph that restates everything.

BANNED (never use these — they are AI giveaways):
Words: delve, crucial, pivotal, moreover, furthermore, comprehensive, robust, leverage, utilize, facilitate, streamline, foster, encompasses, embark, undeniable, notably, intricate, nuanced, captivating, bustling, realm, landscape, tapestry, multifaceted, holistic, paradigm, navigate, cutting-edge, commendable, henceforth, thereby, consequently, subsequently, additionally, nevertheless
Phrases: "In conclusion", "It's important to note", "It's worth noting", "In today's", "In the realm of", "plays a crucial role", "shed light on", "a myriad of", "dive into", "It is essential"
Punctuation: em dashes (—), double hyphens (--). Use commas or periods instead.`;

const TONE_ADDITIONS: Record<string, string> = {
  casual: `
TONE: Write like you're explaining this to a friend over coffee. Informal. Relaxed. Use "pretty much", "kinda", "honestly", "I mean", "the thing is", "like" as filler. It's okay to ramble slightly. Use "stuff" and "things" sometimes instead of being specific. Mix in a question or two.`,

  professional: `
TONE: Write like a senior colleague drafting an email or short report. Confident but not stiff. Use "I think", "in my experience", "what we've found is" when it fits. Plain English, not corporate speak. Ok to have a slightly informal moment mixed with formal statements.`,

  academic: `
TONE: Write like a real university student working on an essay at 11pm. Use hedging: "seems to suggest", "it could be argued", "arguably", "this might indicate", "there's reason to think". Be slightly wordy in places (real students are). Mix passive and active voice loosely. Don't define obvious terms. Some paragraphs can be dense, others simple.`,

  creative: `
TONE: Write with a distinct personal voice. Use unexpected word choices, concrete imagery, and occasional humor or irony. Vary rhythm deliberately. Some sentences should flow, others should stop short. Use comparisons that feel personal, not generic. Let the writing breathe.`,
};

function buildPrompt(tone: string, text: string): string {
  const toneAddition = TONE_ADDITIONS[tone] || "";
  return `${toneAddition}

Rewrite the following text completely in your own words. Keep the same meaning and information, but make it sound like YOU wrote it from scratch.

TEXT TO REWRITE:
"""
${text}
"""

Remember: passive voice in ~30-40% of sentences, wild sentence length variation, contractions, sentence fragments, no banned words, no neat conclusion. Output ONLY the rewritten text.`;
}

// ── Post-processing ───────────────────────────────────────────────────
const BANNED_WORD_MAP: Record<string, string> = {
  "delve": "look into", "crucial": "important", "pivotal": "key",
  "moreover": "plus", "furthermore": "and", "landscape": "space",
  "tapestry": "mix", "multifaceted": "complex", "holistic": "overall",
  "paradigm": "approach", "leverage": "use", "utilize": "use",
  "facilitate": "help with", "comprehensive": "full", "robust": "solid",
  "streamline": "simplify", "cutting-edge": "modern", "game-changer": "big deal",
  "foster": "build", "underscore": "show", "underscores": "shows",
  "encompass": "cover", "encompasses": "covers", "embark": "start",
  "undeniable": "clear", "notably": "especially", "commendable": "solid",
  "intricate": "detailed", "bustling": "busy", "captivating": "interesting",
  "navigate": "work through", "realm": "area", "nuanced": "subtle",
  "additionally": "also", "nevertheless": "still", "consequently": "so",
  "subsequently": "then", "henceforth": "from now on", "whereas": "while",
  "thus": "so", "thereby": "which", "however": "but",
};

const BANNED_REGEXES = Object.keys(BANNED_WORD_MAP).map(
  (w) => ({ pattern: new RegExp(`\\b${w}\\b`, "gi"), replacement: BANNED_WORD_MAP[w] })
);

function postProcess(text: string): string {
  let out = text;

  // Kill em dashes, en dashes, double hyphens
  out = out.replace(/\s*[—–]\s*/g, ", ");
  out = out.replace(/ --/g, ", ").replace(/--/g, ", ");

  // Replace banned words
  for (const { pattern, replacement } of BANNED_REGEXES) {
    out = out.replace(pattern, replacement);
  }

  // Strip AI opener patterns
  out = out.replace(/^In today'?s \w+ \w*,?\s*/i, "");
  out = out.replace(/^In the realm of \w+,?\s*/i, "");
  out = out.replace(/It is (essential|important) (that |to )/gi, "");

  // Strip phrases like "In conclusion, " at start of sentences
  out = out.replace(/In conclusion,?\s*/gi, "");
  out = out.replace(/It'?s (important|worth) to note (that )?/gi, "");
  out = out.replace(/It'?s worth noting (that )?/gi, "");

  // Clean double spaces and trim
  out = out.replace(/ {2,}/g, " ").trim();

  return out;
}

// ── Model callers (single pass — two-pass adds more AI patterns) ──────

async function callGemini(text: string, tone: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: REWRITE_SYSTEM,
    generationConfig: { temperature: 1.0, topP: 0.90, topK: 40 },
  });

  try {
    const result = await model.generateContent(buildPrompt(tone, text));
    return postProcess(result.response.text());
  } catch {
    throw new Error("MODEL_ERROR");
  }
}

async function callGrok(text: string, tone: string): Promise<string> {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) throw new Error("Grok API key not configured");

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4-1-fast-reasoning",
      messages: [
        { role: "system", content: REWRITE_SYSTEM },
        { role: "user", content: buildPrompt(tone, text) },
      ],
      temperature: 1.0,
      top_p: 0.88,
    }),
  });

  if (response.status === 429) throw new Error("MODEL_BUSY");
  if (!response.ok) throw new Error("MODEL_ERROR");

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("MODEL_ERROR");
  return postProcess(content);
}

async function callKimi(text: string, tone: string): Promise<string> {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error("Kimi API key not configured");

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch("https://api.moonshot.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "kimi-k2.5",
        messages: [
          { role: "system", content: REWRITE_SYSTEM },
          { role: "user", content: buildPrompt(tone, text) },
        ],
        temperature: 1.0,
        top_p: 0.88,
      }),
    });

    if (response.status === 429) {
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw new Error("MODEL_BUSY");
    }
    if (!response.ok) throw new Error("MODEL_ERROR");

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("MODEL_ERROR");
    return postProcess(content);
  }

  throw new Error("MODEL_BUSY");
}

// ── Main action ───────────────────────────────────────────────────────
export const humanize = action({
  args: {
    text: v.string(),
    tone: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const { text, tone, model } = args;

    if (!text.trim()) {
      throw new Error("Text is required");
    }

    if (!TONE_ADDITIONS[tone]) {
      throw new Error("Valid tone is required (casual, professional, academic, creative)");
    }

    try {
      if (model === "monk") {
        return await callGemini(text, tone);
      }
      if (model === "hypermonk") {
        return await callKimi(text, tone);
      }
      return await callGrok(text, tone);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "MODEL_BUSY") {
        throw new Error(
          "This model is currently busy due to high demand. Please try again in a moment or switch to a different model."
        );
      }
      throw new Error(
        "Something went wrong while humanizing your text. Please try again or switch to a different model."
      );
    }
  },
});
