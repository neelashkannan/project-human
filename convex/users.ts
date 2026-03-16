import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const upsert = mutation({
  args: {
    firebaseUid: v.string(),
    name: v.string(),
    email: v.string(),
    photoURL: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        photoURL: args.photoURL,
        lastLogin: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      firebaseUid: args.firebaseUid,
      name: args.name,
      email: args.email,
      photoURL: args.photoURL,
      lastLogin: Date.now(),
      createdAt: Date.now(),
    });
  },
});

export const getByFirebaseUid = query({
  args: { firebaseUid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_firebase_uid", (q) => q.eq("firebaseUid", args.firebaseUid))
      .unique();
  },
});
