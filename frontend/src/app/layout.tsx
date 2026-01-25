import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/contexts/LanguageContext";

export const metadata: Metadata = {
  title: "AI Workshop Playground",
  description: "Generate and preview HTML/CSS/JS code using AI. Create interactive web experiences powered by AI in real-time.",
  keywords: ["AI", "code generator", "HTML", "CSS", "JavaScript", "playground", "web development", "workshop"],
  authors: [{ name: "AI Workshop" }],
  creator: "AI Workshop",
  publisher: "AI Workshop",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["fi_FI"],
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://playground.koodattu.dev",
    title: "AI Workshop Playground",
    description: "Generate and preview HTML/CSS/JS code using AI. Create interactive web experiences powered by AI in real-time.",
    siteName: "AI Workshop Playground",
    images: [
      {
        url: "/web-app-manifest-512x512.png",
        width: 512,
        height: 512,
        alt: "AI Workshop Playground",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Workshop Playground",
    description: "Generate and preview HTML/CSS/JS code using AI. Create interactive web experiences powered by AI in real-time.",
    images: ["/web-app-manifest-512x512.png"],
    creator: "@aiworkshop",
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://playground.koodattu.dev"),
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
