import { getPrimarySchool } from '@/lib/school';
import { clientFetch as fetch } from '@/lib/api/client';

export type AcademicPeriod = {
  id: string;
  academic_year_id: string;
  academic_year: number;
  academic_year_name: string;
  name: string;
  sequence: number;
  opening_date: string;
  closing_date: string;
  due_date: string;
  status: 'draft' | 'open' | 'closing' | 'closed';
  is_operational: boolean;
  activity_count: number | null;
  has_close_snapshot?: boolean;
  balance_carry_forward_id?: string | null;
  balance_carried_forward?: boolean;
  balance_carried_into?: boolean;
};

const cachedPeriods = new Map<string, AcademicPeriod[]>();
const pendingPeriods = new Map<string, Promise<AcademicPeriod[]>>();
const cachedDetailedPeriods = new Map<string, AcademicPeriod[]>();
const pendingDetailedPeriods = new Map<string, Promise<AcademicPeriod[]>>();

export async function getAcademicPeriods(includeActivity = false): Promise<AcademicPeriod[]> {
  const school = await getPrimarySchool();
  const cache = includeActivity ? cachedDetailedPeriods : cachedPeriods;
  const pending = includeActivity ? pendingDetailedPeriods : pendingPeriods;
  const cached = cache.get(school.id);
  if (cached) return cached;
  const existing = pending.get(school.id);
  if (existing) return existing;
  const request = fetch(`/api/backend/api/v1/academic-periods?school_id=${school.id}&include_activity=${includeActivity}`, { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load academic periods');
        const rows = await response.json() as AcademicPeriod[];
        cache.set(school.id, rows);
        return rows;
      })
      .finally(() => {
        pending.delete(school.id);
      });
  pending.set(school.id, request);
  return request;
}

export async function getSelectedPeriod(): Promise<AcademicPeriod> {
  const [school, periods] = await Promise.all([getPrimarySchool(), getAcademicPeriods()]);
  if (!periods.length) throw new Error('No academic period has been configured');
  const stored = typeof window === 'undefined' ? null : localStorage.getItem(`harambee-period:${school.id}`);
  const selected = periods.find(period => period.id === stored)
    ?? periods.find(period => period.is_operational)
    ?? periods[0];
  if (typeof window !== 'undefined') localStorage.setItem(`harambee-period:${school.id}`, selected.id);
  return selected;
}

export async function selectPeriod(periodId: string): Promise<void> {
  const school = await getPrimarySchool();
  localStorage.setItem(`harambee-period:${school.id}`, periodId);
}

export function setAcademicPeriods(schoolId: string, periods: AcademicPeriod[]): void {
  cachedPeriods.set(schoolId, periods);
}

export function clearPeriods(): void {
  cachedPeriods.clear();
  pendingPeriods.clear();
  cachedDetailedPeriods.clear();
  pendingDetailedPeriods.clear();
}

export function periodQuery(period: AcademicPeriod): string {
  return `period_id=${encodeURIComponent(period.id)}`;
}
