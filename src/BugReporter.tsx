import { useState, useEffect } from 'react';
import { Bug } from 'lucide-react';
import { BugReportModal } from './BugReportModal';
import { RouteTracker } from './RouteTracker';
import { cn } from '@/lib/utils';
import type { BugReporterConfig } from './types';

const DEFAULT_API_URL = 'https://bug-reporter-tau.vercel.app';

/**
 * BugReporter — Drop-in floating bug reporter for any ViacoreMedia project.
 * 
 * Usage:
 * ```tsx
 * <BugReporter systemName="Map" />
 * // or with user context:
 * <BugReporter systemName="Map" user={{ name: "Josh", email: "josh@viacore.com" }} />
 * ```
 */
export function BugReporter({ systemName, apiUrl, user, contact }: BugReporterConfig) {
  const [isOpen, setIsOpen] = useState(false);
  const baseUrl = apiUrl || DEFAULT_API_URL;

  // Auto-register system on first load
  useEffect(() => {
    const storageKey = `bug-reporter-${systemName}-registered`;
    
    if (localStorage.getItem(storageKey)) return;
    
    fetch(`${baseUrl}/api/bugs/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        systemName,
        contact: contact || 'joshua@viacoremedia.com' 
      }),
    })
      .then(res => res.json())
      .then(() => {
        localStorage.setItem(storageKey, 'true');
      })
      .catch(() => {
        // Silent fail - will retry on next page load
      });
  }, [systemName, baseUrl, contact]);

  return (
    <>
      {/* Console log interceptor — starts buffering immediately */}
      <RouteTracker />

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-[9997]",
          "w-10 h-10 rounded-full",
          "bg-muted/80 hover:bg-muted",
          "border border-border shadow-lg",
          "flex items-center justify-center",
          "transition-all duration-200",
          "hover:scale-110 hover:shadow-xl",
          "group"
        )}
        title="Report a Bug"
        aria-label="Report a Bug"
      >
        <Bug className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </button>

      {/* Modal */}
      <BugReportModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        systemName={systemName}
        apiUrl={baseUrl}
        user={user}
      />
    </>
  );
}
