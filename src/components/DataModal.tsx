import { useRef, useState } from "react";
import type { Item } from "../types";
import { exportItems, parseImportedItems } from "../lib/storage";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

export function DataModal({
  items,
  onImport,
  onClear,
  onClose,
}: {
  items: Item[];
  onImport: (items: Item[]) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [copied, setCopied] = useState(false);

  const sizeKb = (new Blob([exportItems(items)]).size / 1024).toFixed(1);

  function download() {
    const blob = new Blob([exportItems(items)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `entretempo-backup-${date}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Backup exportado.");
    setError("");
  }

  async function copy() {
    const payload = exportItems(items);

    function markCopied() {
      setCopied(true);
      setError("");
      window.setTimeout(() => setCopied(false), 2000);
    }

    try {
      if (!navigator.clipboard) throw new Error("Clipboard indisponível");
      await navigator.clipboard.writeText(payload);
      markCopied();
    } catch {
      try {
        const area = document.createElement("textarea");
        area.value = payload;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(area);
        if (!ok) throw new Error("Cópia bloqueada pelo sistema");
        markCopied();
      } catch {
        setError("Não foi possível copiar. Use o botão de exportar.");
      }
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseImportedItems(text);
      onImport(parsed);
      setMessage(`${parsed.length} ${parsed.length === 1 ? "item importado" : "itens importados"}.`);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível importar esse arquivo.");
      setMessage("");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Modal
      eyebrow="Seus dados"
      title="Backup e armazenamento"
      size="sm"
      onClose={onClose}
      footer={
        <div className="modal-footer-row">
          <span className="footer-note">
            {items.length} {items.length === 1 ? "item" : "itens"} · {sizeKb} KB
          </span>
          <button type="button" className="secondary-button" onClick={onClose}>
            Fechar
          </button>
        </div>
      }
    >
      <div className="data-modal">
        <div className="data-list">
          <button type="button" className="data-action" onClick={download}>
            <span className="data-action-icon">
              <Icon name="download" size={17} />
            </span>
            <span>
              <strong>Exportar backup</strong>
              <small>Baixe um arquivo .json com todos os itens e tempos.</small>
            </span>
            <Icon name="chevronRight" size={16} />
          </button>

          <button type="button" className="data-action" onClick={() => fileRef.current?.click()}>
            <span className="data-action-icon">
              <Icon name="upload" size={17} />
            </span>
            <span>
              <strong>Importar backup</strong>
              <small>Substitui a lista atual pelos itens do arquivo.</small>
            </span>
            <Icon name="chevronRight" size={16} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />

          <button type="button" className="data-action" onClick={() => void copy()}>
            <span className="data-action-icon">
              <Icon name="database" size={17} />
            </span>
            <span>
              <strong>{copied ? "Copiado!" : "Copiar JSON"}</strong>
              <small>Útil para guardar uma cópia em arquivo ou em outro serviço.</small>
            </span>
            <Icon name="chevronRight" size={16} />
          </button>
        </div>

        {message ? (
          <div className="inline-success">
            <Icon name="check" size={15} />
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="inline-warning">
            <Icon name="info" size={15} />
            {error}
          </div>
        ) : null}

        <div className="info-box">
          <Icon name="info" size={16} />
          <p>
            Seus itens ficam salvos na <strong>sua conta</strong> e são sincronizados
            automaticamente entre dispositivos. Exporte um backup de vez em quando para guardar
            uma cópia extra.
          </p>
        </div>

        <div className="danger-zone">
          <div>
            <strong>Apagar todos os itens</strong>
            <small>Essa ação não pode ser desfeita sem um backup.</small>
          </div>
          {confirmClear ? (
            <div className="danger-actions">
              <button type="button" className="secondary-button" onClick={() => setConfirmClear(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => {
                  onClear();
                  setConfirmClear(false);
                  setMessage("Lista apagada.");
                  setError("");
                }}
              >
                Apagar tudo
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="status-button is-danger"
              onClick={() => setConfirmClear(true)}
            >
              <Icon name="trash" size={15} />
              Apagar
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
