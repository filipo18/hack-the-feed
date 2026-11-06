import { useEffect, useRef, useState } from "react";

export interface OutreachDraft {
  title: string;
  message: string;
}

export function OutreachDialog({
  draft,
  onClose,
  onSent,
}: {
  draft: OutreachDraft | null;
  onClose: () => void;
  onSent?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!draft) return;
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
        <button type="button" className="pill pill-primary" onClick={copy}>
          {copied ? "Copied" : "Copy message"}
        </button>
        {onSent && (
          <button
            type="button"
            className="pill pill-quiet"
            onClick={() => {
              onSent();
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
