"use client";
import { useActionState } from "react";

export type ActionState = { error?: string; ok?: string; fields?: Record<string, string[] | undefined> } | null;

/** Small wrapper so server-action forms show pending, error and success states consistently. */
export function ActionForm({
  action,
  children,
  submitLabel,
  className,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className} noValidate>
      {state?.error && <p className="notice error" role="alert">{state.error}</p>}
      {state?.ok && <p className="notice success" role="status">{state.ok}</p>}
      {children}
      <button className="btn btn-primary" disabled={pending} style={{ marginTop: 20 }}>
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}

export function Field({ name, label, type = "text", autoComplete, defaultValue, required = true, hint }: {
  name: string; label: string; type?: string; autoComplete?: string; defaultValue?: string; required?: boolean; hint?: string;
}) {
  return (
    <div className="form-field" style={{ marginBottom: 14 }}>
      <label htmlFor={`f-${name}`}>{label}</label>
      <input id={`f-${name}`} name={name} type={type} className="field" autoComplete={autoComplete} defaultValue={defaultValue} required={required} />
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
