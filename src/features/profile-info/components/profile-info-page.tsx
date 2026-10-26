"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Cake,
  Camera,
  Check,
  Gift,
  Heart,
  Mail,
  MapPin,
  ChevronRight,
  Phone,
  Plus,
  Sparkles,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PROFILE_GENDER_LABEL } from "@/lib/constants";
import type { ScentFamilyOption } from "@/lib/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  ageOn,
  formatBirthday,
  isFieldFilled,
  nextMissingField,
  profileCompletion,
  type ProfileInfoField,
} from "../lib";
import type { ProfileInfo } from "../types";
import { useClaimProfileReward, useProfileInfo } from "../use-profile-info";
import { FIELD_TITLE, FieldEditor } from "./field-editors";

const FIELD_ICON: Record<ProfileInfoField, LucideIcon> = {
  avatar: Camera,
  fullName: UserRound,
  phone: Phone,
  email: Mail,
  gender: Users,
  birthday: Cake,
  job: Briefcase,
  address: MapPin,
  scentPreferences: Sparkles,
  favoritePerfumes: Heart,
};

/** Бөглөх дараалал: эхлээд холбоо барих, дараа нь өөрийн тухай, сонголт. */
const GROUPS: { title: string; fields: ProfileInfoField[] }[] = [
  {
    title: "Үндсэн мэдээлэл",
    fields: ["avatar", "fullName", "phone", "email"],
  },
  { title: "Таны тухай", fields: ["gender", "birthday", "job"] },
  { title: "Хүргэлт", fields: ["address"] },
  {
    title: "Үнэрийн сонголт",
    fields: ["scentPreferences", "favoritePerfumes"],
  },
];

function fieldValue(
  info: ProfileInfo,
  field: ProfileInfoField,
  familyLabels: Map<string, string>,
): string | null {
  switch (field) {
    case "avatar":
      return info.avatarUrl ? "Оруулсан" : null;
    case "fullName":
      return info.fullName.trim() || null;
    case "phone":
      if (!info.phone) return null;
      return info.phoneVerified ? info.phone : `${info.phone} · баталгаажаагүй`;
    case "email":
      return info.email;
    case "gender":
      return info.gender ? PROFILE_GENDER_LABEL[info.gender] : null;
    case "birthday":
      return info.birthday
        ? `${formatBirthday(info.birthday)} · ${ageOn(info.birthday, new Date().toISOString().slice(0, 10))} нас`
        : null;
    case "job":
      return info.job.trim() || null;
    case "address":
      if (!info.address.summary) return null;
      return info.address.count > 1
        ? `${info.address.summary} · +${info.address.count - 1}`
        : info.address.summary;
    case "scentPreferences":
      return info.scentPreferences.length
        ? info.scentPreferences.map((s) => familyLabels.get(s) ?? s).join(", ")
        : null;
    case "favoritePerfumes":
      return info.favoritePerfumes.length
        ? info.favoritePerfumes.join(" · ")
        : null;
  }
}

export function ProfileInfoPage({
  families,
}: {
  families: ScentFamilyOption[];
}) {
  const { data, isPending, isError } = useProfileInfo();
  const [editing, setEditing] = React.useState<ProfileInfoField | null>(null);
  const familyLabels = React.useMemo(
    () => new Map(families.map((f) => [f.slug, f.label])),
    [families],
  );

  return (
    <div className="space-y-8">
      {/* Mobile: the site header shows back + "Миний мэдээлэл" instead. */}
      <header className="hidden space-y-1 md:block">
        <Link
          href="/account"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" /> Профайл
        </Link>
        <h1 className="font-serif text-2xl font-semibold sm:text-3xl">
          Миний мэдээлэл
        </h1>
      </header>

      {isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-36 rounded-3xl" />
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : isError || !data ? (
        <EmptyState
          title="Мэдээлэл ачаалагдсангүй"
          description="Хуудсаа сэргээгээд дахин оролдоно уу."
        />
      ) : (
        <>
          <ProgressCard info={data} onContinue={setEditing} />
          {GROUPS.map((group) => (
            <section key={group.title} className="space-y-2">
              <GroupHeading
                title={group.title}
                fields={group.fields}
                info={data}
              />
              <ul className="bg-card divide-border divide-y overflow-hidden rounded-2xl">
                {group.fields.map((field) => (
                  <InfoRow
                    key={field}
                    field={field}
                    info={data}
                    value={fieldValue(data, field, familyLabels)}
                    onEdit={() => setEditing(field)}
                  />
                ))}
              </ul>
            </section>
          ))}
          <FieldEditor
            field={editing}
            info={data}
            families={families}
            onClose={() => setEditing(null)}
          />
        </>
      )}
    </div>
  );
}

/* ── Явц + урамшуулал ─────────────────────────────────────────────── */

function ProgressCard({
  info,
  onContinue,
}: {
  info: ProfileInfo;
  onContinue: (field: ProfileInfoField) => void;
}) {
  const next = nextMissingField(info);
  const { done, total, ratio, complete } = profileCompletion(info);
  const claim = useClaimProfileReward();
  const { points, claimedPoints } = info.reward;
  const claimable = complete && points > 0 && claimedPoints === null;

  // Бүрэн болмогц автоматаар олгоно — товч дарахыг мартсан хүн алдахгүй.
  // Алдаа гарвал доорх товчоор дахин оролдоно.
  const attempted = React.useRef(false);
  const { mutate } = claim;
  React.useEffect(() => {
    if (!claimable || attempted.current) return;
    attempted.current = true;
    mutate(undefined, {
      onSuccess: (granted) => {
        if (granted > 0) toast.success(`+${granted} V point олгогдлоо!`);
      },
    });
  }, [claimable, mutate]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="bg-card space-y-4 rounded-3xl p-5 sm:p-6"
    >
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
            Мэдээллийн бүрдэл
          </p>
          <p className="font-serif text-3xl font-semibold tabular-nums">
            {done}
            <span className="text-muted-foreground text-xl">/{total}</span>
          </p>
        </div>
        <p className="text-muted-foreground pb-1 text-sm tabular-nums">
          {Math.round(ratio * 100)}%
        </p>
      </div>

      <div
        role="progressbar"
        aria-label="Мэдээллийн бүрдэл"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="bg-secondary h-2.5 overflow-hidden rounded-full"
      >
        <motion.div
          className="bg-foreground h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(ratio * 100, 2)}%` }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        />
      </div>

      {claimedPoints !== null ? (
        <RewardLine icon={Check} tone="success">
          Мэдээллээ бүрэн оруулсны{" "}
          <strong className="tabular-nums">{claimedPoints} V point</strong>{" "}
          авсан. Баярлалаа!
        </RewardLine>
      ) : claimable ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <RewardLine icon={Gift} tone="gold">
            Бүх мэдээлэл бүрэн боллоо!
          </RewardLine>
          <Button
            size="sm"
            disabled={claim.isPending}
            onClick={() =>
              mutate(undefined, {
                onSuccess: (granted) => {
                  if (granted > 0)
                    toast.success(`+${granted} V point олгогдлоо!`);
                },
                onError: () =>
                  toast.error("Олгож чадсангүй. Дахин оролдоно уу."),
              })
            }
          >
            {points} V point авах
          </Button>
        </div>
      ) : points > 0 ? (
        <RewardLine icon={Gift} tone="gold">
          Бүх мэдээллээ оруулаад{" "}
          <strong className="tabular-nums">{points} V point</strong> аваарай.
          {total - done > 0 && (
            <span className="text-muted-foreground">
              {" "}
              {total - done} үлдлээ.
            </span>
          )}
        </RewardLine>
      ) : (
        <p className="text-muted-foreground text-sm">
          Мэдээллээ бүрэн оруулбал танд илүү тохирох үнэртэн санал болгоно.
        </p>
      )}

      {/* Жагсаалтаас хайлгүйгээр дараагийн дутуу талбар руу шууд. */}
      {next && (
        <Button
          variant="secondary"
          className="w-full justify-between"
          onClick={() => onContinue(next)}
        >
          <span>
            <span className="text-muted-foreground">Дараагийнх: </span>
            {FIELD_TITLE[next]}
          </span>
          <ArrowRight className="size-4" />
        </Button>
      )}
    </motion.section>
  );
}

function RewardLine({
  icon: Icon,
  tone,
  children,
}: {
  icon: LucideIcon;
  tone: "gold" | "success";
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-start gap-2.5 text-sm">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          tone === "gold"
            ? "bg-primary/10 text-gold-strong"
            : "bg-success/10 text-success",
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <span className="pt-0.5">{children}</span>
    </p>
  );
}

/* ── Бүлгийн гарчиг ───────────────────────────────────────────────── */

function GroupHeading({
  title,
  fields,
  info,
}: {
  title: string;
  fields: ProfileInfoField[];
  info: ProfileInfo;
}) {
  const done = fields.filter((f) => isFieldFilled(info, f)).length;
  const complete = done === fields.length;
  return (
    <div className="flex items-center justify-between px-1">
      <h2 className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
        {title}
      </h2>
      <span
        className={cn(
          "flex items-center gap-1 text-xs tabular-nums",
          complete ? "text-success" : "text-muted-foreground",
        )}
      >
        {complete && <Check className="size-3.5" strokeWidth={3} />}
        {done}/{fields.length}
      </span>
    </div>
  );
}

/* ── Мөр ──────────────────────────────────────────────────────────── */

function InfoRow({
  field,
  info,
  value,
  onEdit,
}: {
  field: ProfileInfoField;
  info: ProfileInfo;
  value: string | null;
  onEdit: () => void;
}) {
  const Icon = FIELD_ICON[field];
  const filled = isFieldFilled(info, field);
  const label = FIELD_TITLE[field];
  // Утсаа оруулсан ч баталгаажуулаагүй бол дутуу хэвээр — үйлдлийг нь нэрлэнэ.
  const action = field === "phone" && info.phone ? "Баталгаажуулах" : "Нэмэх";

  return (
    <li>
      {/* Мөр бүтнээрээ товч — жижиг харандаа руу онилох шаардлагагүй. */}
      <button
        type="button"
        aria-label={`${label} ${filled ? "засах" : action.toLowerCase()}`}
        onClick={onEdit}
        className="hover:bg-accent/60 active:bg-accent flex w-full items-center gap-3 p-4 text-left transition-colors"
      >
        <span className="relative shrink-0">
          {field === "avatar" && info.avatarUrl ? (
            <span className="bg-secondary relative block size-10 overflow-hidden rounded-full">
              <Image
                src={info.avatarUrl}
                alt=""
                fill
                sizes="40px"
                className="object-cover"
              />
            </span>
          ) : (
            <span className="bg-secondary flex size-10 items-center justify-center rounded-full">
              <Icon className="size-4" />
            </span>
          )}
          {filled && (
            <span
              aria-hidden
              className="bg-success text-background ring-card absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full ring-2"
            >
              <Check className="size-2.5" strokeWidth={3.5} />
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="text-muted-foreground block text-xs">{label}</span>
          <span
            className={cn(
              "block truncate text-sm",
              value ? "font-medium" : "text-muted-foreground",
            )}
          >
            {value ?? "Оруулаагүй"}
          </span>
        </span>

        {filled ? (
          <ChevronRight className="text-muted-foreground size-4 shrink-0" />
        ) : (
          <span className="text-gold-strong bg-secondary flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
            <Plus className="size-3.5" />
            {action}
          </span>
        )}
      </button>
    </li>
  );
}
