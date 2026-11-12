import { RuleCode, Severity, type Finding } from '@vp/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FindingCard } from '@/features/findings/FindingCard';

const finding: Finding = {
  rule: RuleCode.COMPANY_NAME_MISMATCH,
  severity: Severity.WARNING,
  message: 'Public liability insurance names "Bina Jaya Engineering Sdn Bhd", but SSM company registration says "Bina Jaya Sdn Bhd"',
  deduction: 20,
  documentIds: ['doc-1', 'doc-2'],
};

describe('FindingCard', () => {
  it('shows the rule label, message, severity and deduction', () => {
    render(<FindingCard finding={finding} />);
    expect(screen.getByText('Company name mismatch')).toBeInTheDocument();
    expect(screen.getByText(/Bina Jaya Engineering/)).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByLabelText('Deduction 20 points')).toHaveTextContent('−20');
  });
  it('links to the documents behind the finding', () => {
    render(<FindingCard finding={finding} documentHref={(id) => `/docs/${id}`} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/docs/doc-1');
  });
  it('hides a zero deduction', () => {
    render(<FindingCard finding={{ ...finding, deduction: 0 }} />);
    expect(screen.queryByText(/−/)).not.toBeInTheDocument();
  });
});
