'use client';

import { MAX_FILE_SIZE_BYTES, MAX_FILES_PER_UPLOAD } from '@vp/shared';
import { FolderUp, UploadCloud } from 'lucide-react';
import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/utils/cn';

const ACCEPT = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif'],
};

export function DropZone({ onFiles, disabled, compact }: { onFiles: (files: File[]) => void; disabled?: boolean; compact?: boolean }) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length) onFiles(accepted.slice(0, MAX_FILES_PER_UPLOAD));
    },
    [onFiles],
  );
  const { getRootProps, getInputProps, isDragActive, fileRejections, open } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: MAX_FILE_SIZE_BYTES,
    disabled,
    multiple: true,
    noClick: true,
    useFsAccessApi: false,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-card border-2 border-dashed bg-panel text-center transition-colors duration-220',
        compact ? 'px-4 py-5' : 'px-6 py-14',
        isDragActive ? 'border-primary bg-primary-soft' : 'border-line hover:border-ink-3',
        disabled && 'opacity-60',
      )}
      data-testid="dropzone"
    >
      <input {...getInputProps()} data-testid="dropzone-input" {...({ webkitdirectory: '' } as Record<string, string>)} />
      <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,.heif" className="hidden" data-testid="file-input" onChange={(e) => e.target.files && onFiles(Array.from(e.target.files))} />
      <span className={cn('flex items-center justify-center rounded-full bg-primary-soft text-primary', compact ? 'size-9' : 'size-12')}>
        {isDragActive ? <FolderUp className={compact ? 'size-4' : 'size-6'} /> : <UploadCloud className={compact ? 'size-4' : 'size-6'} />}
      </span>
      <p className={cn('font-medium text-ink', compact ? 'mt-2 text-[13px]' : 'mt-4 text-[15px]')}>
        {isDragActive ? 'Drop to start sorting' : 'Drop a folder of documents here'}
      </p>
      {!compact ? <p className="mt-1 max-w-md text-[13px] text-muted">PDF, JPG, PNG or HEIC, multi-page scans welcome. Each file is classified, read and cross-checked automatically.</p> : null}
      <div className={cn('flex gap-2', compact ? 'mt-2' : 'mt-5')}>
        <button type="button" onClick={open} className="rounded-card border border-line bg-panel px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-surface" disabled={disabled}>
          Choose folder
        </button>
        <button
          type="button"
          onClick={(e) => (e.currentTarget.parentElement?.parentElement?.querySelector<HTMLInputElement>('[data-testid="file-input"]'))?.click()}
          className="rounded-card px-3 py-1.5 text-[13px] font-medium text-primary hover:bg-primary-soft"
          disabled={disabled}
        >
          or pick files
        </button>
      </div>
      {fileRejections.length > 0 ? (
        <p className="mt-3 text-[12px] text-danger">
          {fileRejections.length} file{fileRejections.length === 1 ? '' : 's'} skipped: unsupported type or over {Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB.
        </p>
      ) : null}
    </div>
  );
}
