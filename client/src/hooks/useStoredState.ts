import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';

export interface UseStoredStateOptions<T> {
  prefix?: string;
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T;
}

const defaultSerialize = <T,>(value: T): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defaultDeserialize = (raw: string): any => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

export function useStoredState<T>(
  key: string,
  initialValue: T,
  options?: UseStoredStateOptions<T>
): [T, Dispatch<SetStateAction<T>>] {
  const prefix = options?.prefix ?? 'cta';
  const storageKey = `${prefix}:${key}`;
  const serialize = options?.serialize ?? defaultSerialize<T>;
  const deserialize = options?.deserialize ?? defaultDeserialize;

  const readInitial = () => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw == null) return initialValue;
      const parsed = deserialize(raw);
      return (parsed as T) ?? initialValue;
    } catch {
      return initialValue;
    }
  };

  const [state, setState] = useState<T>(readInitial);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    // Skip first render write if storage already had value
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(storageKey, serialize(state));
    } catch {
      // ignore write errors
    }
  }, [state, storageKey, serialize]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      if (e.newValue == null) return;
      try {
        const next = deserialize(e.newValue) as T;
        setState(next);
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey, deserialize]);

  // Ensure a stable setter type; no special handling needed because we persist in effect
  const setter: Dispatch<SetStateAction<T>> = useMemo(() => (value) => {
    setState(value);
  }, []);

  return [state, setter];
}

// Helpers for common complex types
export function setSerde<T>(): UseStoredStateOptions<Set<T>> {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    serialize: (value: any) => {
      try {
        return JSON.stringify(Array.from((value as Set<T>).values()));
      } catch {
        return '[]';
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deserialize: (raw: string): any => {
      try {
        const arr = JSON.parse(raw);
        return new Set(Array.isArray(arr) ? (arr as T[]) : []);
      } catch {
        return new Set<T>();
      }
    }
  } as UseStoredStateOptions<Set<T>>;
}


