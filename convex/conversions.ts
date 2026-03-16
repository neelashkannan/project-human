import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const save = mutation({
  args: {
    originalText: v.string(),
    humanizedText: v.string(),
    tone: v.string(),
    model: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("conversions", {
      originalText: args.originalText,
      humanizedText: args.humanizedText,
      tone: args.tone,
      model: args.model,
      createdAt: Date.now(),
      userId: args.userId,
    });
    return id;
  },
});

export const getRecent = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("conversions")
      .withIndex("by_creation")
      .order("desc")
      .take(50);
    if (args.userId) {
      return all.filter((c) => c.userId === args.userId).slice(0, 20);
    }
    return all.filter((c) => !c.userId).slice(0, 20);
  },
});

export const getById = query({
  args: { id: v.id("conversions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const remove = mutation({
  args: { id: v.id("conversions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
