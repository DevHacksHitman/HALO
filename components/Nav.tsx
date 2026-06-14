"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {href: "/", label: "Overview"},
  {href: "/donor", label: "Donor"},
  {href: "/request", label: "Requester"},
  {href: "/status", label: "Status"},
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav-links">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link key={item.href} href={item.href} className={isActive ? "active" : ""}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
