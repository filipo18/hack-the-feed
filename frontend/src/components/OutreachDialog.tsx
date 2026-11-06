import { useEffect, useRef, useState } from "react";

export interface OutreachDraft {
  title: string;
  message: string;
}

export function OutreachDialog({ draft, onClose }: { draft: OutreachDraft | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    if (!draft) return;
    setMessage(draft.message);
    setCopied(false);
    setCopyFailed(false);
    dialog.current?.showModal();
  }, [draft]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
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
          setCopyFailed(false);
        }}
      />
      <div className="outreach-actions">
        <button type="button" className="pill pill-primary" onClick={copy}>
          {copied ? "Copied" : copyFailed ? "Copy failed" : "Copy message"}
        </button>
        <button type="button" className="pill pill-quiet" onClick={() => dialog.current?.close()}>
          Close
        </button>
      </div>
    </dialog>
  );
}
