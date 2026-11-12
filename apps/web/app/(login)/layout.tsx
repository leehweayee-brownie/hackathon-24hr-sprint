/* eslint-disable @next/next/no-img-element -- static Figma assets at fixed design sizes */
import type { ReactNode } from 'react';

/**
 * Figma "Login" frame (13:1525), 1440 × 1024: the login card on a white left half,
 * and a brand-tinted right half with the onboarding message and red triangle artwork.
 * Positions on the right are the frame's, measured from the right half's left edge (x = 720).
 */
export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    // Exactly one screen high: the page itself never scrolls. On very short screens only the form panel scrolls.
    <main className="flex h-dvh overflow-hidden bg-brand-tint">
      <div className="flex h-full w-full overflow-y-auto bg-white px-4 py-10 lg:w-1/2 lg:shrink-0 [@media(min-height:701px)_and_(max-height:899px)]:py-2 [@media(max-height:700px)]:py-2">
        {/* m-auto centres the card and still lets it scroll from the top when it is taller than the panel */}
        <div className="m-auto flex w-full justify-center">{children}</div>
      </div>

      <aside className="relative hidden h-full flex-1 overflow-hidden lg:block" aria-label="About Vendor Passport">
        <img
          src="/figma/login/gradient-triangles.gif"
          alt=""
          width={1038}
          height={1038}
          className="pointer-events-none absolute left-[17px] top-[220px] size-[1038px] max-w-none object-cover opacity-50"
        />
        <img src="/figma/login/corner-triangles.svg" alt="" width={258} height={258} className="absolute right-0 top-0" />
        {/* Hidden on short screens, where it would run into the paragraph above it. */}
        <img src="/figma/login/bottom-triangles.svg" alt="" width={200} height={200} className="absolute -bottom-[3px] left-0 [@media(max-height:700px)]:hidden" />

        <div className="absolute left-[91px] top-[157px] flex w-[306px] flex-col items-start gap-[14px]">
          <p className="text-[12px] font-medium uppercase leading-[18px] tracking-[0.4px] text-brand">Supplier onboarding</p>
          <h2 className="text-[32px] font-semibold leading-10 text-black">Upload once, reuse everywhere.</h2>
          <div className="text-base leading-6 text-black">
            <p>Drop a supplier&apos;s documents once. Every certificate is sorted,</p>
            <p>read and cross-checked against the others, so buyers get a</p>
            <p>trust score with reasons and suppliers get a passport they can</p>
            <p>share by link.</p>
          </div>
        </div>
      </aside>
    </main>
  );
}
