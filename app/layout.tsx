import type {Metadata} from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Halo",
  description: "Autonomous programmable mutual aid fund.",
};

const navItems = [
  {href: "/", label: "Overview"},
  {href: "/donor", label: "Donor"},
  {href: "/request", label: "Requester"},
  {href: "/status", label: "Status"},
];

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
            <nav className="nav-links">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="status-pill" aria-label="Current build status">
              Step 8 Status
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
