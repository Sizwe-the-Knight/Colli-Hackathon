import React from 'react';
import { Link } from 'wouter';

export function LegalFooter() {
  return <footer className="px-4 py-6 text-center text-xs text-[#4d6663]">
    <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-6 gap-y-3">
      <Link href="/privacy" className="rounded-sm underline underline-offset-4 hover:text-[#234e4c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#356e68]">Privacy Policy</Link>
      <Link href="/terms" className="rounded-sm underline underline-offset-4 hover:text-[#234e4c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#356e68]">Terms of Service</Link>
    </nav>
  </footer>;
}
