/**
 * Provides the opened SqlDatabase and repository instances to the React tree.
 * Opens the DB once on mount; exposes ready / error states for splash gating.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { openAppDatabase } from '@/src/db/database';
import type { SqlDatabase } from '@/src/db/types';
import { formatErrorForDiagnostics } from '@/src/domain/errors';
import { DailyCheckInRepository } from '@/src/repositories/DailyCheckInRepository';
import { AnalyticsRepository } from '@/src/analytics/AnalyticsRepository';
import { CustomFactorRepository } from '@/src/repositories/CustomFactorRepository';
import { HeadacheRepository } from '@/src/repositories/HeadacheRepository';
import { MedicationRepository } from '@/src/repositories/MedicationRepository';
import { SettingsRepository } from '@/src/repositories/SettingsRepository';

export type DatabaseContextValue = {
  /** True once openAppDatabase + migrations completed successfully. */
  ready: boolean;
  /** Non-null when opening / migrating failed. */
  error: string | null;
  db: SqlDatabase | null;
  headacheRepository: HeadacheRepository | null;
  customFactorRepository: CustomFactorRepository | null;
  medicationRepository: MedicationRepository | null;
  dailyCheckInRepository: DailyCheckInRepository | null;
  analyticsRepository: AnalyticsRepository | null;
  settingsRepository: SettingsRepository | null;
};

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

type Props = {
  children: ReactNode;
};

/**
 * Opens the local SQLite database on mount and shares repositories via context.
 * Keep this high in the tree (e.g. root layout) so tabs can assume storage access.
 */
export function DatabaseProvider({ children }: Props) {
  const [db, setDb] = useState<SqlDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Defer state updates so the effect does not sync-setState in the same turn
    // (satisfies react-hooks/set-state-in-effect while still opening DB on mount).
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      try {
        const opened = openAppDatabase();
        if (!cancelled) {
          setDb(opened);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatErrorForDiagnostics(err));
          setDb(null);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<DatabaseContextValue>(() => {
    if (!db) {
      return {
        ready: false,
        error,
        db: null,
        headacheRepository: null,
        customFactorRepository: null,
        medicationRepository: null,
        dailyCheckInRepository: null,
        analyticsRepository: null,
        settingsRepository: null,
      };
    }

    return {
      ready: true,
      error: null,
      db,
      headacheRepository: new HeadacheRepository(db),
      customFactorRepository: new CustomFactorRepository(db),
      medicationRepository: new MedicationRepository(db),
      dailyCheckInRepository: new DailyCheckInRepository(db),
      analyticsRepository: new AnalyticsRepository(db),
      settingsRepository: new SettingsRepository(db),
    };
  }, [db, error]);

  return (
    <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>
  );
}

/**
 * Hook to access the database context.
 * Throws if used outside DatabaseProvider (fail fast in development).
 */
export function useDatabase(): DatabaseContextValue {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error('useDatabase must be used within DatabaseProvider');
  }
  return ctx;
}
