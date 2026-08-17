import type { Metadata } from "next";
import { Teko, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Ticker from "./Ticker";
import HeaderIcon from "./HeaderIcon";

const teko = Teko({
  variable: "--font-teko",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Last Man Above A Sunbed Shop",
  description: "Last Man Standing + Score Predictor",
};

// The header/ticker query the DB on every request.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${teko.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <header className="site-header">
          <p className="eyebrow">Last Man Standing · Score Predictor</p>
          <div className="site-title-row">
            <HeaderIcon />
            <h1 className="site-title">Last Man Above A Sunbed Shop</h1>
            <HeaderIcon mirror />
          </div>
        </header>
        <Ticker />
        <div className="site-content">{children}</div>
      </body>
    </html>
  );
}
