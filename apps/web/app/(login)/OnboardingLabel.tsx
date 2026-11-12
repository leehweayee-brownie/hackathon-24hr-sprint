'use client';

import { useUiStore } from '@/store/ui';

const COPY = {
  vendor: {
    label: 'Vendor onboarding',
    description:
      'Drop a vendor’s documents once. Every certificate is sorted, read and cross-checked against the others, so buyers get a trust score with reasons and suppliers get a passport they can share by link.',
  },
  buyer: {
    label: 'Buyer onboarding',
    description:
      'Paste a tender brief and get a ranked shortlist of verified vendors, with the reason for every fit and gap. Check each trust score, approve with a full audit trail, and rate the job when it’s done.',
  },
} as const;

/** The onboarding message beside the login and sign-up forms, following the role picked on the form. */
export function OnboardingLabel() {
  const copy = COPY[useUiStore((s) => s.authRole)];
  return (
    <>
      <p className="text-[12px] font-medium uppercase leading-[18px] tracking-[0.4px] text-brand">{copy.label}</p>
      <h2 className="text-[32px] font-semibold leading-10 text-black">Upload once, reuse everywhere.</h2>
      <p className="w-[440px] text-base leading-6 text-black">{copy.description}</p>
    </>
  );
}
