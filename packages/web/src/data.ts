import { useEffect, useState } from "react";
import type { InventorySnapshot } from "@agent-mapper/core";
import { getInventory, getProjects, type ProjectList } from "./api";

interface LoadState<T> {
  value?: T;
  error?: string;
  loading: boolean;
  key?: string;
  path?: string;
}

/** Rediscovers projects whenever `refresh` changes; the previous list stays visible meanwhile. */
export function useProjects(refresh: number): LoadState<ProjectList> {
  const [state, setState] = useState<LoadState<ProjectList>>({ loading: true });
  const key = String(refresh);
  useEffect(() => {
    const controller = new AbortController();
    void getProjects(controller.signal).then(
      (value) => setState({ value, loading: false, key }),
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState((previous) => ({
            value: previous.value,
            error: error instanceof Error ? error.message : String(error),
            loading: false,
            key
          }));
        }
      }
    );
    return () => controller.abort();
  }, [key]);
  return state.key === key ? state : { ...state, loading: true };
}

export function useInventory(
  path: string,
  refresh: number
): LoadState<InventorySnapshot> {
  const [state, setState] = useState<LoadState<InventorySnapshot>>({
    loading: false
  });
  const key = `${path}:${refresh}`;
  useEffect(() => {
    const controller = new AbortController();
    void getInventory(path, controller.signal).then(
      (value) => setState({ value, loading: false, key, path }),
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState((previous) => ({
            value: previous.path === path ? previous.value : undefined,
            error: error instanceof Error ? error.message : String(error),
            loading: false,
            key,
            path
          }));
        }
      }
    );
    return () => controller.abort();
  }, [path, key]);
  return state.key !== key
    ? {
        value: state.path === path ? state.value : undefined,
        loading: true,
        key,
        path
      }
    : state;
}
