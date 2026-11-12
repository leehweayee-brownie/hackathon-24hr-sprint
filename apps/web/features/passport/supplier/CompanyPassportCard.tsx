import type { PassportView } from '@vp/shared';
import { PanelCard } from '@/components/ui/PanelCard';
import { SoftBadge } from '@/features/dashboard/SoftBadge';
import { cn } from '@/utils/cn';
import { formatDate, formatDateTime } from '@/utils/format';

const FIELDS: Array<[key: string, label: string, kind?: 'date']> = [
  ['companyName', 'Company name'],
  ['registrationNo', 'Registration no.'],
  ['incorporationDate', 'Incorporation date', 'date'],
  ['registeredAddress', 'Registered address'],
  ['cidbGrade', 'CIDB grade'],
  ['cidbCategories', 'CIDB categories'],
  ['cidbRegistrationNo', 'CIDB registration no.'],
];

/**
 * Figma "Card / Company passport": name with status badge, meta line, field grid.
 * `public` is the buyer's read-only view: gray "Draft" badge, no "not verified" note, three-column grid.
 */
export function CompanyPassportCard({ passport, variant = 'supplier' }: { passport: PassportView; variant?: 'supplier' | 'public' }) {
  const isPublic = variant === 'public';
  const details = passport.companyDetails ?? {};
  const verified = passport.status === 'VERIFIED';
  const meta = [
    passport.registrationNo ? `SSM ${passport.registrationNo}` : null,
    passport.verifiedAt ? `Verified ${formatDate(passport.verifiedAt)}` : isPublic ? null : 'Not verified yet',
    `Updated ${formatDateTime(passport.updatedAt)}`,
  ].filter(Boolean);
  const fields = FIELDS.filter(([key]) => details[key]);

  return (
    <PanelCard>
      <div className="flex flex-col gap-1 p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className={cn('font-semibold', isPublic ? 'text-xl leading-7 text-gray-900' : 'text-lg leading-7 text-gray-800')}>{passport.supplierName}</h2>
          {isPublic && !verified ? (
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium leading-4 text-gray-800">Draft</span>
          ) : (
            <SoftBadge tone={verified ? 'teal' : 'amber'}>{verified ? 'Verified passport' : 'Draft passport'}</SoftBadge>
          )}
        </div>
        <p className="text-sm leading-5 text-gray-500">{meta.join(' · ')}</p>
      </div>
      {fields.length > 0 ? (
        <dl className={cn('grid gap-4 border-t border-gray-100 px-5 pb-5 pt-4 sm:grid-cols-2', isPublic && 'lg:grid-cols-3')}>
          {fields.map(([key, label, kind]) => (
            <div key={key} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs leading-4 text-gray-500">{label}</dt>
              <dd className="truncate text-sm font-medium leading-5 text-gray-800" title={details[key] ?? undefined}>
                {kind === 'date' ? formatDate(details[key]) : details[key]}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="border-t border-gray-100 px-5 py-4 text-sm text-gray-500">
          {isPublic ? 'Company details appear once the SSM and CIDB documents are read.' : 'Company details appear once your SSM and CIDB documents are read.'}
        </p>
      )}
    </PanelCard>
  );
}
