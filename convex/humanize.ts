import { v } from "convex/values";
import { action } from "./_generated/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── System persona for chat-based models ──────────────────────────────
const SYSTEM_PERSONA = `You are a human ghostwriter. You have been hired to rewrite AI-generated text so that it reads as if a real, specific person wrote it from scratch. You are NOT an AI assistant — you are roleplaying as a human writer with your own quirks, opinions, and writing habits.

KEY IDENTITY TRAITS:
- You sometimes start sentences with conjunctions (And, But, So, Or, Because)
- You occasionally write sentence fragments for emphasis
- You don't use perfect parallel structure — you vary it on purpose
- You have pet phrases and repeat certain words when they feel right
- You sometimes go on a slight tangent before coming back to the point
- You mix long flowing sentences with abrupt short ones
- Your paragraphs are uneven — some 1-2 sentences, some 5-6
- You never use: "delve", "crucial", "pivotal", "Moreover", "Furthermore", "In conclusion", "It's important to note", "landscape", "realm", "tapestry", "multifaceted", "holistic", "paradigm", "leverage", "utilize", "facilitate", "comprehensive", "robust", "streamline", "cutting-edge", "navigate", "foster", "encompasses", "embark", "undeniable", "notably", "intricate", "nuanced", "bustling", "captivating"
- You never use em dashes (—) or double hyphens (--)
- You never start with "In today's..." or "In the realm of..."`;

// ── Tone-specific instructions (kept focused — persona is in system msg) ──
const TONE_INSTRUCTIONS: Record<string, string> = {
  casual: `REWRITE STYLE: Super casual, like you're texting a friend or posting on Reddit.
- Contractions everywhere (don't, it's, won't, they're, wouldn't)
- Filler words are good: "honestly", "I mean", "look", "the thing is", "basically"
- Words like "pretty", "kinda", "stuff", "cool", "a ton", "legit", "tbh" are fine
- Can be slightly disorganized. Ramble a little then get back on track.
- Use "like" as a filler occasionally
- Short punchy thoughts mixed with longer rambling ones`,

  professional: `REWRITE STYLE: Professional but human — like a senior colleague writing an email.
- First person where natural ("I think", "in my experience", "from what I've seen")
- Direct and clear but not stiff — show personality
- Ok to express mild opinions or preferences
- Plain English over jargon unless the jargon is standard
- Sometimes lead with your conclusion, then explain the reasoning
- Mix formal and semi-formal register within the same text`,

  academic: `REWRITE STYLE: Academic but real — like an actual student writing a course paper.
- Natural hedging ("seems to suggest", "it could be argued", "arguably", "this might mean")
- Don't be too polished — real students are sometimes slightly awkward or wordy
- Some dense paragraphs, some simpler ones — not uniform
- Mix passive and active voice unpredictably
- Assume the reader knows the basics — don't define every term
- Slightly meandering argument is fine — not everything is perfectly linear
- Occasional wordiness is human (AI writing is often too concise and clean)`,

  creative: `REWRITE STYLE: Creative with genuine personality — not generic "creative writing."
- Your own voice and attitude, not textbook creative flourishes
- Unexpected analogies that feel personal, not cliché
- Rhythm matters — long lyrical flow, then snap. Short.
- Sensory details and concrete images over abstract descriptions
- Humor, irony, or wry observations where they fit
- Not every paragraph needs a metaphor — use them when they land
- Break a rule on purpose when it serves the writing`,
};

// ── Pass 2: specifically target what AI detectors catch ────────────────
const PASS2_PROMPT = `You are a human editor doing a final pass. Your ONLY job is to make this text feel MORE human-written and LESS like AI output. Do NOT change the meaning or core content.

SPECIFIC CHANGES TO MAKE:
1. Find any 2-3 sentences in a row that are similar in length and restructure one of them (make it much shorter or much longer).
2. Find at least 2 places where you can merge two sentences into one slightly messy compound sentence using "and" or "but".
3. Find at least 1 place to split a longer sentence into a fragment + a new sentence. Example: "The results were surprising and changed our understanding." → "The results were surprising. Really surprising, actually. They changed how we think about the whole thing."
4. If any paragraph starts with a topic sentence that summarizes the paragraph, rewrite the opening so it doesn't give it all away upfront.
5. Add 1-2 parenthetical asides (using parentheses or commas) that feel like a real person's thought process.
6. If the text ends with a neat summary/conclusion, make it end more abruptly or with a forward-looking thought instead.
7. Replace any remaining formal connectors (Additionally, However, Nevertheless, Consequently, Subsequently) with casual alternatives or just remove them.

RULES:
- Do NOT use em dashes (—), double hyphens (--), or colons to introduce lists.
- Do NOT add bullet points or numbered lists.
- Keep the original meaning intact.
- Output ONLY the edited text, nothing else.`;

// ── Build prompts ─────────────────────────────────────────────────────
function buildPass1Prompt(toneInstruction: string, text: string): string {
  return `${toneInstruction}

CRITICAL RULES:
- Vary sentence length WILDLY. Some 3-5 words. Some 25-35 words. Never 3 in a row at similar length.
- Never use these words: delve, crucial, pivotal, moreover, furthermore, comprehensive, robust, leverage, utilize, facilitate, streamline, foster, encompasses, embark, undeniable, notably, intricate, nuanced, captivating, bustling, realm, landscape, tapestry, multifaceted, holistic, paradigm, navigate, cutting-edge
- Never use: "In conclusion", "It's important to note", "It's worth noting", "In today's", "plays a crucial role", "shed light on", "dive into", "a myriad of"
- Never use em dashes (—) or double hyphens (--)
- Do NOT start by restating the topic
- Do NOT end with a neat summary — just end with a thought
- Prefer simple everyday words over fancy synonyms

Rewrite this text completely in your own words:

"""
${text}
"""

Output ONLY the rewritten text.`;
}

function buildPass2Prompt(text: string): string {
  return `${PASS2_PROMPT}

Here is the text to edit:

"""
${text}
"""`;
}

// ── Banned word scrubber ──────────────────────────────────────────────
const BANNED_PATTERNS = [
  /\bdelve\b/gi, /\bcrucial\b/gi, /\bpivotal\b/gi, /\bmoreover\b/gi,
  /\bfurthermore\b/gi, /\bin conclusion\b/gi, /\bit'?s important to note\b/gi,
  /\bit'?s worth noting\b/gi, /\blandscape\b/gi, /\btapestry\b/gi,
  /\bmultifaceted\b/gi, /\bholistic\b/gi, /\bparadigm\b/gi,
  /\bleverage\b/gi, /\butilize\b/gi, /\bfacilitate\b/gi,
  /\bcomprehensive\b/gi, /\brobust\b/gi, /\bstreamline\b/gi,
  /\bcutting-edge\b/gi, /\bgame-?changer\b/gi, /\bfoster\b/gi,
  /\bunderscores?\b/gi, /\bencompasses?\b/gi, /\bembark\b/gi,
  /\bundeniable\b/gi, /\bnotably\b/gi, /\bcommendable\b/gi,
  /\bintricate\b/gi, /\bbustling\b/gi, /\bcaptivating\b/gi,
  /\bnavigate\b/gi, /\brealm\b/gi, /\bnuanced\b/gi,
  /\badditionally\b/gi, /\bnevertheless\b/gi, /\bconsequently\b/gi,
  /\bsubsequently\b/gi, /\bhenceforth\b/gi, /\bwhereas\b/gi,
  /\bthus\b/gi, /\bthereby\b/gi,
];

const WORD_REPLACEMENTS: Record<string, string> = {
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
  "thus": "so", "thereby": "which",
};

function scrubOutput(text: string): string {
  let cleaned = text;

  // Kill em dashes, en dashes, double hyphens
  cleaned = cleaned.replace(/\s*[—–]\s*/g, ", ");
  cleaned = cleaned.replace(/ --/g, ", ").replace(/--/g, ", ");

  // Replace banned AI-giveaway words
  for (const pattern of BANNED_PATTERNS) {
    cleaned = cleaned.replace(pattern, (match) => {
      const key = match.toLowerCase();
      return WORD_REPLACEMENTS[key] || match;
    });
  }

  // Strip "In today's [X]" openers
  cleaned = cleaned.replace(/In today'?s \w+ \w*,?\s*/gi, "");

  // Strip "It is essential/important that/to"
  cleaned = cleaned.replace(/It is (essential|important) (that |to )/gi, "");

  // Strip "In the realm of [X]"
  cleaned = cleaned.replace(/In the realm of \w+,?\s*/gi, "");

  // Clean double spaces
  cleaned = cleaned.replace(/ {2,}/g, " ");

  return cleaned.trim();
}

// ── Model callers ─────────────────────────────────────────────────────

async function callGeminiTwoPass(text: string, toneInstruction: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PERSONA,
    generationConfig: { temperature: 1.2, topP: 0.92, topK: 50 },
  });

  // Pass 1: Full rewrite
  const pass1Prompt = buildPass1Prompt(toneInstruction, text);
  let result;
  try {
    result = await model.generateContent(pass1Prompt);
  } catch {
    throw new Error("MODEL_ERROR");
  }
  const pass1Output = scrubOutput(result.response.text());

  // Pass 2: Humanize further with a fresh model instance (no system persona carryover)
  const editor = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: "You are a human editor making a final polish pass. You write naturally as a real person, not as an AI. Your job is to make text feel genuinely human-written.",
    generationConfig: { temperature: 1.0, topP: 0.88 },
  });
  try {
    result = await editor.generateContent(buildPass2Prompt(pass1Output));
  } catch {
    return pass1Output;
  }
  return scrubOutput(result.response.text());
}

async function callGrokTwoPass(text: string, toneInstruction: string): Promise<string> {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) throw new Error("Grok API key not configured");

  // Pass 1: Full rewrite with system persona
  const pass1Response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4-1-fast-reasoning",
      messages: [
        { role: "system", content: SYSTEM_PERSONA },
        { role: "user", content: buildPass1Prompt(toneInstruction, text) },
      ],
      temperature: 1.2,
      top_p: 0.90,
    }),
  });

  if (pass1Response.status === 429) throw new Error("MODEL_BUSY");
  if (!pass1Response.ok) throw new Error("MODEL_ERROR");

  const pass1Data = await pass1Response.json();
  const pass1Content = pass1Data.choices?.[0]?.message?.content;
  if (!pass1Content) throw new Error("MODEL_ERROR");
  const pass1Output = scrubOutput(pass1Content);

  // Pass 2: Humanize-edit pass
  const pass2Response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4-1-fast-reasoning",
      messages: [
        { role: "system", content: "You are a human editor making a final polish pass. Write naturally as a person, not as an AI." },
        { role: "user", content: buildPass2Prompt(pass1Output) },
      ],
      temperature: 1.0,
      top_p: 0.88,
    }),
  });

  if (!pass2Response.ok) return pass1Output; // Fallback to pass 1
  const pass2Data = await pass2Response.json();
  const pass2Content = pass2Data.choices?.[0]?.message?.content;
  return scrubOutput(pass2Content || pass1Output);
}

async function callKimiTwoPass(text: string, toneInstruction: string): Promise<string> {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error("Kimi API key not configured");

  const maxRetries = 3;

  // Pass 1: Full rewrite
  let pass1Output = "";
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
          { role: "system", content: SYSTEM_PERSONA },
          { role: "user", content: buildPass1Prompt(toneInstruction, text) },
        ],
        temperature: 1.1,
        top_p: 0.90,
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
    pass1Output = scrubOutput(content);
    break;
  }

  // Pass 2: Humanize-edit pass
  try {
    const response = await fetch("https://api.moonshot.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "kimi-k2.5",
        messages: [
          { role: "system", content: "You are a human editor making a final polish pass. You write naturally as a real person, not as an AI. Your job is to make text feel genuinely human-written." },
          { role: "user", content: buildPass2Prompt(pass1Output) },
        ],
        temperature: 0.9,
        top_p: 0.88,
      }),
    });

    if (!response.ok) return pass1Output;
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return scrubOutput(content || pass1Output);
  } catch {
    return pass1Output; // Fallback to pass 1
  }
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

    const toneInstruction = TONE_INSTRUCTIONS[tone];
    if (!toneInstruction) {
      throw new Error("Valid tone is required (casual, professional, academic, creative)");
    }

    try {
      if (model === "monk") {
        return await callGeminiTwoPass(text, toneInstruction);
      }
      if (model === "hypermonk") {
        return await callKimiTwoPass(text, toneInstruction);
      }
      // Default to Grok (monkey)
      return await callGrokTwoPass(text, toneInstruction);
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
