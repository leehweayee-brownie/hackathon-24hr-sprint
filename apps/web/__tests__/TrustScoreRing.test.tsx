import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TrustScoreRing } from '@/features/trust-score/TrustScoreRing';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return { ...actual, useReducedMotion: () => true };
});

describe('TrustScoreRing', () => {
  it('shows the score and the green band at 80+', () => {
    render(<TrustScoreRing score={85} />);
    const ring = screen.getByTestId('trust-score-ring');
    expect(ring).toHaveAttribute('data-band', 'green');
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('Trusted')).toBeInTheDocument();
  });
  it('bands 60-79 amber and below 60 red', () => {
    const { rerender } = render(<TrustScoreRing score={65} />);
    expect(screen.getByTestId('trust-score-ring')).toHaveAttribute('data-band', 'amber');
    rerender(<TrustScoreRing score={45} />);
    expect(screen.getByTestId('trust-score-ring')).toHaveAttribute('data-band', 'red');
    expect(screen.getByText('High risk')).toBeInTheDocument();
  });
  it('renders a placeholder when there is no score', () => {
    render(<TrustScoreRing score={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Trust score: not available out of 100');
  });
});
