import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  conversions: defineTable({
    originalText: v.string(),
    humanizedText: v.string(),
    tone: v.string(),
    model: v.optional(v.string()),
    createdAt: v.number(),
    userId: v.optional(v.string()),
  })
    .index("by_creation", ["createdAt"])
    .index("by_user", ["userId", "createdAt"]),

  usage: defineTable({
    date: v.string(),
    count: v.number(),
  }).index("by_date", ["date"]),
});
