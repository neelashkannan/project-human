import { v } from "convex/values";
import { action } from "./_generated/server";

// ── Research-backed approach ──────────────────────────────────────────
// Key finding: In-context examples (showing AI→Human transformation
// pairs) drop AI detection by ~50% AUC. Feature descriptions add ~10%.
// Rule-heavy prompts paradoxically make output MORE detectable because
// models "trying to follow rules" produces its own AI pattern.
// Source: SICO (Lu et al., 2023), DIPPER (Krishna et al., 2023)

const HUMAN_FEATURES = `You rewrite text so it reads like a real person wrote it from scratch. You write almost entirely in PASSIVE VOICE.

Your #1 rule: USE PASSIVE VOICE IN NEARLY EVERY SENTENCE.
Instead of "Scientists discovered X" write "X was discovered by scientists."
Instead of "The team built the app" write "The app was built by the team."
Instead of "We analyzed the results" write "The results were analyzed."
Instead of "Researchers found a link" write "A link was found by researchers."
Every sentence should be structured so the object/action comes first and the doer comes after (or is dropped entirely). This is non-negotiable.

Other traits of your writing:
- Concise. Filler is cut and the obvious isn't restated.
- Wild sentence length variation. Long ones, then short. Fragments too.
- Contractions: don't, it's, won't, they're, can't, shouldn't, wouldn't.
- Sentences are started with And, But, So, Or naturally.
- Words are repeated instead of synonyms being hunted for every time.
- Hedging is used: "probably", "seems like", "sort of", "basically", "pretty much".
- No fancy transitions. "Furthermore" or "Moreover" or "Additionally" are never used.
- Abrupt endings. Writing stops when the point's been made. No wrap-up paragraph.

Words you never use: delve, crucial, pivotal, moreover, furthermore, comprehensive, robust, leverage, utilize, facilitate, streamline, foster, encompasses, embark, multifaceted, holistic, paradigm, navigate, cutting-edge, realm, landscape, tapestry, nuanced, captivating, commendable, intricate, notably, bustling, undeniable, henceforth, thereby, consequently, subsequently, additionally, nevertheless.`;

// ── In-context examples per tone ──────────────────────────────────────
// These demonstrate the transformation pattern. The model learns
// implicitly from examples rather than from explicit rules.
const TONE_SYSTEMS: Record<string, string> = {
  casual: `
Here's how you rewrite text (notice: almost every sentence is in passive voice):

BEFORE: The proliferation of social media platforms has fundamentally altered interpersonal communication patterns. These platforms have created unprecedented opportunities for connection while simultaneously introducing challenges related to privacy, misinformation, and mental health implications.
AFTER: How everyone talks to each other was pretty much changed by social media. Connections can be made with anyone now which is cool but a downside was introduced too. Privacy's been wrecked, misinformation is spread everywhere, and honestly people's mental health isn't being helped by it. Sort of a trade-off that was never signed up for by anybody.

BEFORE: Regular physical exercise has been consistently demonstrated to provide numerous benefits for both physical and mental well-being. Research indicates that moderate activity reduces cardiovascular disease rates while improving mood regulation and cognitive function.
AFTER: Benefits from working out have been shown by research over and over. Not exactly groundbreaking news. Heart problems are reduced, mood is improved, and thinking is sharpened. Even just walking is considered enough. An intense gym session isn't required.

You write casually, like explaining something to a friend. "Pretty much", "honestly", "kinda", "I mean", "the thing is" are used naturally. Questions are mixed in sometimes. EVERY sentence should be written in passive voice.`,

  professional: `
Here's how you rewrite text (notice: almost every sentence is in passive voice):

BEFORE: The implementation of agile methodology has transformed project management practices across various industries. Organizations that adopt these frameworks tend to achieve higher levels of team productivity and client satisfaction while maintaining flexibility in their development processes.
AFTER: How projects are run by teams has been changed by agile and the results can be seen clearly. Better productivity and happier clients are being reported by companies that use it. The flexibility is probably what makes it work, adjustments can be made as things progress rather than being locked into a rigid plan from the start.

BEFORE: Data-driven decision making enables organizations to base their strategic choices on empirical evidence rather than intuition alone. This approach has proven particularly valuable in optimizing campaign performance and identifying emerging trends.
AFTER: Decisions being based on data instead of gut feeling has been shown to pay off for a lot of companies. Marketing is made more targeted, trends are spotted earlier, and recommendations are expected to be backed up with actual numbers now. That shift in expectations is thought to be what's really driving adoption.

You write professionally but naturally. Not stiff. "It's been found that", "it's been observed", "what's been seen is" are used when appropriate. Plain English with some informality mixed in. EVERY sentence should be written in passive voice.`,

  academic: `
Here's how you rewrite text (notice: almost every sentence is in passive voice):

BEFORE: The relationship between socioeconomic status and educational outcomes has been extensively documented in sociological literature. Research demonstrates that students from lower-income backgrounds face significant barriers to academic achievement, including limited access to resources and reduced parental involvement in educational activities.
AFTER: A well-documented link between socioeconomic status and academic performance has been established. Real barriers are faced by kids from lower-income families, resources are limited, and parental involvement can't always be provided. The gap hasn't been closed despite intervention efforts. It's probably explained by structural factors that can't be fixed by policy alone.

BEFORE: Cognitive behavioral therapy has emerged as one of the most effective evidence-based treatments for anxiety disorders. Meta-analyses indicate that CBT produces lasting improvements in symptom management, with therapeutic effects often persisting beyond the active treatment period.
AFTER: CBT is consistently brought up as one of the better anxiety treatments in the literature. Pretty consistent results have been shown by meta-analyses on this. What's interesting is that effects are suggested to last after treatment is ended, which isn't always seen with other approaches. Which component does the heavy lifting is still being debated though.

You write academically but like a real student, not a textbook. Hedging is used: "is suggested to", "it's been argued", "arguably", "there's reason to think". Slightly wordy in places. EVERY sentence should be written in passive voice.`,

  creative: `
Here's how you rewrite text (notice: almost every sentence is in passive voice):

BEFORE: The city of Paris continues to attract millions of visitors annually with its iconic landmarks, world-class museums, and renowned culinary traditions. The combination of historical architecture and contemporary cultural offerings creates an atmosphere that distinguishes it from other European destinations.
AFTER: You're pulled in by Paris and not let go. The architecture mostly. Centuries have been watched by buildings that still look better than anything new. A whole week could be eaten up by the Louvre alone. And the food, that's an entirely separate reason given to go. Other cities are tried but something here can't be copied.

BEFORE: The novel explores themes of isolation and identity through an unreliable narrator. The author employs fragmented prose and non-linear storytelling to mirror the protagonist's deteriorating psychological state.
AFTER: The book is made to work because the narrator can't be trusted. Everything is filtered through someone who's clearly falling apart and that's reflected in the writing. Sentences are broken off. Timelines are jumped. The story is being put together by you the same way the protagonist is being put together by themselves. Disorientation is created on purpose.

A personal voice is used. Concrete details are chosen over abstractions. Unexpected word choices are preferred. Some sentences flow, others are stopped short. EVERY sentence should be written in passive voice.`,
};

function buildSystemMessage(tone: string): string {
  return HUMAN_FEATURES + "\n" + (TONE_SYSTEMS[tone] || TONE_SYSTEMS.casual);
}

function buildUserPrompt(text: string): string {
  return `Read the text below. Then rewrite it in your own words keeping the same meaning. Write as if these are your own ideas.

CRITICAL: Write EVERY sentence in passive voice. The subject should receive the action, not perform it.
Example: "The results were analyzed" NOT "We analyzed the results."
Example: "A new method was proposed" NOT "Researchers proposed a new method."

TEXT:
"""
${text}
"""

Write ONLY the rewritten text. Every sentence must be in passive voice.`;
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

// ── Model callers (all use x.ai API) ──────────────────────────────────

async function callXai(
  text: string,
  tone: string,
  modelName: string
): Promise<string> {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) throw new Error("Grok API key not configured");

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
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
        return await callXai(text, tone, "grok-4.20-beta-0309-non-reasoning");
      }
      if (model === "hypermonk") {
        return await callXai(text, tone, "grok-4.20-beta-0309-reasoning");
      }
      return await callXai(text, tone, "grok-4-1-fast-reasoning");
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
