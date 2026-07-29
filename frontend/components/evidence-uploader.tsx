"use client";

import { useState, useTransition } from "react";

type EvidenceUploaderProps = {
  disabled?: boolean;
  onUploaded(urls: string[]): void;
};

export function EvidenceUploader({ disabled, onUploaded }: EvidenceUploaderProps) {
  const [provider, setProvider] = useState<"ipfs" | "drive">("ipfs");
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function upload() {
    startTransition(async () => {
      try {
        setMessage("");
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
          onChange={(event) => setProvider(event.target.value as "ipfs" | "drive")}
          disabled={disabled || isPending}
        >
          <option value="ipfs">IPFS via Pinata</option>
          <option value="drive">Google Drive</option>
        </select>
        <input
          type="file"
          multiple
          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          disabled={disabled || isPending}
        />
        <button
          className="button secondary"
          type="button"
          onClick={upload}
          disabled={disabled || isPending || files.length === 0}
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
      {message ? <p className="tiny-note">{message}</p> : null}
    </div>
  );
}
