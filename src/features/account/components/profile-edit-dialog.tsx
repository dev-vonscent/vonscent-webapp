"use client";

import * as React from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FieldError, fieldErrorClass } from "@/components/ui/form-field";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { PhoneVerify } from "@/features/account/components/phone-verify";
import { prepareUpload } from "@/lib/storage/prepare-upload";
import { IMAGE_ACCEPT } from "@/lib/storage/limits";
import { createClient } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";

interface Errors {
  name?: string;
  phone?: string;
}

/** Профайл засах dialog (мобайлд bottom sheet) — нэр, аватар, утас. */
export function ProfileEditDialog({
  open,
  onOpenChange,
  userId,
  configured,
  email,
  fullName,
  phone,
  phoneVerified,
  avatar,
  onSaved,
  onAvatarChange,
  onPhoneVerified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  configured: boolean;
  email: string;
  fullName: string;
  phone: string;
  phoneVerified: boolean;
  avatar: string | null;
  onSaved: (next: { fullName: string; phone: string }) => void;
  onAvatarChange: (url: string) => void;
  onPhoneVerified: () => void;
}) {
  const [name, setName] = React.useState(fullName);
  const [phoneValue, setPhoneValue] = React.useState(phone);
  const [errors, setErrors] = React.useState<Errors>({});
  const [avatarError, setAvatarError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const nameRef = React.useRef<HTMLInputElement>(null);
  const phoneRef = React.useRef<HTMLInputElement>(null);

  // Нээх бүрт хадгалагдсан утгаас эхэлнэ.
  React.useEffect(() => {
    if (open) {
      setName(fullName);
      setPhoneValue(phone);
      setErrors({});
      setAvatarError(null);
    }
  }, [open, fullName, phone]);

  function clearError(key: keyof Errors) {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!name.trim()) next.name = "Нэрээ оруулна уу";
    if (!phoneVerified && phoneValue && !/^\d{8}$/u.test(phoneValue)) {
      next.phone = "8 оронтой дугаар оруулна уу";
    }
    setErrors(next);
    if (next.name) {
      nameRef.current?.focus();
      return;
    }
    if (next.phone) {
      phoneRef.current?.focus();
      return;
    }

    const supabase = createClient();
    if (!supabase || !userId) return;
    setSaving(true);
    // Баталгаажсан дугаарыг эндээс өөрчлөхгүй — verify.mn урсгалаар л солино.
    const update = phoneVerified
      ? { full_name: name.trim() }
      : { full_name: name.trim(), phone: phoneValue };
    const { error } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error("Хадгалж чадсангүй. Дахин оролдоно уу.");
      return;
    }
    onSaved({ fullName: name.trim(), phone: phoneValue });
    toast.success("Мэдээлэл хадгалагдлаа.");
    onOpenChange(false);
  }

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const prepared = await prepareUpload(file, 512);
    if (!prepared.ok) {
      setAvatarError(prepared.message);
      return;
    }
    setAvatarError(null);
    const fd = new FormData();
    fd.append("file", prepared.file);
    fd.append("folder", "avatars");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) return;
    const { url } = await res.json();
    if (!url) return;
    const supabase = createClient();
    if (supabase && userId) {
      await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", userId);
    }
    onAvatarChange(url);
  }

  const initial = (name || email || "?").charAt(0).toUpperCase();

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Профайл засах"
    >
      <form onSubmit={save} noValidate className="space-y-5">
        {/* Avatar — camera badge дарж шинэ зураг сонгоно */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            <div className="bg-secondary relative size-24 overflow-hidden rounded-full">
              {avatar ? (
                <Image
                  src={avatar}
                  alt="avatar"
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              ) : (
                <div className="text-muted-foreground flex h-full items-center justify-center font-serif text-3xl">
                  {initial}
                </div>
              )}
            </div>
            <label className="bg-foreground text-background hover:bg-foreground/85 absolute -right-1 -bottom-1 flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors">
              <Camera className="size-4" />
              <span className="sr-only">Зураг солих</span>
              <input
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                disabled={!configured}
                onChange={onAvatar}
              />
            </label>
          </div>
          {avatarError && (
            <p className="text-destructive text-center text-xs">
              {avatarError}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-name">Нэр</Label>
          <Input
            id="profile-name"
            ref={nameRef}
            value={name}
            aria-invalid={errors.name ? "true" : undefined}
            className={fieldErrorClass(errors.name)}
            onChange={(e) => {
              setName(e.target.value);
              clearError("name");
            }}
          />
          <FieldError message={errors.name} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-phone">Утас</Label>
          <div className="flex items-center gap-2">
            <Input
              id="profile-phone"
              ref={phoneRef}
              value={phoneValue}
              inputMode="numeric"
              readOnly={phoneVerified}
              aria-invalid={errors.phone ? "true" : undefined}
              className={fieldErrorClass(errors.phone)}
              onChange={(e) => {
                setPhoneValue(e.target.value);
                clearError("phone");
              }}
            />
            {phoneVerified && <Badge variant="new">Баталгаажсан</Badge>}
          </div>
          <FieldError message={errors.phone} />
          <PhoneVerify
            phone={phoneValue}
            verified={phoneVerified}
            onVerified={onPhoneVerified}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-email">Имэйл</Label>
          <Input
            id="profile-email"
            value={email}
            disabled
            className="disabled:opacity-60"
            placeholder="Бүртгээгүй"
          />
          <p className="text-muted-foreground text-xs">
            Имэйлээ профайл хуудасны «Имэйл мэдэгдэл» хэсгээс бүртгэж, солино.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Болих
          </Button>
          <Button type="submit" disabled={saving || !configured}>
            {saving ? "Хадгалж байна…" : "Хадгалах"}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
