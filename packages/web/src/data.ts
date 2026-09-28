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

export function useProjects(): LoadState<ProjectList> {
  const [state, setState] = useState<LoadState<ProjectList>>({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    void getProjects(controller.signal).then(
      (value) => setState({ value, loading: false }),
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            error: error instanceof Error ? error.message : String(error),
            loading: false
          });
        }
      }
    );
    return () => controller.abort();
  }, []);
  return state;
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
