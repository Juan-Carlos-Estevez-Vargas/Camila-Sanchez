import { useCallback, useState, type ReactNode } from "react";
import { Modal } from "./Modal";

interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

/** Confirmación con un modal propio (en vez de window.confirm). */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [state, setState] = useState<(ConfirmOptions & { resolve(v: boolean): void }) | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...options, resolve })),
    [],
  );

  const close = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  const element = state ? (
    <Modal
      title={state.title}
      onClose={() => close(false)}
      footer={
        <>
          <button className="btn btn--ghost" onClick={() => close(false)}>Cancelar</button>
          <button className={`btn ${state.danger ? "btn--danger" : ""}`} onClick={() => close(true)}>
            {state.confirmLabel ?? "Confirmar"}
          </button>
        </>
      }
    >
      {state.body && <div className="muted">{state.body}</div>}
    </Modal>
  ) : null;

  return [confirm, element];
}
