"use client";

import { useEffect, useState, useTransition } from "react";

type EvidenceUploaderProps = {
  disabled?: boolean;
  onUploaded(urls: string[]): void;
};

export function EvidenceUploader({ disabled, onUploaded }: EvidenceUploaderProps) {
  const [provider, setProvider] = useState<"browser" | "ipfs" | "drive">("browser");
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [providerStatus, setProviderStatus] = useState<{
    ipfs: boolean;
    drive: boolean;
    note: string;
  }>({
    ipfs: false,
    drive: false,
    note: "Checking upload providers...",
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;

    async function loadProviderStatus() {
      try {
        const response = await fetch("/api/evidence/upload", { method: "GET" });
        const payload = (await response.json()) as {
          ipfsEnabled?: boolean;
          driveEnabled?: boolean;
          note?: string;
        };

        if (!active) return;

        setProviderStatus({
          ipfs: Boolean(payload.ipfsEnabled),
          drive: Boolean(payload.driveEnabled),
          note: payload.note ?? "Upload provider status loaded.",
        });
      } catch {
        if (!active) return;

        setProviderStatus({
          ipfs: false,
          drive: false,
          note: "Could not verify upload provider status.",
        });
      }
    }

    void loadProviderStatus();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (provider === "ipfs" && !providerStatus.ipfs && providerStatus.drive) {
      setProvider("drive");
    }

    if (provider === "drive" && !providerStatus.drive && providerStatus.ipfs) {
      setProvider("ipfs");
    }

    if (provider === "browser") {
      return;
    }

    if (!providerStatus.ipfs && !providerStatus.drive) {
      setProvider("browser");
    }
  }, [provider, providerStatus.drive, providerStatus.ipfs]);

  function upload() {
    startTransition(async () => {
      try {
        setMessage("");

        if (provider === "browser") {
          const urls = files.map((file) => URL.createObjectURL(file));
          onUploaded(urls);
          setFiles([]);
          setMessage(
            `${urls.length} file(s) attached in browser draft mode. These links are temporary for this browser session.`,
          );
          return;
        }

        const formData = new FormData();
        formData.append("provider", provider);
        files.forEach((file) => formData.append("files", file));

        const response = await fetch("/api/evidence/upload", {
          method: "POST",
          body: formData,
        });

        const payload = (await response.json()) as {
          error?: string;
          uploads?: { url: string }[];
        };

        if (!response.ok || payload.error) {
          throw new Error(payload.error ?? "Upload failed.");
        }

        const urls = (payload.uploads ?? []).map((upload) => upload.url);
        onUploaded(urls);
        setFiles([]);
        setMessage(`${urls.length} file(s) uploaded to ${provider}.`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Upload failed.");
      }
    });
  }

  return (
    <div className="uploader">
      <div className="uploader-head">
        <strong>Evidence vault</strong>
        <span>Upload directly to IPFS or Google Drive</span>
      </div>
      <div className="uploader-controls">
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value as "browser" | "ipfs" | "drive")}
          disabled={disabled || isPending}
        >
          <option value="browser">Browser draft upload</option>
          <option value="ipfs" disabled={!providerStatus.ipfs}>
            IPFS via Pinata{providerStatus.ipfs ? "" : " (not configured)"}
          </option>
          <option value="drive" disabled={!providerStatus.drive}>
            Google Drive{providerStatus.drive ? "" : " (not configured)"}
          </option>
        </select>
        <div className="file-picker file-picker-direct">
          <input
            className="file-input-direct"
            type="file"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            disabled={disabled || isPending}
          />
          <div className="file-picker-summary">
            {files.length ? `${files.length} file(s) selected` : "No file chosen"}
          </div>
        </div>
        <button
          className="button secondary"
          type="button"
          onClick={upload}
          disabled={
            disabled ||
            isPending ||
            files.length === 0 ||
            (provider === "ipfs"
              ? !providerStatus.ipfs
              : provider === "drive"
                ? !providerStatus.drive
                : false)
          }
        >
          {isPending ? "Uploading..." : "Upload evidence"}
        </button>
      </div>
      {files.length ? (
        <div className="meta">
          {files.map((file) => (
            <span key={`${file.name}-${file.size}`}>{file.name}</span>
          ))}
        </div>
      ) : null}
      <p className="tiny-note">
        {message ||
          (provider === "browser"
            ? "Browser draft upload keeps files available only in this browser session."
            : providerStatus.note)}
      </p>
    </div>
  );
}
