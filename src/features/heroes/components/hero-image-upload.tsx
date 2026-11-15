"use client";

import * as React from "react";
import { ImagePlus } from "lucide-react";
import { Field } from "@/components/ui/field";
import { LoadingButton } from "@/components/shared/loading-button";
import { adminFetch } from "@/features/admin/lib/mutate";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { prepareHeroUpload } from "../prepare-upload";
import type { HeroDesktopImage, HeroMobileImage } from "../types";

/**
 * Баннерын зураг оруулах (компьютер 2.8:1 / утас 4:3) — `/api/admin/heroes/upload`.
 * «Нүүрний баннер» хуудас ба арга хэмжээний студи хоёулаа хэрэглэнэ.
 */
export interface UploadResult {
  desktop?: HeroDesktopImage;
  mobile?: HeroMobileImage;
  suggestDark: boolean;
}

export function ImageUpload({
  kind,
  label,
  groupId,
  preview,
  error,
  onUploaded,
}: {
  kind: "desktop" | "mobile";
  label: string;
  groupId: string;
  preview: string | null;
  error?: string;
  onUploaded: (r: UploadResult) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setBusy(true);
    try {
      const prepared = await prepareHeroUpload(file, kind);
      if (!prepared.ok) {
        toast.error(prepared.message, "Зураг тохирохгүй");
        return;
      }
      const form = new FormData();
      form.set("file", prepared.file);
      form.set("kind", kind);
      form.set("groupId", groupId);
      const res = await adminFetch<UploadResult>("/api/admin/heroes/upload", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        toast.error(res.error, "Зураг оруулж чадсангүй");
        return;
      }
      onUploaded(res.data);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Field label={label} error={error}>
      <div className="space-y-2">
        <div
          className={cn(
            "bg-muted overflow-hidden rounded-md",
            kind === "desktop" ? "aspect-14/5" : "aspect-4/3",
          )}
        >
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- storage URL, админы thumbnail
            <img src={preview} alt="" className="size-full object-cover" />
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <LoadingButton
          type="button"
          variant="outline"
          size="sm"
          loading={busy}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="size-4" />
          {preview ? "Солих" : "Зураг оруулах"}
        </LoadingButton>
      </div>
    </Field>
  );
}
