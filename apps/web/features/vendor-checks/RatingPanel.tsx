'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { VendorCheckView } from '@vp/shared';
import { Loader2, Star } from 'lucide-react';
import { useState } from 'react';
import { keys } from '@/hooks/queries';
import { errorMessage } from '@/services/http';
import { vendorChecksService } from '@/services/vendor-checks';
import { toast } from '@/store/ui';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format';

const LABELS = ['', 'Poor', 'Below expectations', 'Met expectations', 'Good', 'Excellent'];

function Stars({ value, onPick, size = 'size-6' }: { value: number; onPick?: (n: number) => void; size?: string }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)} role={onPick ? 'radiogroup' : undefined} aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) =>
        onPick ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? 'star' : 'stars'}: ${LABELS[n]}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onPick(n)}
            className="rounded p-0.5"
            data-testid={`rate-${n}`}
          >
            <Star className={cn(size, n <= shown ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} aria-hidden />
          </button>
        ) : (
          <Star key={n} className={cn(size, n <= shown ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} aria-hidden />
        ),
      )}
    </div>
  );
}

/** Rate step of Find → Check → Award → Rate: the buyer scores the job once it is done; it ranks future Vendor Match shortlists. */
export function RatingPanel({ check }: { check: VendorCheckView }) {
  const qc = useQueryClient();
  const existing = check.rating ?? null;
  const [editing, setEditing] = useState(!existing);
  const [score, setScore] = useState(existing?.score ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');

  const save = useMutation({
    mutationFn: () => vendorChecksService.rate(check.id, score, comment.trim() || undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.check(check.id) });
      setEditing(false);
      toast({ title: 'Rating saved', description: 'It will count toward future Vendor Match shortlists.', tone: 'success' });
    },
    onError: (e) => toast({ title: 'Could not save the rating', description: errorMessage(e), tone: 'danger' }),
  });

  if (existing && !editing) {
    return (
      <div className="flex flex-col gap-1.5 border-t border-gray-200 px-5 py-4" data-testid="rating">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium leading-5 text-gray-800">Job rating</p>
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium leading-4 text-brand hover:underline">
            Edit
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Stars value={existing.score} size="size-5" />
          <span className="text-sm leading-5 text-gray-600">{LABELS[existing.score]}</span>
        </div>
        {existing.comment ? <p className="text-sm leading-5 text-gray-600">“{existing.comment}”</p> : null}
        <p className="text-xs leading-4 text-gray-400">
          {existing.ratedByName ? `${existing.ratedByName} · ` : ''}
          {formatDate(existing.createdAt)}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4" data-testid="rating">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium leading-5 text-gray-800">Rate this job</p>
        <p className="text-xs leading-4 text-gray-500">How did the vendor deliver? Ratings rank future Vendor Match shortlists.</p>
      </div>
      <div className="flex items-center gap-2">
        <Stars value={score} onPick={setScore} />
        {score ? <span className="text-sm leading-5 text-gray-600">{LABELS[score]}</span> : null}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Optional: on time? quality? safety?"
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-5 text-gray-800 placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
      <div className="flex justify-end gap-2">
        {existing ? (
          <button type="button" onClick={() => setEditing(false)} className="rounded-lg px-3 py-2 text-sm font-medium leading-5 text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={!score || save.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium leading-5 text-white hover:bg-brand-hover disabled:opacity-50"
          data-testid="save-rating"
        >
          {save.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Save rating
        </button>
      </div>
    </div>
  );
}
