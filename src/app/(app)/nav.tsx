"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Search" },
  { href: "/outreach", label: "Outreach" },
  { href: "/profile", label: "Profile" },
];

export function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/search") : path.startsWith(href));
  return (
    <header className="border-b border-stone-200 bg-white">
      <nav className="mx-auto flex max-w-[1480px] items-center gap-7 px-6 py-4 lg:px-12 text-[15px]">
        <Link href="/" className="mr-auto flex items-center gap-2 font-bold">
          <span className="size-2.5 bg-signal" aria-hidden />
          Reacher
        </Link>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active(l.href) ? "page" : undefined}
            className={active(l.href) ? "font-semibold text-stone-900 underline decoration-signal decoration-2 underline-offset-[10px]" : "text-stone-500 hover:text-stone-900"}
          >
            {l.label}
          </Link>
        ))}
        <form action="/auth/signout" method="post">
          <button className="text-stone-500 hover:text-stone-900">Sign out</button>
        </form>
      </nav>
    </header>
  );
}
