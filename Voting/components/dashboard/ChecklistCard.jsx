'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, ClipboardCheck, Loader2 } from 'lucide-react';
import { getJson } from './ui';

export function useChecklist(electionId, enabled = true) {
  return useQuery({
    queryKey: ['checklist', electionId],
    queryFn: () => getJson(`/api/elections/${electionId}/checklist`),
    enabled: !!electionId && enabled,
  });
}

/** Plain-language "ready to open voting?" list. Shared by the dashboard and the guardian portal. */
export default function ChecklistCard({ checklist, loading, title = 'Ready to open voting?' }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-body"><Loader2 size={14} className="animate-spin" /> Checking…</div>
    );
  }
  if (!checklist) return null;
  return (
    <div className="bg-canvas border border-hairline rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-ink flex items-center gap-2">
        <ClipboardCheck size={15} className="text-primary" /> {title}
        {checklist.ready ? (
          <span className="ml-auto text-xs font-semibold text-green-700 dark:text-green-300">All set</span>
        ) : (
          <span className="ml-auto text-xs font-semibold text-amber-700 dark:text-amber-300">
            {checklist.items.filter((i) => !i.ok).length} to finish
          </span>
        )}
      </p>
      <ul className="space-y-2">
        {checklist.items.map((item) => (
          <li key={item.key} className="flex items-start gap-2.5 text-sm">
            {item.ok ? (
              <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            ) : (
              <Circle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            )}
            <span className="min-w-0">
              <span className={item.ok ? 'text-ink' : 'text-ink font-semibold'}>{item.label}</span>
              {item.detail && <span className="block text-xs text-body">{item.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
