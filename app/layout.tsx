import type {Metadata} from "next";
import Link from "next/link";
import {Nav} from "../components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Halo",
  description: "Autonomous programmable mutual aid fund.",
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="topbar" aria-label="Primary navigation">
            <Link href="/" className="brand" aria-label="Halo overview">
              <span className="brand-mark">H</span>
              <span>Halo</span>
            </Link>
            <Nav />
          </header>
          {children}
          <footer className="site-boundary" aria-label="Demo boundary">
            <span>Halo</span>
            <span>HackQuest demo</span>
            <span>Base Sepolia execution proof</span>
            <span>Mainnet paid claim gated</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
