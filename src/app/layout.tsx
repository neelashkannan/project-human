import type { Metadata } from "next";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { HumanizeDockProvider } from "@/components/HumanizeDockContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "justin.human — Transform AI Text Into Human Writing",
  description:
    "Convert AI-generated text into natural, human-like writing. Powered by Gemini AI. Choose your tone: casual, professional, academic, or creative.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
              try {
                const storedTheme = window.localStorage.getItem("justin-human-theme");
                const resolvedTheme = storedTheme === "dark" || storedTheme === "light"
                  ? storedTheme
                  : window.matchMedia("(prefers-color-scheme: dark)").matches
                    ? "dark"
                    : "light";
                document.documentElement.dataset.theme = resolvedTheme;
                document.documentElement.style.colorScheme = resolvedTheme;
                document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
                document.documentElement.classList.toggle("light", resolvedTheme === "light");
              } catch {
                document.documentElement.dataset.theme = "light";
                document.documentElement.style.colorScheme = "light";
                document.documentElement.classList.remove("dark");
                document.documentElement.classList.add("light");
              }
            })();`,
          }}
        />
      </head>
      <body className="antialiased min-h-screen">
        <div className="bg-gradient" />
        <ConvexClientProvider>
          <ThemeProvider>
            <HumanizeDockProvider>
              <main>{children}</main>
              <Footer />
              <Navbar />
            </HumanizeDockProvider>
          </ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
