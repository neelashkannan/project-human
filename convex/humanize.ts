import { v } from "convex/values";
import { action } from "./_generated/server";

// ── 3-step pipeline using tool/function calling ───────────────────────
// Step 1: EXTRACT — model uses a tool to decompose text into key points,
//         tone observations, and subject. This forces structured thinking.
// Step 2: GENERATE — a SEPARATE call gets ONLY the key points (never sees
//         original AI text) and writes about them naturally in the target tone.
// Step 3: POST-PROCESS — banned words, contractions, AI phrase stripping.
//
// Why this works: the model in Step 2 is writing from scratch based on
// ideas, not "rewriting" AI text. It can't copy AI patterns it never saw.

// ── Step 1: Tool definition for extraction ────────────────────────────
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
      },
      required: ["subject", "key_points", "original_tone", "word_count"],
    },
  },
};

// ── Step 2: Generation prompts per tone ───────────────────────────────
const TONE_PERSONAS: Record<string, string> = {
  casual: `You're explaining something to a friend over coffee. You actually know this stuff and have opinions about it.

How you write:
- Mix sentence lengths wildly. "Yeah." then a long rambling thought. Then another short one.
- Use "like", "kinda", "honestly", "I mean", "the thing is", "sorta"
- Ask rhetorical questions sometimes
- You can start sentences with "And", "But", "So", "Or"
- Contractions always: don't, it's, won't, they're, can't
- Have a take. React to the information. "Which is wild." "Not great."
- Skip transitions. Just jump to the next thought.
- End abruptly when you've made your point

Example of your style:
"Social media kinda rewired how we all talk to each other. Like you can reach anyone now, which is wild. But there's a catch. Privacy's gone, fake news spreads like crazy, and honestly? Not great for your mental health either. Nobody really asked for that trade-off."`,

  professional: `You're a senior colleague writing a thoughtful email or briefing. Clear, confident, no corporate-speak.

How you write:
- Direct statements. No waffling.
- Vary sentence length but keep it readable
- Use "I think", "what's interesting", "the expectation now is"
- Contractions are fine: don't, it's, won't
- One idea per paragraph, short paragraphs
- Start some sentences with "And" or "But" naturally
- No "synergy", "leverage", "stakeholders", "actionable insights"
- End when the point's made. No summary paragraph.

Example of your style:
"Keeping good people is getting harder. Everyone's competing for the same talent pool. And here's what's interesting, pay isn't even the biggest factor. Culture and growth opportunities matter more according to the research. Throwing money at the problem doesn't work if people don't actually want to be there."`,

  academic: `You're a grad student who knows their field well. Smart but not pretentious. Writing for an informed audience.

How you write:
- Use natural hedging: "arguably", "seems to", "probably", "fairly", "there's reason to think"
- Some sentences are concise, others are longer analytical ones
- Acknowledge complexity and debate: "there's still some debate about", "that part isn't settled"
- Use field-appropriate terms but don't overdo jargon
- "The literature suggests", "what's worth noting", "the evidence points to"
- Contractions in moderation: it's, don't, doesn't
- You can be direct: "That part isn't really debated anymore."

Example of your style:
"CBT keeps showing up as one of the more effective treatments for anxiety in the literature. The meta-analyses are fairly consistent on this. What's worth noting is the effects seem to persist after treatment ends, which isn't always the case with other approaches. There's still some debate about which specific component is doing the heavy lifting though."`,

  creative: `You're a writer with a personal voice. You see things differently and choose your words carefully.

How you write:
- Concrete images over abstractions. Show, don't tell.
- Let some sentences run long, then stop short. "That's it."
- Unexpected phrasings and word choices
- Personal reactions: "You feel it." "Something about that hits different."
- Fragments are fine. Powerful even.
- Sensory details when relevant
- No clichés. Find a fresh way to say it.
- End with an image or a feeling, not a conclusion.

Example of your style:
"One person standing alone in all that concrete and glass. That's the whole photograph. Everyone else is cropped out or blurred into nothing. You feel small looking at it. The buildings don't care that you're there. Neither does the city. Something about that emptiness in the middle of everything hits you in a way you don't expect from a photograph."`,
};

// Valid tones for validation
const VALID_TONES = new Set(Object.keys(TONE_PERSONAS));

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

// ── API helper ────────────────────────────────────────────────────────
function getApiKey(): string {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) throw new Error("Grok API key not configured");
  return apiKey;
}

async function xaiRequest(
  apiKey: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429) throw new Error("MODEL_BUSY");
  if (!response.ok) throw new Error("MODEL_ERROR");
  return response.json() as Promise<Record<string, unknown>>;
}

// ── Step 1: Extract key points using tool/function calling ────────────
interface ExtractedContent {
  subject: string;
  key_points: string[];
  original_tone: string;
  word_count: number;
}

async function extractContent(
  text: string,
  modelName: string,
  apiKey: string
): Promise<ExtractedContent> {
  const data = await xaiRequest(apiKey, {
    model: modelName,
    messages: [
      {
        role: "system",
        content: "You are a content analyst. Use the extract_content tool to break down the given text into its core ideas and information. Capture EVERY point — don't miss details.",
      },
      {
        role: "user",
        content: text,
      },
    ],
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "function", function: { name: "extract_content" } },
    temperature: 0.3,
  });

  // Parse the tool call response
  const choices = data.choices as Array<{
    message: {
      tool_calls?: Array<{
        function: { arguments: string };
      }>;
    };
  }>;

  const toolCall = choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("MODEL_ERROR");

  const parsed = JSON.parse(toolCall.function.arguments) as ExtractedContent;
  return parsed;
}

// ── Step 2: Generate natural text from key points ─────────────────────
async function generateFromPoints(
  extracted: ExtractedContent,
  tone: string,
  modelName: string,
  apiKey: string
): Promise<string> {
  const persona = TONE_PERSONAS[tone] || TONE_PERSONAS.casual;

  // Build the key points as a simple list — this is ALL the model sees
  // It never sees the original AI-written text
  const pointsList = extracted.key_points
    .map((p, i) => `${i + 1}. ${p}`)
    .join("\n");

  const data = await xaiRequest(apiKey, {
    model: modelName,
    messages: [
      {
        role: "system",
        content: persona,
      },
      {
        role: "user",
        content: `Here are some facts and ideas about "${extracted.subject}". Write about them in your own words. Cover all the points. Aim for roughly ${extracted.word_count} words. Don't use bullet points or numbered lists — write in paragraphs.

${pointsList}`,
      },
    ],
    temperature: 0.9,
    top_p: 0.95,
    frequency_penalty: 0.3,
    presence_penalty: 0.3,
  });

  const choices = data.choices as Array<{
    message: { content?: string };
  }>;

  const content = choices?.[0]?.message?.content;
  if (!content) throw new Error("MODEL_ERROR");
  return content;
}

// ── Full pipeline: extract → generate → post-process ──────────────────
async function humanizePipeline(
  text: string,
  tone: string,
  modelName: string
): Promise<string> {
  const apiKey = getApiKey();

  // Step 1: Extract key points via tool calling
  const extracted = await extractContent(text, modelName, apiKey);

  // Step 2: Generate from points (model never sees original text)
  const generated = await generateFromPoints(extracted, tone, modelName, apiKey);

  // Step 3: Post-process
  return postProcess(generated);
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

    if (!VALID_TONES.has(tone)) {
      throw new Error("Valid tone is required (casual, professional, academic, creative)");
    }

    try {
      if (model === "monk") {
        return await humanizePipeline(text, tone, "grok-4.20-beta-0309-non-reasoning");
      }
      if (model === "hypermonk") {
        return await humanizePipeline(text, tone, "grok-4.20-beta-0309-reasoning");
      }
      return await humanizePipeline(text, tone, "grok-4-1-fast-reasoning");
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
