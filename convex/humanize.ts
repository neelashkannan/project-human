import { v } from "convex/values";
import { action } from "./_generated/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const TONE_PROMPTS: Record<string, string> = {
  casual: `You are a text rewriter. Take the following AI-generated text and rewrite it to sound like a casual, everyday human wrote it. 
  - Use contractions (don't, it's, we're)
  - Add natural filler phrases occasionally
  - Vary sentence length. Mix short punchy sentences with longer ones
  - Avoid overly formal vocabulary
  - Make it feel like a friendly conversation
  - Keep the same meaning and key information
  - IMPORTANT: Do NOT use em dashes (--), double hyphens, or any dash-separated phrases. Use commas, periods, or semicolons instead.`,

  professional: `You are a text rewriter. Take the following AI-generated text and rewrite it to sound like a professional human wrote it.
  - Use clear, direct language
  - Maintain a confident but not robotic tone  
  - Vary sentence structure naturally
  - Avoid AI-typical phrases like "it's important to note", "in conclusion", "furthermore"
  - Sound like an experienced professional writing an email or report
  - Keep the same meaning and key information
  - IMPORTANT: Do NOT use em dashes (--), double hyphens, or any dash-separated phrases. Use commas, periods, or semicolons instead.`,

  academic: `You are a text rewriter. Take the following AI-generated text and rewrite it to sound like a real academic/student wrote it.
  - Use appropriate academic vocabulary without being pretentious
  - Include natural hedging language (suggests, appears to, arguably)
  - Vary paragraph and sentence complexity
  - Avoid the overly structured AI pattern of intro-body-conclusion in every paragraph
  - Make it feel like genuine scholarly writing
  - Keep the same meaning and key information
  - IMPORTANT: Do NOT use em dashes (--), double hyphens, or any dash-separated phrases. Use commas, periods, or semicolons instead.`,

  creative: `You are a text rewriter. Take the following AI-generated text and rewrite it to sound like a creative human writer.
  - Use vivid, expressive language
  - Include metaphors or analogies where natural
  - Play with rhythm and flow
  - Add personality and voice
  - Break conventional patterns occasionally
  - Keep the same meaning and key information
  - IMPORTANT: Do NOT use em dashes (--), double hyphens, or any dash-separated phrases. Use commas, periods, or semicolons instead.`,
};

function buildPrompt(tonePrompt: string, text: string): string {
  return `${tonePrompt}

Here is the text to rewrite:

"""
${text}
"""

Rewrite the above text. Only output the rewritten text, nothing else.`;
}

function cleanOutput(text: string): string {
  return text.replace(/ --/g, ",").replace(/--/g, ",");
}

async function callGemini(text: string, tonePrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
  const prompt = buildPrompt(tonePrompt, text);
  const result = await model.generateContent(prompt);
  return cleanOutput(result.response.text());
}

async function callGrok(text: string, tonePrompt: string): Promise<string> {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) throw new Error("Grok API key not configured");

  const prompt = buildPrompt(tonePrompt, text);

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4-1-fast-reasoning",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Grok API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response from Grok");
  return cleanOutput(content);
}

async function callKimi(text: string, tonePrompt: string): Promise<string> {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error("Kimi API key not configured");

  const prompt = buildPrompt(tonePrompt, text);

  const response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "kimi-k2.5",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Kimi API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No response from Kimi");
  return cleanOutput(content);
}

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

    const tonePrompt = TONE_PROMPTS[tone];
    if (!tonePrompt) {
      throw new Error("Valid tone is required (casual, professional, academic, creative)");
    }

    if (model === "monk") {
      return await callGemini(text, tonePrompt);
    }
    if (model === "hypermonk") {
      return await callKimi(text, tonePrompt);
    }
    // Default to Grok (monkey)
    return await callGrok(text, tonePrompt);
  },
});
