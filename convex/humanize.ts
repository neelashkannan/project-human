import { v } from "convex/values";
import { action } from "./_generated/server";

const MAX_INPUT_WORDS = 500;

// ── 3-step pipeline using tool/function calling ───────────────────────
// Step 1: EXTRACT — model uses a tool to decompose text into key points,
//         tone observations, subject, and sentence structure info.
// Step 2: GENERATE — a SEPARATE call gets ONLY the key points (never sees
//         original AI text) and rewrites using the full humanization rules.
// Step 3: POST-PROCESS — banned words, contractions, AI phrase stripping.

// ── Step 1: Tool definitions for extraction ───────────────────────────
const EXTRACT_TOOL = {
  type: "function" as const,
  function: {
    name: "extract_content",
    description: "Extract the key ideas, facts, and arguments from the given text. Break them into individual points that capture ALL the information.",
    parameters: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "What is this text about? One sentence.",
        },
        key_points: {
          type: "array",
          items: { type: "string" },
          description: "Each distinct idea, fact, claim, or argument as a separate bullet. Include specific details, numbers, names. Don't paraphrase — capture the raw information.",
        },
        original_tone: {
          type: "string",
          description: "How does the original text sound? e.g. 'formal academic', 'corporate', 'robotic', 'textbook-like'",
        },
        word_count: {
          type: "number",
          description: "Approximate word count of the original text.",
        },
        has_citations: {
          type: "boolean",
          description: "Does the text contain citations or references to authors/sources?",
        },
      },
      required: ["subject", "key_points", "original_tone", "word_count", "has_citations"],
    },
  },
};

// ── Step 2: The humanization system prompt (user's method) ────────────
const HUMANIZER_SYSTEM = `You are a human rewriter. Your job is to take the provided key points and write them into flowing prose that NO AI detection tool can flag. Follow every rule below strictly.

=== CORE REWRITE RULES ===

1. PASSIVE VOICE THROUGHOUT
   Restructure every sentence so the subject receives the action.
   - Instead of "The company developed a new strategy" write "A new strategy was developed by the company."

2. DESTROY UNIFORMITY
   AI writes with consistent rhythm. Break it:
   - Alternate between short sentences (4-8 words) and long rambling ones (25-40 words)
   - Make some paragraphs 1-2 sentences. Others 5-7. No pattern.
   - Never start 3+ consecutive sentences the same way

3. INJECT IMPERFECTION
   Add 2-3 slightly awkward phrasings per 300 words:
   - "It was through this that the point was eventually arrived at."
   - "The extent to which this was understood is, admittedly, debatable."
   - "What was meant by this was not immediately clear, but it was worked through."
   Real humans write clunky sentences. AI doesn't.

4. HEDGING & SELF-CORRECTION
   Sprinkle doubt throughout:
   - "It must be said that..."
   - "Whether this is entirely accurate is uncertain, but..."
   - "It could be argued — though perhaps not convincingly — that..."
   - "On reflection, this point may have been overstated."
   - "Admittedly, this was not something that was fully considered at first."

5. KILL SMOOTH TRANSITIONS
   NEVER use: Furthermore, Moreover, Additionally, In addition, It is worth noting, In light of, Consequently, Subsequently, Thus, Hence, Therefore (at start of sentence)
   
   INSTEAD use:
   - "That said..." / "On a different note..." / "Going back to..."
   - "What was odd, though..." / "The thing is..." / "Interestingly enough..."
   - Or just start the next paragraph cold with no transition at all.

6. BANNED WORDS (AI-flagged vocabulary — never use these):
   delve, crucial, landscape, multifaceted, holistic, synergy, leverage, utilize, facilitate, comprehensive, cutting-edge, groundbreaking, game-changer, paradigm, robust, streamline, ecosystem, empower, innovative, transformative, harness, foster, underpin, underscore, pivotal, nuanced, intricate, realm, avenue, facet, beacon, tapestry, testament, embark, navigate (metaphorical), shed light, at the end of the day, it's important to note, in today's world

   REPLACE WITH: simpler, plainer words. "Use" not "utilize". "Important" not "crucial". "Complex" not "multifaceted". "Help" not "facilitate".

7. MIX FORMALITY LEVELS
   Within the same paragraph, shift between formal and casual:
   - "A thorough analysis was conducted... though honestly, the results were not what had been expected at all."
   - "The framework was applied systematically — or at least, that was the intention."

8. ADD HUMAN TEXTURE
   Based on the content, add 1-2 of these per section:
   - A brief personal aside ("This was something that had been encountered before in a different context...")
   - A mild emotional reaction ("It was somewhat frustrating to discover that...")
   - A moment of honest confusion ("What was meant by this was not immediately obvious...")
   - An offhand observation ("Oddly enough..." / "What stood out, for some reason, was...")

9. VARY CITATION/REFERENCE STYLE (if applicable)
   Don't always use clean "(Author, Year)" format. Mix:
   - "...as was pointed out by [Author] in [Year]..."
   - "[Author]'s work from [Year], which was only encountered recently..."
   - "It was noted in [Author] ([Year]) that..."

10. SENTENCE OPENERS — ROTATE THESE
    Never fall into a pattern. Use a mix of:
    - Subject-first: "The results were..."
    - Prepositional: "In this case, it was found that..."
    - Temporal: "At that point, the decision was made to..."
    - Concessive: "Despite this, it was still believed that..."
    - Conditional: "Had this been known earlier, a different approach might have been taken."
    - Fragmented: "Not ideal. But it was what was available."

=== OUTPUT REQUIREMENTS ===
- Maintain the original meaning and all factual content exactly
- Do NOT add headers, bullet points, or formatting
- Do NOT summarize or shorten — write fully covering every point
- The output should read like a real person wrote it on their first or second draft
- Write ONLY the rewritten text, nothing else`;

// ── Tone modifiers appended to the system prompt ──────────────────────
const TONE_MODIFIERS: Record<string, string> = {
  casual: `

=== TONE: CASUAL ===
Write in a relaxed, conversational tone. Use contractions freely (don't, it's, we're). Keep sentences short and punchy where possible. Use everyday vocabulary — no jargon or overly formal phrasing. Imagine you're explaining something to a friend over coffee. Throw in colloquial expressions naturally. The text should feel approachable, warm, and easy to read.`,

  academic: `

=== TONE: ACADEMIC ===
Write in a formal, scholarly tone appropriate for an essay, research paper, or academic submission. Use passive voice more heavily. Include hedging language ("it can be argued that", "evidence suggests"). Maintain objectivity — avoid first-person opinions unless presenting analysis. Use precise, discipline-appropriate vocabulary. Vary sentence complexity with some longer, multi-clause sentences. The text should read like it was written by a diligent university student.`,

  professional: `

=== TONE: PROFESSIONAL ===
Write in a polished, business-appropriate tone. Be clear, concise, and direct. Use confident but measured language — avoid being overly casual or overly stiff. Structure points logically. Use proper grammar and minimal contractions. The text should feel like a well-written report, email, or business document — authoritative yet accessible.`,

  creative: `

=== TONE: CREATIVE ===
Write with flair and personality. Use vivid language, metaphors, and varied rhythm. Play with sentence structure — mix fragments, long flowing sentences, and unexpected turns. Let the writing breathe with personality. Add color through descriptive language and original phrasing. The text should feel like it was written by someone with a distinctive voice who enjoys the craft of writing.`,
};

// Valid tones for validation
const VALID_TONES = new Set(Object.keys(TONE_MODIFIERS));

// ── Perspective modifiers appended after tone ─────────────────────────
const PERSPECTIVE_MODIFIERS: Record<string, string> = {
  first_person: `

=== PERSPECTIVE: FIRST PERSON ===
Write entirely in first person (I, me, my, we, our). The narrator is directly involved — sharing their own experience, analysis, or observations. Use phrases like "I found that...", "In my view...", "What I noticed was...". The text should feel personal and direct.`,

  third_person: `

=== PERSPECTIVE: THIRD PERSON ===
Write entirely in third person. Never use "I", "me", "my", "we", or "our" (unless quoting). Refer to people, organizations, or concepts by name or with "they", "it", "one". Use constructions like "It was found that...", "The researchers noted...", "One might argue...". The text should feel objective and detached.`,
};

const VALID_PERSPECTIVES = new Set(Object.keys(PERSPECTIVE_MODIFIERS));

// ── Post-processing pipeline ──────────────────────────────────────────
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
  "synergy": "benefit", "ecosystem": "system", "empower": "help",
  "innovative": "new", "transformative": "big", "harness": "use",
  "underpin": "support", "avenue": "way", "facet": "part",
  "beacon": "example", "testament": "proof", "groundbreaking": "new",
};

const BANNED_REGEXES = Object.keys(BANNED_WORD_MAP).map(
  (w) => ({ pattern: new RegExp(`\\b${w}\\b`, "gi"), replacement: BANNED_WORD_MAP[w] })
);

const CONTRACTION_PAIRS: [string, string][] = [
  ["do not", "don't"], ["does not", "doesn't"], ["did not", "didn't"],
  ["cannot", "can't"], ["can not", "can't"], ["will not", "won't"],
  ["would not", "wouldn't"], ["should not", "shouldn't"], ["could not", "couldn't"],
  ["is not", "isn't"], ["are not", "aren't"], ["was not", "wasn't"],
  ["were not", "weren't"], ["has not", "hasn't"], ["have not", "haven't"],
  ["had not", "hadn't"], ["it is", "it's"], ["that is", "that's"],
  ["there is", "there's"], ["here is", "here's"], ["what is", "what's"],
  ["I am", "I'm"], ["I have", "I've"], ["I will", "I'll"], ["I would", "I'd"],
  ["they are", "they're"], ["they have", "they've"], ["they would", "they'd"],
  ["we are", "we're"], ["we have", "we've"], ["we would", "we'd"],
  ["you are", "you're"], ["you have", "you've"], ["you would", "you'd"],
];

function enforceContractions(text: string): string {
  let out = text;
  for (const [full, contracted] of CONTRACTION_PAIRS) {
    const re = new RegExp(`\\b${full}\\b`, "gi");
    out = out.replace(re, (match) => {
      if (match[0] >= "A" && match[0] <= "Z") {
        return contracted.charAt(0).toUpperCase() + contracted.slice(1);
      }
      return contracted;
    });
  }
  return out;
}

function postProcess(text: string): string {
  let out = text;

  // Kill em dashes, en dashes, double hyphens
  out = out.replace(/\s*[—–]\s*/g, ", ");
  out = out.replace(/ --/g, ", ").replace(/--/g, ", ");

  // Replace banned words
  for (const { pattern, replacement } of BANNED_REGEXES) {
    out = out.replace(pattern, replacement);
  }

  // Force contractions
  out = enforceContractions(out);

  // Strip AI opener patterns
  out = out.replace(/^In today'?s \w+ \w*,?\s*/i, "");
  out = out.replace(/^In the realm of \w+,?\s*/i, "");

  // Strip AI filler phrases
  out = out.replace(/It is (essential|important) (that |to )/gi, "");
  out = out.replace(/In conclusion,?\s*/gi, "");
  out = out.replace(/It'?s (important|worth) to note (that )?/gi, "");
  out = out.replace(/It'?s worth (noting|mentioning) (that )?/gi, "");
  out = out.replace(/\bIn order to\b/gi, "To");
  out = out.replace(/\bDue to the fact that\b/gi, "Since");
  out = out.replace(/\bAt the end of the day,?\s*/gi, "");
  out = out.replace(/\bIt goes without saying (that )?/gi, "");
  out = out.replace(/\bplays a (crucial|vital|important|key) role/gi, "matters");
  out = out.replace(/\ba myriad of\b/gi, "many");
  out = out.replace(/\bshed light on\b/gi, "explain");
  out = out.replace(/\bIn the realm of\b/gi, "In");

  // Clean double spaces and trim
  out = out.replace(/ {2,}/g, " ").trim();

  return out;
}

// ── API helpers (3 providers) ─────────────────────────────────────────

// Generic chat completion request/response shape
interface ChatMessage {
  role: string;
  content: string;
}

interface ChatCompletionResult {
  content?: string;
  tool_call_args?: string;
}

// ── Grok Non-Reasoning / x.ai (Monkey) ────────────────────────────────
async function callGrokNonReasoning(
  messages: ChatMessage[],
  options: { temperature?: number; tools?: unknown; tool_choice?: unknown; top_p?: number }
): Promise<ChatCompletionResult> {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) throw new Error("Grok API key not configured");

  const body: Record<string, unknown> = {
    model: "grok-4-1-fast-non-reasoning",
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: options.temperature ?? 0.7,
    top_p: options.top_p ?? 0.95,
  };

  if (options.tools) {
    body.tools = options.tools;
    body.tool_choice = options.tool_choice;
  }

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429) throw new Error("MODEL_BUSY");
  if (!response.ok) {
    const errBody = await response.text();
    console.error("Grok non-reasoning error:", response.status, errBody);
    throw new Error("MODEL_ERROR");
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall) {
    return { tool_call_args: toolCall.function.arguments };
  }
  return { content: data.choices?.[0]?.message?.content };
}

// ── Grok Reasoning / x.ai (Monk) ─────────────────────────────────────
async function callGrokReasoning(
  messages: ChatMessage[],
  options: { temperature?: number; tools?: unknown; tool_choice?: unknown; top_p?: number }
): Promise<ChatCompletionResult> {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) throw new Error("Grok API key not configured");

  const body: Record<string, unknown> = {
    model: "grok-4-1-fast-reasoning",
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: options.temperature ?? 0.7,
    top_p: options.top_p ?? 0.95,
  };

  if (options.tools) {
    body.tools = options.tools;
    body.tool_choice = options.tool_choice;
  }

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429) throw new Error("MODEL_BUSY");
  if (!response.ok) {
    const errBody = await response.text();
    console.error("Grok reasoning error:", response.status, errBody);
    throw new Error("MODEL_ERROR");
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall) {
    return { tool_call_args: toolCall.function.arguments };
  }
  return { content: data.choices?.[0]?.message?.content };
}

// ── Kimi K2.5 / Moonshot (Hypermonk) ─────────────────────────────────
async function callKimi(
  messages: ChatMessage[],
  options: { temperature?: number; tools?: unknown; tool_choice?: unknown; frequency_penalty?: number; presence_penalty?: number }
): Promise<ChatCompletionResult> {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error("Kimi API key not configured");

  // K2.5 constraints: thinking enabled → temperature must be 1;
  // thinking disabled (required for tool_choice) → temperature must be 0.6.
  // frequency_penalty, presence_penalty, top_p are NOT supported.
  const useTools = !!options.tools;
  const body: Record<string, unknown> = {
    model: "kimi-k2.5",
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: useTools ? 0.6 : 1,
  };

  if (useTools) {
    body.tools = options.tools;
    body.tool_choice = options.tool_choice;
    body.thinking = { type: "disabled" };
  }

  const response = await fetch("https://api.moonshot.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429) throw new Error("MODEL_BUSY");
  if (!response.ok) {
    const errBody = await response.text();
    console.error("Kimi error:", response.status, errBody);
    throw new Error("MODEL_ERROR");
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall) {
    return { tool_call_args: toolCall.function.arguments };
  }
  return { content: data.choices?.[0]?.message?.content };
}

// Provider caller type
type ProviderCaller = (
  messages: ChatMessage[],
  options: Record<string, unknown>
) => Promise<ChatCompletionResult>;

// ── Step 1: Extract key points using tool/function calling ────────────
interface ExtractedContent {
  subject: string;
  key_points: string[];
  original_tone: string;
  word_count: number;
  has_citations: boolean;
}

async function extractContent(
  text: string,
  caller: ProviderCaller
): Promise<ExtractedContent> {
  const result = await caller(
    [
      {
        role: "system",
        content: "You are a content analyst. Use the extract_content tool to break down the given text into its core ideas and information. Capture EVERY point — don't miss details.",
      },
      {
        role: "user",
        content: text,
      },
    ],
    {
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "function", function: { name: "extract_content" } },
      temperature: 0.3,
    }
  );

  if (!result.tool_call_args) throw new Error("MODEL_ERROR");
  return JSON.parse(result.tool_call_args) as ExtractedContent;
}

// ── Step 2: Generate humanized text from key points ───────────────────
async function generateFromPoints(
  extracted: ExtractedContent,
  tone: string,
  perspective: string,
  caller: ProviderCaller
): Promise<string> {
  const toneModifier = TONE_MODIFIERS[tone] || TONE_MODIFIERS.casual;
  const perspectiveModifier = PERSPECTIVE_MODIFIERS[perspective] || PERSPECTIVE_MODIFIERS.first_person;

  const pointsList = extracted.key_points
    .map((p, i) => `${i + 1}. ${p}`)
    .join("\n");

  const citationNote = extracted.has_citations
    ? "\nThe original text contained citations/references. Apply Rule 9 (vary citation styles) when including them."
    : "";

  const result = await caller(
    [
      {
        role: "system",
        content: HUMANIZER_SYSTEM + toneModifier + perspectiveModifier,
      },
      {
        role: "user",
        content: `Write about the following topic: "${extracted.subject}"

Cover ALL of these points in flowing prose (no bullet points, no numbered lists). Aim for roughly ${Math.min(extracted.word_count, 500)} words.${citationNote}

Key points to cover:
${pointsList}`,
      },
    ],
    {
      temperature: 0.9,
      top_p: 0.95,
      frequency_penalty: 0.4,
      presence_penalty: 0.4,
    }
  );

  if (!result.content) throw new Error("MODEL_ERROR");
  return result.content;
}

// ── Full pipeline: extract → generate → post-process ──────────────────
async function humanizePipeline(
  text: string,
  tone: string,
  perspective: string,
  caller: ProviderCaller
): Promise<string> {
  // Step 1: Extract key points via tool calling
  const extracted = await extractContent(text, caller);

  // Step 2: Generate from points (model never sees original text)
  const generated = await generateFromPoints(extracted, tone, perspective, caller);

  // Step 3: Post-process
  return postProcess(generated);
}

// ── Main action ───────────────────────────────────────────────────────
export const humanize = action({
  args: {
    text: v.string(),
    tone: v.string(),
    perspective: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const { text, tone, perspective = "first_person", model } = args;
    const inputWordCount = text.trim().split(/\s+/).filter(Boolean).length;

    if (!text.trim()) {
      throw new Error("Text is required");
    }

    if (inputWordCount > MAX_INPUT_WORDS) {
      throw new Error(`Text must be ${MAX_INPUT_WORDS} words or fewer`);
    }

    if (!VALID_TONES.has(tone)) {
      throw new Error("Valid tone is required (casual, academic, professional, creative)");
    }

    if (!VALID_PERSPECTIVES.has(perspective)) {
      throw new Error("Valid perspective is required (first_person, third_person)");
    }

    try {
      if (model === "monk") {
        // Justin Monk → Grok Reasoning (x.ai)
        return await humanizePipeline(text, tone, perspective, callGrokReasoning);
      }
      if (model === "hypermonk") {
        // Arromal-hypermonk → Kimi K2.5 (Moonshot)
        return await humanizePipeline(text, tone, perspective, callKimi);
      }
      // Monkey → Grok Non-Reasoning (x.ai)
      return await humanizePipeline(text, tone, perspective, callGrokNonReasoning);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Humanize error:", msg);
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
