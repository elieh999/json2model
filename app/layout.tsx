import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);
  const description =
    "Convert JSON into Dart, TypeScript, and Python Pydantic models entirely in your browser.";

  return {
    title: "JSON2Model | Local JSON model generator",
    description,
    metadataBase: baseUrl,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    applicationName: "JSON2Model",
    keywords: ["JSON", "Dart", "TypeScript", "Pydantic", "code generation"],
    openGraph: {
      type: "website",
      title: "JSON2Model",
      description,
      url: baseUrl,
      images: [
        {
          url: new URL("/og.png", baseUrl),
          width: 1200,
          height: 630,
          alt: "JSON2Model converts local JSON into Dart, TypeScript, and Python models.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "JSON2Model",
      description,
      images: [new URL("/og.png", baseUrl)],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
