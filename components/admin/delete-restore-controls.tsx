import { btnDangerCls, btnRestoreCls, inputCls } from "./admin-field";

interface DeleteControlsProps {
  /** The server action that performs the soft-delete. */
  action: (fd: FormData) => Promise<void>;
  /** Hidden inputs to include alongside the action (e.g. id, slug, cragSlug). */
  hiddenInputs: Record<string, string>;
}

/**
 * A compact inline delete form requiring the admin to type "DELETE" to confirm.
 * The action must guard `confirm === "DELETE"` (done in the Server Action layer).
 */
export function DeleteControls({ action, hiddenInputs }: DeleteControlsProps) {
  return (
    <form action={action} className="flex items-center gap-1">
      {Object.entries(hiddenInputs).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input
        name="confirm"
        placeholder="DELETE"
        required
        className={`${inputCls} w-20`}
        aria-label='Type DELETE to confirm'
      />
      <button type="submit" className={btnDangerCls}>
        Delete
      </button>
    </form>
  );
}

interface RestoreControlsProps {
  action: (fd: FormData) => Promise<void>;
  hiddenInputs: Record<string, string>;
}

export function RestoreControls({ action, hiddenInputs }: RestoreControlsProps) {
  return (
    <form action={action} className="inline">
      {Object.entries(hiddenInputs).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className={btnRestoreCls}>
        Restore
      </button>
    </form>
  );
}
