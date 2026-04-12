import { Loader2, Trash2 } from "lucide-react";

interface CascadeDeleteDialogProps {
  open: boolean;
  entryTitle: string;
  linkedLeftoverCount: number;
  trayItemCount: number;
  onCancel: () => void;
  onDeleteAll: () => void;
  isSubmitting: boolean;
}

/**
 * Shown when the user tries to delete an original meal that has linked
 * leftover entries and/or tray items. Lets them keep the dependents
 * (delete only this) or cascade the removal (delete everything).
 */
export function CascadeDeleteDialog({
  open,
  entryTitle,
  linkedLeftoverCount,
  trayItemCount,
  onCancel,
  onDeleteAll,
  isSubmitting,
}: CascadeDeleteDialogProps) {
  if (!open) return null;

  const parts: string[] = [];
  if (linkedLeftoverCount > 0) {
    parts.push(
      `${linkedLeftoverCount} scheduled leftover${linkedLeftoverCount === 1 ? "" : "s"}`
    );
  }
  if (trayItemCount > 0) {
    parts.push(
      `${trayItemCount} tray item${trayItemCount === 1 ? "" : "s"}`
    );
  }
  const summary = parts.join(" and ");

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onCancel}
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50">
            <Trash2 className="h-4 w-4 text-red-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-gray-900">
              Remove {entryTitle}?
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              This meal has {summary}. What would you like to do with them?
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDeleteAll}
            disabled={isSubmitting}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Remove all
          </button>
        </div>
      </div>
    </div>
  );
}
