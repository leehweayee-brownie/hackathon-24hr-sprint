'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DocTypesTab } from '@/features/admin/DocTypesTab';
import { OrganizationsTab } from '@/features/admin/OrganizationsTab';
import { QueueTab } from '@/features/admin/QueueTab';
import { RulesTab } from '@/features/admin/RulesTab';
import { cn } from '@/utils/cn';

const TABS = [
  { key: 'orgs', label: 'Organisations & users', component: OrganizationsTab },
  { key: 'types', label: 'Document types', component: DocTypesTab },
  { key: 'rules', label: 'Rule weights', component: RulesTab },
  { key: 'queue', label: 'Queue health', component: QueueTab },
] as const;

export default function AdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('orgs');
  const Active = TABS.find((t) => t.key === tab)!.component;
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Administration" description="Organisations, extraction configuration, rules and processing health." />
      <div className="mb-5 flex flex-wrap gap-1 border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cn('-mb-px border-b-2 px-3 py-2 text-[13px] font-medium', tab === t.key ? 'border-primary text-primary' : 'border-transparent text-ink-3 hover:text-ink')}>
            {t.label}
          </button>
        ))}
      </div>
      <Active />
    </div>
  );
}
