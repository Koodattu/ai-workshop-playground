"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLanguage } from "@/contexts/LanguageContext";

export function ImageAttachments({ images, disabled, onRemove }: { images: string[]; disabled: boolean; onRemove: (index: number) => void }) {
  const { t } = useLanguage();
  const [preview, setPreview] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (preview) dialog?.showModal();
    return () => { dialog?.close(); };
  }, [preview]);

  return <>
    <div className="flex flex-wrap gap-2 px-3 pt-3 pb-1" role="group" aria-label={t("chat.attachedImages", { count: images.length })}>
      {images.map((image, index) => <div key={index} className="relative size-12 shrink-0">
        <button type="button" onClick={() => setPreview(image)} aria-label={t("chat.previewImage", { number: index + 1 })}
          className="relative block size-full overflow-hidden rounded-lg border border-steel bg-void transition-colors hover:border-electric focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric">
          <Image src={image} alt="" fill sizes="48px" unoptimized className="object-cover" />
        </button>
        <button type="button" onClick={() => onRemove(index)} disabled={disabled} aria-label={t("chat.removeImage", { number: index + 1 })}
          className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full border border-steel bg-obsidian text-gray-300 hover:bg-steel hover:text-white focus-visible:outline-2 focus-visible:outline-electric disabled:opacity-40">
          <svg aria-hidden="true" className="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 4 8 8M12 4l-8 8" /></svg>
        </button>
      </div>)}
    </div>
    <dialog ref={dialogRef} onClose={() => setPreview(null)} onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}
      aria-label={t("chat.imagePreview")} className="fixed m-auto max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-steel bg-obsidian p-2 shadow-2xl backdrop:bg-black/80">
      {preview && <Image src={preview} alt={t("chat.imagePreview")} width={1280} height={960} unoptimized className="max-h-[85dvh] w-auto max-w-full object-contain" />}
      <button type="button" autoFocus onClick={() => dialogRef.current?.close()} aria-label={t("chat.closeImagePreview")}
        className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-full bg-obsidian/90 text-white hover:bg-steel focus-visible:outline-2 focus-visible:outline-electric">
        <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </dialog>
  </>;
}
