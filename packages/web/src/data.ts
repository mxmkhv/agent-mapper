import { useEffect, useState } from "react";
import type { HostInfo, InventorySnapshot } from "@agent-mapper/core";
import { getHost, getInventory, getProjects, type ProjectList } from "./api";

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

/** The server's platform, fetched once: it cannot change while the server runs. */
export function useHost(): LoadState<HostInfo> {
  const [state, setState] = useState<LoadState<HostInfo>>({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    void getHost(controller.signal).then(
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
