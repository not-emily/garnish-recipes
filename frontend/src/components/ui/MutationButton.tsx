import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface MutationButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  /** True while the mutation is in flight. Disables click and shows a spinner. */
  pending: boolean;
  /** Additional disable reasons (e.g. empty input). Combined with pending. */
  disabled?: boolean;
  /** Icon shown to the left of the label when not pending. */
  icon?: ReactNode;
  children: ReactNode;
}

/**
 * Button that enforces a consistent mutation-in-flight UX: disabled while
 * pending, spinner replacing the leading icon, and `pointer-events: none` so
 * rapid taps can't queue a second click in the same frame.
 *
 * Pair with `useOptimisticMutation` and pass its `.isPending` flag.
 */
export const MutationButton = forwardRef<HTMLButtonElement, MutationButtonProps>(
  function MutationButton(
    { pending, disabled, icon, children, className = "", ...rest },
    ref
  ) {
    const isDisabled = pending || disabled;
    const leading = pending ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : (
      icon
    );

    return (
      <button
        ref={ref}
        type="button"
        {...rest}
        disabled={isDisabled}
        aria-busy={pending || undefined}
        className={`${className} ${
          isDisabled ? "pointer-events-none opacity-60" : ""
        }`}
      >
        {leading}
        {children}
      </button>
    );
  }
);
