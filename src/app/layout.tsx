import type { Metadata } from "next";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
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
    <html lang="en">
      <body className="antialiased min-h-screen">
        <div className="bg-gradient" />
        <ConvexClientProvider>
          <main>{children}</main>
          <Footer />
          <Navbar />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
