# justin.human

> Transform AI-generated text into natural, authentic human writing.

A full-stack web app powered by **Next.js**, **Convex**, and **Google Gemini 2.0 Flash**.

---

## Features

- **AI-to-Human Text Conversion** — Paste AI text, get human-sounding output
- **4 Tone Options** — Casual, Professional, Academic, Creative
- **Real-Time History** — All conversions saved & synced via Convex
- **Beautiful Dark UI** — Custom-designed with Tailwind CSS
- **Custom Logo** — SVG logo with human + tech hybrid motif

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Backend | Convex.dev (real-time database + functions) |
| AI | Google Gemini 2.0 Flash via `@google/generative-ai` |

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Convex

```bash
npx convex dev
```

This will prompt you to create a Convex project (free tier). It will automatically set `NEXT_PUBLIC_CONVEX_URL` in your `.env.local`.

### 3. Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create a free API key
3. Add it to `.env.local`:

```
GEMINI_API_KEY=your_key_here
```

### 4. Run the Dev Server

```bash
npm run dev
```

This starts both Next.js and Convex dev servers. Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
├── convex/                        # Convex backend
│   ├── schema.ts                  # Database schema
│   └── conversions.ts             # Mutations & queries  
├── src/
│   ├── app/
│   │   ├── api/humanize/route.ts  # Gemini API endpoint
│   │   ├── humanize/page.tsx      # Text humanizer page
│   │   ├── history/page.tsx       # Conversion history
│   │   ├── layout.tsx             # Root layout
│   │   └── page.tsx               # Landing page
│   └── components/
│       ├── ConvexClientProvider.tsx
│       ├── HumanizeForm.tsx
│       ├── HistoryList.tsx
│       ├── Logo.tsx
│       ├── Navbar.tsx
│       └── Footer.tsx
```

## License

MIT

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
