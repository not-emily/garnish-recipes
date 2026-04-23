import { useEffect, useRef } from "react";
import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
  type UseMutationResult,
} from "@tanstack/react-query";
import { ApiError, isApiError } from "@/api/client";
import { useToast } from "@/components/ui/Toast";

/**
 * Wrapper around useMutation that enforces a consistent legibility story:
 *   - optimistic cache update with a rollback closure returned from the update fn
 *   - error toast with a "Retry" action for retryable failures
 *   - related query keys invalidated on settle
 *
 * Convention for pending visuals: include a `_pending: true` flag on any
 * optimistically-inserted cache entity. Components render pending entries at
 * reduced opacity (or with a small dot) so users can see their action is
 * in-flight.
 */
interface UseOptimisticMutationOptions<TVars, TData> {
  /** The actual network request. Thrown errors must be `ApiError` instances. */
  mutationFn: (vars: TVars) => Promise<TData>;

  /**
   * Apply the optimistic change to the query cache. Return a function that
   * undoes the change — it will be called on failure. Return nothing to skip
   * optimistic updating (useful for mutations where the UI can just wait).
   */
  onOptimisticUpdate?: (vars: TVars, qc: QueryClient) => (() => void) | void;

  /** Called after a successful response; use to patch the cache with server data. */
  onSuccess?: (data: TData, vars: TVars, qc: QueryClient) => void;

  /**
   * Query keys whose in-flight refetches should be cancelled before the
   * optimistic update applies. Prevents a background refetch from landing
   * after our setQueryData and overwriting optimistic state with stale data.
   * Typically the same key(s) your optimistic update writes to.
   */
  cancelKeys?: QueryKey[];

  /** Query keys to invalidate after settle (success or failure). */
  invalidateKeys?: QueryKey[];

  /** Optional success toast. Omit for silent success (the common case). */
  successToast?: string | ((data: TData, vars: TVars) => string);

  /**
   * Error toast message. Defaults to the ApiError's message. Pass a string or
   * a function taking the error + vars. A "Retry" action is attached
   * automatically for transient/offline errors (whose retryable flag is true).
   */
  errorToast?: string | ((err: ApiError | null, vars: TVars) => string);
}

type RollbackFn = () => void;

export function useOptimisticMutation<TVars, TData>(
  opts: UseOptimisticMutationOptions<TVars, TData>
): UseMutationResult<TData, unknown, TVars, RollbackFn | undefined> {
  const qc = useQueryClient();
  const { toast } = useToast();

  // Capture `mutate` in a ref so the error toast's Retry action can re-fire
  // the same mutation with the same vars. (Closing over `mutation.mutate`
  // directly in onError creates a chicken/egg reference cycle.)
  const mutateRef = useRef<((vars: TVars) => void) | null>(null);

  const mutation = useMutation<TData, unknown, TVars, RollbackFn | undefined>({
    mutationFn: opts.mutationFn,
    onMutate: async (vars) => {
      // Cancel any in-flight queries for the keys we're about to touch.
      // Without this, a refetch that started before our mutate call can
      // overwrite our optimistic (or post-success) cache state on arrival,
      // producing ghost/flicker rows.
      if (opts.cancelKeys) {
        await Promise.all(
          opts.cancelKeys.map((key) => qc.cancelQueries({ queryKey: key }))
        );
      }
      const rollback = opts.onOptimisticUpdate?.(vars, qc);
      return typeof rollback === "function" ? rollback : undefined;
    },
    onError: (err, vars, rollback) => {
      rollback?.();

      const apiErr = isApiError(err) ? err : null;
      const message =
        typeof opts.errorToast === "function"
          ? opts.errorToast(apiErr, vars)
          : opts.errorToast ?? apiErr?.message ?? "Something went wrong";

      const canRetry = apiErr ? apiErr.retryable : false;
      toast(
        message,
        "error",
        canRetry
          ? {
              action: {
                label: "Retry",
                onClick: () => mutateRef.current?.(vars),
              },
            }
          : undefined
      );
    },
    onSuccess: (data, vars) => {
      opts.onSuccess?.(data, vars, qc);
      if (opts.successToast) {
        const msg =
          typeof opts.successToast === "function"
            ? opts.successToast(data, vars)
            : opts.successToast;
        toast(msg, "success");
      }
    },
    onSettled: () => {
      opts.invalidateKeys?.forEach((key) =>
        qc.invalidateQueries({ queryKey: key })
      );
    },
  });

  // TanStack's `mutate` reference is stable, so this only fires once after
  // the first render — but we use useEffect instead of assigning during render
  // to satisfy React's rule against mutating refs in the render phase.
  useEffect(() => {
    mutateRef.current = mutation.mutate;
  }, [mutation.mutate]);

  return mutation;
}
