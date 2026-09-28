import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/errors';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

/**
 * Fetch-on-mount + retry helper shared by every screen that reads from the
 * mock API. Encapsulates exactly the three states the Figma "07 — States"
 * page documents (Skeleton while loading, Error with "Повторить", data once
 * loaded) so screens don't re-implement it individually.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => setState({ data, loading: false, error: null }),
      (error: unknown) => setState({ data: null, loading: false, error: toApiError(error) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, reload: () => setTick((t) => t + 1) };
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError('VALIDATION_ERROR', 'Неизвестная ошибка', 500);
}
