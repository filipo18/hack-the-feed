import { useEffect, useRef, useState } from "react";

export interface OutreachDraft {
  title: string;
  message: string;
}

export function OutreachDialog({
  draft,
  onClose,
  onSent,
  onSaveDraft,
}: {
  draft: OutreachDraft | null;
  onClose: () => void;
  onSent?: (message: string) => void;
  onSaveDraft?: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!draft) {
      dialog.current?.close();
      return;
    }
    setMessage(draft.message);
    setCopied(false);
    dialog.current?.showModal();
  }, [draft]);

  async function copy() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
  }

  return (
    <dialog ref={dialog} className="outreach" onClose={onClose}>
      <h2>{draft?.title}</h2>
      <label htmlFor="outreach-message">Message</label>
      <textarea
        id="outreach-message"
        rows={9}
        value={message}
        onChange={(event) => {
          setMessage(event.target.value);
          setCopied(false);
        }}
      />
      <div className="outreach-actions">
        {onSaveDraft && <button type="button" className="pill pill-primary" onClick={() => {
          onSaveDraft(message);
          dialog.current?.close();
        }}>Save draft</button>}
        <button type="button" className="pill pill-primary" onClick={copy}>
          {copied ? "Copied" : "Copy message"}
        </button>
        {onSent && (
          <button
            type="button"
            className="pill pill-quiet"
            onClick={() => {
              onSent(message);
              dialog.current?.close();
            }}
          >
            Mark as sent
          </button>
        )}
        <button type="button" className="pill pill-quiet" onClick={() => dialog.current?.close()}>
          Close
        </button>
      </div>
    </dialog>
  );
}
