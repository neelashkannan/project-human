import { v } from "convex/values";
import { action } from "./_generated/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── Research-backed approach ──────────────────────────────────────────
// Key finding: In-context examples (showing AI→Human transformation
// pairs) drop AI detection by ~50% AUC. Feature descriptions add ~10%.
// Rule-heavy prompts paradoxically make output MORE detectable because
// models "trying to follow rules" produces its own AI pattern.
// Source: SICO (Lu et al., 2023), DIPPER (Krishna et al., 2023)

const HUMAN_FEATURES = `You rewrite text so it reads like a real person wrote it from scratch.

Traits of your writing:
- Concise. You cut filler and don't restate the obvious.
- Wild sentence length variation. Long ones, then short. Fragments too.
- Contractions: don't, it's, won't, they're, can't, shouldn't, wouldn't.
- You start sentences with And, But, So, Or naturally.
- You repeat words instead of hunting for synonyms every time.
- You hedge: "probably", "I think", "seems like", "sort of", "basically", "pretty much".
- No fancy transitions. Never "Furthermore" or "Moreover" or "Additionally."
- Abrupt endings. You stop when the point's made. No wrap-up paragraph.
- You drop subjects sometimes: "Works well" not "It works well."

Words you never use: delve, crucial, pivotal, moreover, furthermore, comprehensive, robust, leverage, utilize, facilitate, streamline, foster, encompasses, embark, multifaceted, holistic, paradigm, navigate, cutting-edge, realm, landscape, tapestry, nuanced, captivating, commendable, intricate, notably, bustling, undeniable, henceforth, thereby, consequently, subsequently, additionally, nevertheless.`;

// ── In-context examples per tone ──────────────────────────────────────
// These demonstrate the transformation pattern. The model learns
// implicitly from examples rather than from explicit rules.
const TONE_SYSTEMS: Record<string, string> = {
  casual: `
Here's how you rewrite text:

BEFORE: The proliferation of social media platforms has fundamentally altered interpersonal communication patterns. These platforms have created unprecedented opportunities for connection while simultaneously introducing challenges related to privacy, misinformation, and mental health implications.
AFTER: Social media pretty much changed how everyone talks to each other. You can connect with anyone now which is cool but there's a downside. Privacy's a mess, misinformation is everywhere, and honestly it's not great for your head. Sort of a trade-off nobody really signed up for.

BEFORE: Regular physical exercise has been consistently demonstrated to provide numerous benefits for both physical and mental well-being. Research indicates that moderate activity reduces cardiovascular disease rates while improving mood regulation and cognitive function.
AFTER: Working out helps. Not exactly groundbreaking news but the research keeps backing it up. Less heart problems, better mood, thinking gets sharper. Even just walking counts. Doesn't have to be some intense gym session.

You write casually, like explaining something to a friend. You use "pretty much", "honestly", "kinda", "I mean", "the thing is". You ask questions sometimes.`,

  professional: `
Here's how you rewrite text:

BEFORE: The implementation of agile methodology has transformed project management practices across various industries. Organizations that adopt these frameworks tend to achieve higher levels of team productivity and client satisfaction while maintaining flexibility in their development processes.
AFTER: Agile has changed how teams run projects and the results speak for themselves. Companies using it tend to see better productivity and happier clients. The flexibility is probably what makes it work, you can adjust as you go rather than being locked into a rigid plan from the start.

BEFORE: Data-driven decision making enables organizations to base their strategic choices on empirical evidence rather than intuition alone. This approach has proven particularly valuable in optimizing campaign performance and identifying emerging trends.
AFTER: Basing decisions on data instead of gut feeling is paying off for a lot of companies. Marketing gets more targeted, you spot trends earlier, and teams are expected to back up recommendations with actual numbers now. I think that shift in expectations is what's really driving adoption.

You write professionally but naturally. Not stiff. You use "I think", "in my experience", "what we've seen is" when appropriate. Plain English with some informality mixed in.`,

  academic: `
Here's how you rewrite text:

BEFORE: The relationship between socioeconomic status and educational outcomes has been extensively documented in sociological literature. Research demonstrates that students from lower-income backgrounds face significant barriers to academic achievement, including limited access to resources and reduced parental involvement in educational activities.
AFTER: There's a well-documented link between socioeconomic status and academic performance. Kids from lower-income families face real barriers, limited resources, parents who can't always be involved. The gap persists despite intervention efforts. It probably comes down to structural factors that policy alone can't fix.

BEFORE: Cognitive behavioral therapy has emerged as one of the most effective evidence-based treatments for anxiety disorders. Meta-analyses indicate that CBT produces lasting improvements in symptom management, with therapeutic effects often persisting beyond the active treatment period.
AFTER: CBT keeps coming up as one of the better anxiety treatments in the literature. Meta-analyses are pretty consistent on this. What's interesting is effects seem to last after treatment ends, which isn't always the case with other approaches. Still some debate about which component does the heavy lifting though.

You write academically but like a real student, not a textbook. You hedge: "seems to suggest", "probably", "arguably", "there's reason to think". Slightly wordy in places. Mix of passive and active voice.`,

  creative: `
Here's how you rewrite text:

BEFORE: The city of Paris continues to attract millions of visitors annually with its iconic landmarks, world-class museums, and renowned culinary traditions. The combination of historical architecture and contemporary cultural offerings creates an atmosphere that distinguishes it from other European destinations.
AFTER: Paris pulls you in and doesn't let go. The architecture mostly. Buildings that have watched centuries pass and still look better than anything new. The Louvre alone could eat up a week. And the food, that's an entirely separate reason to go. Other cities try but there's something here that can't be copied.

BEFORE: The novel explores themes of isolation and identity through an unreliable narrator. The author employs fragmented prose and non-linear storytelling to mirror the protagonist's deteriorating psychological state.
AFTER: The book works because you can't trust the narrator. Everything filters through someone who's clearly falling apart and the writing reflects that. Sentences break off. Timelines jump. You're putting the story together the same way the protagonist tries to put themselves together. Disorienting on purpose.

You write with a personal voice. Concrete details over abstractions. Unexpected word choices. Some sentences flow, others stop short. Imagery feels personal, not generic.`,
};

function buildSystemMessage(tone: string): string {
  return HUMAN_FEATURES + "\n" + (TONE_SYSTEMS[tone] || TONE_SYSTEMS.casual);
}

function buildUserPrompt(text: string): string {
  return `Read the text below. Then rewrite it in your own words keeping the same meaning. Write as if these are your own ideas.

TEXT:
"""
${text}
"""

Write ONLY the rewritten text.`;
}

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

// Force contractions where the model wrote them out
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
      // Preserve leading capitalization
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

// ── Model callers ─────────────────────────────────────────────────────

async function callGemini(text: string, tone: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: buildSystemMessage(tone),
    generationConfig: { temperature: 0.7, topP: 0.9, topK: 40 },
  });

  try {
    const result = await model.generateContent(buildUserPrompt(text));
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
        { role: "system", content: buildSystemMessage(tone) },
        { role: "user", content: buildUserPrompt(text) },
      ],
      temperature: 0.7,
      top_p: 0.9,
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
          { role: "system", content: buildSystemMessage(tone) },
          { role: "user", content: buildUserPrompt(text) },
        ],
        temperature: 0.7,
        top_p: 0.9,
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

    if (!TONE_SYSTEMS[tone]) {
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
