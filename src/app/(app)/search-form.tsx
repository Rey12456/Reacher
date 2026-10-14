"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchForm() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [ask, setAsk] = useState("chat");

  return (
    <form
      className="panel grid sm:grid-cols-[1fr_1fr_auto_auto] [&>*]:border-stone-200 sm:[&>*:not(:last-child)]:border-r [&>*:not(:last-child)]:border-b sm:[&>*]:border-b-0"
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams({ company: company.trim(), role: role.trim(), ask });
        router.push(`/search/new?${params}`);
      }}
    >
      <label className="block px-5 py-4">
        <span className="lbl">Company</span>
        <input className="mt-0.5 block w-full bg-transparent text-base font-medium outline-none placeholder:font-normal placeholder:text-stone-500" required value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Stripe" />
      </label>
      <label className="block px-5 py-4">
        <span className="lbl">Role you&apos;re targeting</span>
        <input className="mt-0.5 block w-full bg-transparent text-base font-medium outline-none placeholder:font-normal placeholder:text-stone-500" required value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Software Engineer" />
      </label>
      <label className="block px-5 py-4">
        <span className="lbl">Ask for</span>
        <select className="mt-0.5 block bg-transparent text-base font-medium outline-none" value={ask} onChange={(e) => setAsk(e.target.value)}>
          <option value="chat">A 30-min chat</option>
          <option value="advice">Advice</option>
          <option value="referral">A referral</option>
        </select>
      </label>
      <button className="m-2 inline-flex min-h-12 items-center justify-center rounded-md bg-stone-900 px-7 text-sm font-semibold text-stone-50 hover:bg-stone-700 sm:!border-r-0">
        Find people
      </button>
    </form>
  );
}
