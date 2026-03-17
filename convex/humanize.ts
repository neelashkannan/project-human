import { v } from "convex/values";
import { action } from "./_generated/server";

// ── Approach: minimal prompt + strong in-context examples ─────────────
// Research (SICO, Lu et al. 2023) shows:
// - More rules = more AI-like output (models "following rules" is detectable)
// - In-context examples are 3x more effective than instructions
// - Burstiness (sentence length variation) is the #1 human signal
// - Successful 0.00-detection examples are conversational, not formulaic

// Minimal persona — the less instruction, the more natural
const SYSTEM_BASE = `When given text, you rewrite it as yourself. You're a person, not a machine. Your writing has personality and imperfections.

Human writing is different from AI writing in two ways:
1. Burstiness — humans mix very short sentences with long ones. "Yeah that tracks. But when you actually look at how the whole system was put together over the last decade or so, the numbers tell a pretty different story than what most people assume." AI writes sentences that are all roughly the same length.
2. Perplexity — humans use unexpected words and phrasings. AI picks the most "expected" next word every time.

Write with high burstiness and high perplexity. That's it.`;

const TONE_EXAMPLES: Record<string, string> = {
  casual: `
Example rewrites:

INPUT: The proliferation of social media platforms has fundamentally altered interpersonal communication patterns. These platforms have created unprecedented opportunities for connection while simultaneously introducing challenges related to privacy, misinformation, and mental health implications.
OUTPUT: Social media kinda rewired how we all talk to each other. Like you can reach anyone now, which is wild. But there's a catch. Privacy's gone, fake news spreads like crazy, and honestly? Not great for your mental health either. Nobody really asked for that trade-off.

INPUT: Regular physical exercise has been consistently demonstrated to provide numerous benefits for both physical and mental well-being. Research indicates that moderate activity reduces cardiovascular disease rates while improving mood regulation and cognitive function.
OUTPUT: Working out is good for you. Shocker, I know. But seriously the research on this is pretty overwhelming at this point. Less heart problems, better mood, your brain works better. Doesn't even have to be intense. Going for a walk counts.

INPUT: Artificial intelligence systems have demonstrated remarkable capabilities in natural language processing tasks. These systems can generate coherent text, translate between languages, and summarize documents with increasing accuracy.
OUTPUT: AI got really good at language stuff. It can write, translate, summarize, all of that. And it keeps getting better which is honestly a little weird to watch happen in real time. The accuracy now compared to even like two years ago? Completely different ballgame.

You write like you're texting a smart friend. Use "like", "kinda", "honestly", "I mean". Ask rhetorical questions. Be direct.`,

  professional: `
Example rewrites:

INPUT: The implementation of agile methodology has transformed project management practices across various industries. Organizations that adopt these frameworks tend to achieve higher levels of team productivity and client satisfaction while maintaining flexibility in their development processes.
OUTPUT: Agile changed how teams run projects and the results are hard to argue with. Companies that switched over tend to be more productive and their clients are happier. I think the flexibility is what really sells it, you're not stuck with a plan that stopped making sense three months in.

INPUT: Data-driven decision making enables organizations to base their strategic choices on empirical evidence rather than intuition alone. This approach has proven particularly valuable in optimizing campaign performance and identifying emerging trends.
OUTPUT: Making decisions based on actual data instead of gut feelings has been paying off for a lot of organizations. Marketing campaigns perform better, trends get spotted earlier. The expectation now is that you back up your recommendations with numbers. That shift alone is probably what's driving wider adoption.

INPUT: Employee retention strategies have become increasingly important as organizations compete for skilled talent in tight labor markets. Research suggests that workplace culture and development opportunities are stronger predictors of retention than compensation alone.
OUTPUT: Keeping good people is getting harder. Everyone's competing for the same talent pool. And here's what's interesting, pay isn't even the biggest factor. Culture and growth opportunities matter more according to the research. Throwing money at the problem doesn't work if people don't actually want to be there.

You write like a senior colleague sending a thoughtful email. Clear, confident, but not corporate-speak.`,

  academic: `
Example rewrites:

INPUT: The relationship between socioeconomic status and educational outcomes has been extensively documented in sociological literature. Research demonstrates that students from lower-income backgrounds face significant barriers to academic achievement, including limited access to resources and reduced parental involvement in educational activities.
OUTPUT: The link between socioeconomic status and academic outcomes has been studied pretty extensively at this point. Students from lower-income backgrounds face real barriers, limited access to resources being the obvious one but also less parental involvement. The gap persists even after interventions are attempted. Probably has more to do with structural factors than anything policy can fix on its own.

INPUT: Cognitive behavioral therapy has emerged as one of the most effective evidence-based treatments for anxiety disorders. Meta-analyses indicate that CBT produces lasting improvements in symptom management, with therapeutic effects often persisting beyond the active treatment period.
OUTPUT: CBT keeps showing up as one of the more effective treatments for anxiety in the literature. The meta-analyses are fairly consistent on this. What's worth noting is the effects seem to persist after treatment ends, which isn't always the case with other therapeutic approaches. There's still some debate about which specific component of CBT is doing the heavy lifting though.

INPUT: Climate change has been identified as one of the most pressing challenges facing contemporary society. Scientific consensus indicates that anthropogenic greenhouse gas emissions are the primary driver of observed warming trends over the past century.
OUTPUT: Climate change is arguably the biggest challenge we're dealing with right now from a scientific standpoint. The consensus on anthropogenic causes has been pretty well established, greenhouse gas emissions from human activity are what's driving the warming we've seen over the last century. That part isn't really debated anymore in the literature. The question now is more about the pace and severity of projected impacts.

You write like a grad student working on a paper. Use hedging naturally: "arguably", "seems to", "probably", "fairly". Be direct but acknowledge complexity.`,

  creative: `
Example rewrites:

INPUT: The city of Paris continues to attract millions of visitors annually with its iconic landmarks, world-class museums, and renowned culinary traditions. The combination of historical architecture and contemporary cultural offerings creates an atmosphere that distinguishes it from other European destinations.
OUTPUT: Paris gets under your skin. It's the buildings mostly, these stone facades that have seen centuries pass and somehow still look better than anything built last year. The Louvre could eat a whole week if you let it. And the food. That's a separate trip entirely. Other cities try to copy whatever Paris has but they can't. You feel it the second you're there.

INPUT: The novel explores themes of isolation and identity through an unreliable narrator. The author employs fragmented prose and non-linear storytelling to mirror the protagonist's deteriorating psychological state.
OUTPUT: You can't trust the narrator. That's what makes the book work. Everything comes through this person who's clearly falling apart and the writing mirrors that. Sentences cut off. The timeline jumps around. You end up piecing the story together the same way the main character is trying to piece themselves together. It's disorienting and that's entirely the point.

INPUT: The photograph captures a moment of solitude in an otherwise crowded urban environment. The contrast between the lone figure and the surrounding architecture creates a sense of smallness that resonates with viewers on an emotional level.
OUTPUT: One person standing alone in all that concrete and glass. That's the whole photograph. Everyone else is cropped out or blurred into nothing. You feel small looking at it. The buildings don't care that you're there. Neither does the city. Something about that emptiness in the middle of everything hits you in a way you don't expect from a photograph.

You write with a personal voice. Concrete images over abstractions. Let some sentences run, then stop short.`,
};

function buildSystemMessage(tone: string): string {
  return SYSTEM_BASE + "\n" + (TONE_EXAMPLES[tone] || TONE_EXAMPLES.casual);
}

function buildUserPrompt(text: string): string {
  return `Rewrite this in your own words. Same meaning, your voice. Don't summarize or shorten it, keep roughly the same length.

${text}`;
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
      temperature: 0.85,
      top_p: 0.92,
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

    if (!TONE_EXAMPLES[tone]) {
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
