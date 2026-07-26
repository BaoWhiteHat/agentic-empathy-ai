// hooks/useOcean.ts — polls the backend OCEAN profile (scores + narrative) every 5s.
import { useEffect, useState } from 'react';
import type { OceanData } from '../components/ui/Ocean';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const DEFAULT_OCEAN: OceanData = {
  openness: 0.5,
  conscientiousness: 0.5,
  extraversion: 0.5,
  agreeableness: 0.5,
  neuroticism: 0.5,
};

const normalizeNarrative = (value: unknown) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed && trimmed.toLowerCase() !== 'no narrative yet.' ? trimmed : '';
};

export interface OceanProfile {
  /** OCEAN scores (0–1), mapped to the radar's O/C/E/A/N axes. */
  ocean: OceanData;
  /** Narrative from reflect_on_history(); empty string until enough history exists. */
  narrative: string;
  /** False until the first successful fetch — drive the loading skeleton off this. */
  loaded: boolean;
  /** Error message when the latest fetch failed (network or non-OK response); null otherwise. */
  error: string | null;
}

/**
 * Fetches GET /api/ocean/{userId} (scores 0–1 + narrative) on mount and refreshes
 * every 5s. `userId` originates from UserContext, which is hydrated from
 * localStorage (`soulmate_user_id`).
 */
export function useOcean(userId: string): OceanProfile {
  const [ocean, setOcean] = useState<OceanData>(DEFAULT_OCEAN);
  const [narrative, setNarrative] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();

    const fetchOcean = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/ocean/${userId}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setOcean({
          openness: data.openness ?? 0.5,
          conscientiousness: data.conscientiousness ?? 0.5,
          extraversion: data.extraversion ?? 0.5,
          agreeableness: data.agreeableness ?? 0.5,
          neuroticism: data.neuroticism ?? 0.5,
        });
        setNarrative(normalizeNarrative(data.narrative));
        setError(null);
        setLoaded(true);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return; // silently ignore
        if (err instanceof TypeError) {
          setError('Could not reach the server. Is the backend running?');
        } else {
          setError((err as Error).message);
        }
      }
    };

    fetchOcean();
    const interval = setInterval(fetchOcean, 5000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [userId]);

  return { ocean, narrative, loaded, error };
}
