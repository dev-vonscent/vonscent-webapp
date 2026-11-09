"use client";

import * as React from "react";
import Image from "next/image";
import {
  Backpack,
  BookOpen,
  Briefcase,
  Calculator,
  Camera,
  Check,
  GraduationCap,
  HardHat,
  Landmark,
  Loader2,
  type LucideIcon,
  Palette,
  PenLine,
  Plus,
  Scale,
  Search,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/shared/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FieldError, fieldErrorClass } from "@/components/ui/form-field";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { PhoneVerify } from "@/features/account/components/phone-verify";
import { AddressBook } from "@/features/account/components/address-book";
import { prepareUpload } from "@/lib/storage/prepare-upload";
import { IMAGE_ACCEPT } from "@/lib/storage/limits";
import { rateLimitMessage } from "@/lib/rate-limit-client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  PROFILE_FAVORITE_PERFUMES_MAX,
  PROFILE_GENDER_LABEL,
  PROFILE_GENDERS,
  PROFILE_JOB_MAX,
  PROFILE_JOB_OPTIONS,
  PROFILE_NAME_MAX,
  PROFILE_PERFUME_NAME_MAX,
  PROFILE_SCENT_PREFS_MAX,
  type ProfileGender,
} from "@/lib/constants";
import type { ScentFamilyOption } from "@/lib/types";
import type { SearchHit, SearchResults } from "@/features/search/types";
import {
  isValidBirthday,
  type ProfileInfoPatch,
} from "@/lib/validators/profile-info";
import { ageOn, formatBirthday, type ProfileInfoField } from "../lib";
import { BirthdayPicker } from "./birthday-picker";
import type { ProfileInfo } from "../types";
import {
  useRefreshProfileInfo,
  useUpdateProfileInfo,
} from "../use-profile-info";

export const FIELD_TITLE: Record<ProfileInfoField, string> = {
  avatar: "Профайл зураг",
  fullName: "Нэр",
  phone: "Утасны дугаар",
  email: "Имэйл",
  gender: "Хүйс",
  birthday: "Төрсөн өдөр",
  job: "Ажил мэргэжил",
  address: "Хүргэлтийн хаяг",
  scentPreferences: "Дуртай үнэрийн төрөл",
  favoritePerfumes: "Дуртай үнэртэн",
};

const FIELD_HINT: Partial<Record<ProfileInfoField, string>> = {
  birthday: "Төрсөн өдрөөр тань бэлэг, урамшуулал илгээнэ.",
  scentPreferences: "Танд тохирох үнэртнийг санал болгоход ашиглана.",
  favoritePerfumes: `Өмнө нь хэрэглэж байсан эсвэл хамгийн их таалагддаг 1–${PROFILE_FAVORITE_PERFUMES_MAX} үнэртэн.`,
};

/**
 * Нэг талбарын засварын цонх. Талбар бүр өөрийн хэлбэртэй ч хадгалах урсгал
 * нь нэг: `PATCH /api/account/profile-info` (утас, имэйл, хаягаас бусад нь).
 */
export function FieldEditor({
  field,
  info,
  families,
  onClose,
}: {
  field: ProfileInfoField | null;
  info: ProfileInfo;
  families: ScentFamilyOption[];
  onClose: () => void;
}) {
  // Хаагдах анимацын үеэр гарчиг хоосрохгүйн тулд сүүлийн талбарыг барина.
  const [shown, setShown] = React.useState<ProfileInfoField | null>(field);
  React.useEffect(() => {
    if (field) setShown(field);
  }, [field]);
  const current = field ?? shown;

  return (
    <ResponsiveDialog
      open={field !== null}
      onOpenChange={(open) => !open && onClose()}
      title={current ? FIELD_TITLE[current] : ""}
      description={current ? FIELD_HINT[current] : undefined}
    >
      {/* `key` — нээх бүрт хадгалагдсан утгаас шинээр эхэлнэ. */}
      {field && (
        <EditorBody
          key={field}
          field={field}
          info={info}
          families={families}
          onClose={onClose}
        />
      )}
    </ResponsiveDialog>
  );
}

function EditorBody({
  field,
  info,
  families,
  onClose,
}: {
  field: ProfileInfoField;
  info: ProfileInfo;
  families: ScentFamilyOption[];
  onClose: () => void;
}) {
  switch (field) {
    case "avatar":
      return <AvatarEditor info={info} onClose={onClose} />;
    case "fullName":
      return (
        <TextEditor
          id="info-name"
          label="Нэр"
          requiredMessage="Нэрээ оруулна уу"
          initial={info.fullName}
          max={PROFILE_NAME_MAX}
          autoComplete="name"
          toPatch={(fullName) => ({ fullName })}
          onClose={onClose}
        />
      );
    case "job":
      return <JobEditor info={info} onClose={onClose} />;
    case "phone":
      return <PhoneEditor info={info} onClose={onClose} />;
    case "email":
      return <EmailEditor info={info} onClose={onClose} />;
    case "gender":
      return <GenderEditor info={info} onClose={onClose} />;
    case "birthday":
      return <BirthdayEditor info={info} onClose={onClose} />;
    case "address":
      return <AddressEditor onClose={onClose} />;
    case "scentPreferences":
      return <ScentEditor info={info} families={families} onClose={onClose} />;
    case "favoritePerfumes":
      return <PerfumesEditor info={info} onClose={onClose} />;
  }
}

/* ── Хадгалах ─────────────────────────────────────────────────────── */

function useSave(onClose: () => void) {
  const update = useUpdateProfileInfo();
  const save = (patch: ProfileInfoPatch) =>
    update.mutate(patch, {
      onSuccess: () => {
        toast.success("Хадгалагдлаа.");
        onClose();
      },
      onError: () => toast.error("Хадгалж чадсангүй. Дахин оролдоно уу."),
    });
  return { save, saving: update.isPending };
}

function Footer({
  saving,
  disabled,
  onClose,
}: {
  saving: boolean;
  disabled?: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex justify-end gap-3 pt-1">
      <Button
        type="button"
        variant="outline"
        disabled={saving}
        onClick={onClose}
      >
        Болих
      </Button>
      <LoadingButton loading={saving} type="submit" disabled={disabled}>
        Хадгалах
      </LoadingButton>
    </div>
  );
}

/* ── Зураг ─────────────────────────────────────────────────────────── */

function AvatarEditor({
  info,
  onClose,
}: {
  info: ProfileInfo;
  onClose: () => void;
}) {
  const { save, saving } = useSave(onClose);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const initial = (info.fullName || "?").charAt(0).toUpperCase();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const prepared = await prepareUpload(file, 512);
    if (!prepared.ok) {
      setError(prepared.message);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", prepared.file);
      fd.append("folder", "avatars");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const limited = await rateLimitMessage(res);
      if (limited) {
        setError(limited);
        return;
      }
      const data = res.ok ? ((await res.json()) as { url?: string }) : null;
      if (!data?.url) {
        setError("Зураг байршуулж чадсангүй. Дахин оролдоно уу.");
        return;
      }
      save({ avatarUrl: data.url });
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || saving;
  return (
    <div className="flex flex-col items-center gap-4 pb-2">
      <div className="bg-secondary relative size-32 overflow-hidden rounded-full">
        {info.avatarUrl ? (
          <Image
            src={info.avatarUrl}
            alt=""
            fill
            sizes="128px"
            className="object-cover"
          />
        ) : (
          <span className="text-muted-foreground flex h-full items-center justify-center font-serif text-5xl">
            {initial}
          </span>
        )}
        {busy && (
          <span className="bg-background/60 absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin" />
          </span>
        )}
      </div>
      <Button asChild variant="outline" disabled={busy}>
        <label className="cursor-pointer">
          <Camera className="size-4" />
          {info.avatarUrl ? "Зураг солих" : "Зураг сонгох"}
          <input
            type="file"
            accept={IMAGE_ACCEPT}
            className="sr-only"
            disabled={busy}
            onChange={onFile}
          />
        </label>
      </Button>
      {error && <p className="text-destructive text-center text-xs">{error}</p>}
    </div>
  );
}

/* ── Нэр, ажил ─────────────────────────────────────────────────────── */

function TextEditor({
  id,
  label,
  requiredMessage,
  placeholder,
  initial,
  max,
  autoComplete,
  toPatch,
  onClose,
}: {
  id: string;
  label: string;
  requiredMessage: string;
  placeholder?: string;
  initial: string;
  max: number;
  autoComplete?: string;
  toPatch: (value: string) => ProfileInfoPatch;
  onClose: () => void;
}) {
  const { save, saving } = useSave(onClose);
  const [value, setValue] = React.useState(initial);
  const [error, setError] = React.useState<string>();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError(requiredMessage);
      return;
    }
    save(toPatch(trimmed));
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          autoFocus
          value={value}
          maxLength={max}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? "true" : undefined}
          className={fieldErrorClass(error)}
          onChange={(e) => {
            setValue(e.target.value);
            setError(undefined);
          }}
        />
        <FieldError message={error} />
      </div>
      <Footer saving={saving} onClose={onClose} />
    </form>
  );
}

/* ── Ажил мэргэжил ─────────────────────────────────────────────────── */

const JOB_ICON: Record<(typeof PROFILE_JOB_OPTIONS)[number], LucideIcon> = {
  Сурагч: Backpack,
  Оюутан: GraduationCap,
  Эмч: Stethoscope,
  Багш: BookOpen,
  Инженер: HardHat,
  Дизайнер: Palette,
  "Бизнес эрхлэгч": Briefcase,
  Менежер: Users,
  "Нягтлан бодогч": Calculator,
  Хуульч: Scale,
  "Төрийн албан хаагч": Landmark,
};

const isJobOption = (v: string): v is (typeof PROFILE_JOB_OPTIONS)[number] =>
  (PROFILE_JOB_OPTIONS as readonly string[]).includes(v);

/**
 * Түгээмэл мэргэжлүүдээс нэг товшилтоор, жагсаалтад байхгүй бол «Бусад»
 * дээр дарж гараар бичнэ. Хадгалагдсан утга жагсаалтад байхгүй бол
 * «Бусад» нь бичсэн утгатайгаа нээгдэнэ.
 */
function JobEditor({
  info,
  onClose,
}: {
  info: ProfileInfo;
  onClose: () => void;
}) {
  const { save, saving } = useSave(onClose);
  const initial = info.job.trim();
  const [preset, setPreset] = React.useState<string | null>(
    isJobOption(initial) ? initial : null,
  );
  const [other, setOther] = React.useState(!!initial && !isJobOption(initial));
  const [custom, setCustom] = React.useState(
    isJobOption(initial) ? "" : initial,
  );
  const [error, setError] = React.useState<string>();

  const value = other ? custom.trim() : (preset ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) {
      setError("Ажил мэргэжлээ оруулна уу");
      return;
    }
    save({ job: value });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div
        role="radiogroup"
        aria-label="Ажил мэргэжил"
        className="grid grid-cols-3 gap-2.5 pt-1.5 sm:grid-cols-4"
      >
        {PROFILE_JOB_OPTIONS.map((job) => {
          const Icon = JOB_ICON[job];
          return (
            <OptionChip
              key={job}
              role="radio"
              selected={!other && preset === job}
              className="min-h-20 flex-col gap-1.5 px-2 text-center text-xs/tight"
              onClick={() => {
                setPreset(job);
                setOther(false);
                setError(undefined);
              }}
            >
              <Icon
                className="text-muted-foreground size-5"
                strokeWidth={1.5}
              />
              {job}
            </OptionChip>
          );
        })}
        <OptionChip
          role="radio"
          selected={other}
          className="min-h-20 flex-col gap-1.5 px-2 text-center text-xs/tight"
          onClick={() => {
            setOther(true);
            setError(undefined);
          }}
        >
          <PenLine className="text-muted-foreground size-5" strokeWidth={1.5} />
          Бусад
        </OptionChip>
      </div>

      {other && (
        <div className="space-y-1.5">
          <Label htmlFor="info-job">Таны ажил мэргэжил</Label>
          <Input
            id="info-job"
            autoFocus
            value={custom}
            maxLength={PROFILE_JOB_MAX}
            placeholder="Жишээ: Гэрэл зурагчин, Тогооч"
            autoComplete="organization-title"
            aria-invalid={error ? "true" : undefined}
            className={fieldErrorClass(error)}
            onChange={(e) => {
              setCustom(e.target.value);
              setError(undefined);
            }}
          />
        </div>
      )}
      <FieldError message={error} />
      <Footer saving={saving} disabled={!value} onClose={onClose} />
    </form>
  );
}

/* ── Утас ──────────────────────────────────────────────────────────── */

function PhoneEditor({
  info,
  onClose,
}: {
  info: ProfileInfo;
  onClose: () => void;
}) {
  const refresh = useRefreshProfileInfo();
  const [phone, setPhone] = React.useState(info.phone);
  const verified = info.phoneVerified && phone === info.phone;

  return (
    <div className="space-y-4 pb-2">
      <div className="space-y-1.5">
        <Label htmlFor="info-phone">Утасны дугаар</Label>
        <div className="flex items-center gap-2">
          <Input
            id="info-phone"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={8}
            value={phone}
            placeholder="8 оронтой дугаар"
            onChange={(e) => setPhone(e.target.value.replace(/\D/gu, ""))}
          />
          {verified && <Badge variant="new">Баталгаажсан</Badge>}
        </div>
        <p className="text-muted-foreground text-xs">
          {verified
            ? "Дугаараа солих бол шинэ дугаараа оруулаад СМС-ээр баталгаажуулна."
            : "Дугаараа СМС-ээр баталгаажуулснаар бүрэн тооцогдоно."}
        </p>
      </div>
      {!verified && /^\d{8}$/u.test(phone) && (
        <PhoneVerify
          phone={phone}
          verified={false}
          onVerified={() => {
            void refresh();
            toast.success("Утас баталгаажлаа.");
            onClose();
          }}
        />
      )}
    </div>
  );
}

/* ── Имэйл ─────────────────────────────────────────────────────────── */

function EmailEditor({
  info,
  onClose,
}: {
  info: ProfileInfo;
  onClose: () => void;
}) {
  const refresh = useRefreshProfileInfo();
  const [email, setEmail] = React.useState(info.email ?? "");
  const [error, setError] = React.useState<string>();
  const [saving, setSaving] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) {
      setError("Имэйл хаягаа зөв оруулна уу");
      return;
    }
    setSaving(true);
    try {
      // Имэйл бүртгэлийн нэг эх сурвалж — профайлын «Имэйл мэдэгдэл»-тэй ижил.
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      if (res.status === 409) {
        setError("Энэ хаяг өөр бүртгэлд холбогдсон байна.");
        return;
      }
      if (!res.ok) {
        toast.error("Хадгалж чадсангүй. Дахин оролдоно уу.");
        return;
      }
      await refresh();
      toast.success("Хадгалагдлаа.");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="info-email">Имэйл</Label>
        <Input
          id="info-email"
          type="email"
          autoFocus
          autoComplete="email"
          value={email}
          placeholder="name@example.com"
          aria-invalid={error ? "true" : undefined}
          className={fieldErrorClass(error)}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(undefined);
          }}
        />
        <FieldError message={error} />
        <p className="text-muted-foreground text-xs">
          Захиалгын мэдэгдэл, урамшууллын мэдээ энэ хаяг руу очно.
        </p>
      </div>
      <Footer saving={saving} onClose={onClose} />
    </form>
  );
}

/* ── Хүйс ──────────────────────────────────────────────────────────── */

function GenderEditor({
  info,
  onClose,
}: {
  info: ProfileInfo;
  onClose: () => void;
}) {
  const { save, saving } = useSave(onClose);
  const [gender, setGender] = React.useState<ProfileGender | null>(info.gender);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (gender) save({ gender });
      }}
      className="space-y-5"
    >
      <div
        role="radiogroup"
        aria-label="Хүйс"
        className="grid grid-cols-3 gap-2"
      >
        {PROFILE_GENDERS.map((g) => (
          <OptionChip
            key={g}
            role="radio"
            selected={gender === g}
            onClick={() => setGender(g)}
          >
            {PROFILE_GENDER_LABEL[g]}
          </OptionChip>
        ))}
      </div>
      <Footer saving={saving} disabled={!gender} onClose={onClose} />
    </form>
  );
}

/* ── Төрсөн өдөр ───────────────────────────────────────────────────── */

function BirthdayEditor({
  info,
  onClose,
}: {
  info: ProfileInfo;
  onClose: () => void;
}) {
  const { save, saving } = useSave(onClose);
  const [value, setValue] = React.useState(info.birthday ?? "");
  const [error, setError] = React.useState<string>();
  const today = new Date().toISOString().slice(0, 10);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidBirthday(value)) {
      setError("Төрсөн өдрөө зөв оруулна уу");
      return;
    }
    save({ birthday: value });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="space-y-2">
        <p
          aria-live="polite"
          className={cn(
            "font-serif text-2xl tabular-nums",
            !value && "text-muted-foreground",
          )}
        >
          {value ? formatBirthday(value) : "Өдрөө сонгоно уу"}
          {value && (
            <span className="text-muted-foreground font-sans text-sm">
              {" "}
              · {ageOn(value, today)} нас
            </span>
          )}
        </p>
        <BirthdayPicker
          value={value}
          max={today}
          invalid={!!error}
          onChange={(next) => {
            setValue(next);
            setError(undefined);
          }}
        />
        <FieldError message={error} />
      </div>
      <Footer saving={saving} disabled={!value} onClose={onClose} />
    </form>
  );
}

/* ── Хаяг ──────────────────────────────────────────────────────────── */

function AddressEditor({ onClose }: { onClose: () => void }) {
  const refresh = useRefreshProfileInfo();
  return (
    <div className="space-y-4">
      <AddressBook onChange={() => void refresh()} />
      <div className="flex justify-end">
        <Button type="button" onClick={onClose}>
          Болсон
        </Button>
      </div>
    </div>
  );
}

/* ── Дуртай үнэрийн төрөл ──────────────────────────────────────────── */

function ScentEditor({
  info,
  families,
  onClose,
}: {
  info: ProfileInfo;
  families: ScentFamilyOption[];
  onClose: () => void;
}) {
  const { save, saving } = useSave(onClose);
  const [picked, setPicked] = React.useState<string[]>(info.scentPreferences);

  function toggle(slug: string) {
    setPicked((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length >= PROFILE_SCENT_PREFS_MAX
          ? prev
          : [...prev, slug],
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (picked.length > 0) save({ scentPreferences: picked });
      }}
      className="space-y-5"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {families.map((f) => (
          <OptionChip
            key={f.slug}
            role="checkbox"
            selected={picked.includes(f.slug)}
            onClick={() => toggle(f.slug)}
            className="justify-start"
          >
            {f.iconUrl && (
              <Image
                src={f.iconUrl}
                alt=""
                width={24}
                height={24}
                className="size-6 shrink-0 object-contain"
              />
            )}
            <span className="truncate">{f.label}</span>
          </OptionChip>
        ))}
      </div>
      <p className="text-muted-foreground flex justify-between text-xs">
        <span>Хэд хэдийг сонгож болно.</span>
        <span className="tabular-nums">
          {picked.length}/{PROFILE_SCENT_PREFS_MAX}
        </span>
      </p>
      <Footer
        saving={saving}
        disabled={picked.length === 0}
        onClose={onClose}
      />
    </form>
  );
}

/* ── Дуртай үнэртэн (1–3) ──────────────────────────────────────────── */

function perfumeName(hit: SearchHit): string {
  const name = hit.subtitle ? `${hit.subtitle} ${hit.title}` : hit.title;
  return name.slice(0, PROFILE_PERFUME_NAME_MAX);
}

function PerfumesEditor({
  info,
  onClose,
}: {
  info: ProfileInfo;
  onClose: () => void;
}) {
  const { save, saving } = useSave(onClose);
  const [picked, setPicked] = React.useState<string[]>(info.favoritePerfumes);
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const full = picked.length >= PROFILE_FAVORITE_PERFUMES_MAX;

  // Каталогоос санал болгоно; олдохгүй бол бичсэн нэрээ шууд нэмж болно.
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q.slice(0, 100))}&limit=5`,
        );
        const data = res.ok
          ? ((await res.json()) as { results?: SearchResults })
          : null;
        if (!cancelled) setHits(data?.results?.product ?? []);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  function add(name: string) {
    const trimmed = name.trim().slice(0, PROFILE_PERFUME_NAME_MAX);
    if (!trimmed || full) return;
    setPicked((prev) =>
      prev.some((p) => p.toLowerCase() === trimmed.toLowerCase())
        ? prev
        : [...prev, trimmed],
    );
    setQuery("");
    setHits([]);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (picked.length > 0) save({ favoritePerfumes: picked });
      }}
      className="space-y-5"
    >
      <ol className="space-y-2">
        {Array.from({ length: PROFILE_FAVORITE_PERFUMES_MAX }, (_, i) => {
          const name = picked[i];
          return (
            <li
              key={i}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-xl px-3",
                name ? "bg-secondary" : "border-border border border-dashed",
              )}
            >
              <span className="text-muted-foreground w-4 text-center font-serif text-sm tabular-nums">
                {i + 1}
              </span>
              {name ? (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`${name}-г хасах`}
                    onClick={() =>
                      setPicked((prev) => prev.filter((p) => p !== name))
                    }
                  >
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <span className="text-muted-foreground text-sm">
                  {i === 0 ? "Заавал нэгийг" : "Сонголттой"}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {!full && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              aria-label="Үнэртэн хайх"
              value={query}
              maxLength={PROFILE_PERFUME_NAME_MAX}
              placeholder="Брэнд эсвэл үнэртний нэр"
              className="pl-9"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add(query);
                }
              }}
            />
            {searching && (
              <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
            )}
          </div>
          {query.trim().length >= 2 && (
            <ul className="border-border divide-border divide-y overflow-hidden rounded-xl border">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => add(perfumeName(hit))}
                    className="hover:bg-accent flex w-full items-center gap-3 p-2.5 text-left transition-colors"
                  >
                    <span className="bg-secondary relative size-10 shrink-0 overflow-hidden rounded-lg">
                      {hit.imageUrl && (
                        <Image
                          src={hit.imageUrl}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {hit.title}
                      </span>
                      {hit.subtitle && (
                        <span className="text-muted-foreground block truncate text-xs">
                          {hit.subtitle}
                        </span>
                      )}
                    </span>
                    <Plus className="text-muted-foreground size-4 shrink-0" />
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => add(query)}
                  className="hover:bg-accent text-muted-foreground flex w-full items-center gap-3 p-2.5 text-left text-sm transition-colors"
                >
                  <span className="bg-secondary flex size-10 shrink-0 items-center justify-center rounded-lg">
                    <Plus className="size-4" />
                  </span>
                  <span className="min-w-0 truncate">
                    «<span className="text-foreground">{query.trim()}</span>»
                    гэж нэмэх
                  </span>
                </button>
              </li>
            </ul>
          )}
        </div>
      )}

      <Footer
        saving={saving}
        disabled={picked.length === 0}
        onClose={onClose}
      />
    </form>
  );
}

/* ── Сонголтын товч ────────────────────────────────────────────────── */

function OptionChip({
  role,
  selected,
  onClick,
  className,
  children,
}: {
  role: "radio" | "checkbox";
  selected: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "relative flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors",
        selected
          ? "border-foreground bg-secondary"
          : "border-border hover:bg-accent",
        className,
      )}
    >
      {children}
      {selected && (
        <span className="bg-foreground text-background absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
