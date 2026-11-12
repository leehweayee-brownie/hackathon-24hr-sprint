'use client';

import { MAX_FILE_SIZE_BYTES, MAX_FILES_PER_UPLOAD } from '@vp/shared';
import { CloudUpload, FolderUp, Upload } from 'lucide-react';
import { useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/utils/cn';

const ACCEPT = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif'],
};
const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.heic,.heif';
const MAX_MB = Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024);

/** Figma "Dropzone": dashed gray-300, 56px brand-tint icon circle, prompt with a red "browse" link and a primary button. */
export function DropZone({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length) onFiles(accepted.slice(0, MAX_FILES_PER_UPLOAD));
    },
    [onFiles],
  );
  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: MAX_FILE_SIZE_BYTES,
    disabled,
    multiple: true,
    noClick: true,
    useFsAccessApi: false,
  });
  const browse = () => fileInput.current?.click();

  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
        isDragActive ? 'border-brand bg-brand-tint' : 'border-gray-300 bg-white',
        disabled && 'opacity-60',
      )}
      data-testid="dropzone"
    >
      <input {...getInputProps()} data-testid="dropzone-input" />
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="hidden"
        data-testid="file-input"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(Array.from(e.target.files).slice(0, MAX_FILES_PER_UPLOAD));
          e.target.value = '';
        }}
      />
      <span className="flex size-14 items-center justify-center rounded-full bg-brand-tint">
        {isDragActive ? <FolderUp className="size-7 text-brand" aria-hidden /> : <CloudUpload className="size-7 text-brand" aria-hidden />}
      </span>
      <p className="text-base font-medium leading-6 text-gray-800">
        {isDragActive ? (
          'Drop to start sorting'
        ) : (
          <>
            Drag &amp; drop files or a folder here, or{' '}
            <button type="button" onClick={browse} disabled={disabled} className="font-semibold text-brand hover:underline">
              browse
            </button>
          </>
        )}
      </p>
      <p className="text-sm leading-5 text-gray-500">
        PDF, JPG, PNG or HEIC · max {MAX_MB} MB per file · up to {MAX_FILES_PER_UPLOAD} files per batch
      </p>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={browse}
          disabled={disabled}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium leading-5 text-white hover:bg-brand-hover disabled:opacity-50"
        >
          <Upload className="size-4" aria-hidden /> Browse files
        </button>
      </div>
      {fileRejections.length > 0 ? (
        <p className="text-xs text-danger">
          {fileRejections.length} file{fileRejections.length === 1 ? '' : 's'} skipped: unsupported type or over {MAX_MB} MB.
        </p>
      ) : null}
    </div>
  );
}
