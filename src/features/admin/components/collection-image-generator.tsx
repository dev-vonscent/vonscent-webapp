"use client";

import * as React from "react";
import Image from "next/image";
import { Check, Loader2, Sparkles } from "lucide-react";
import { adminFetch } from "@/features/admin/lib/mutate";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type JobStatus = "pending" | "generating" | "done" | "failed";

interface Job {
  id: string;
  status: JobStatus;
  result_url: string | null;
  error: string | null;
  created_at: string;
}

const POLL_MS = 4000;

const isBusy = (s: JobStatus) => s === "pending" || s === "generating";

/**
 * Багцын poster-ийг AI-аар үүсгэх хэсэг (зөвхөн засах горимд — ажил нь
 * хадгалагдсан багц дээр ажилладаг).
 *
 * Барааны зургийн студитэй ижил урсгал: товч дарахад сервер дараалалд
 * оруулж, энд 4 секунд тутам шалгана. Prompt, лавлахыг сервер өөрөө
 * бүрдүүлдэг — гишүүн дөрвөн барааны үндсэн зураг + хадгалсан нэр, тайлбар.
 * Багц зураггүй бол эхний үр дүн сервер дээр шууд багцын зураг болно.
 * Бусад үед «Ашиглах» дарвал формын зураг солигдоно; хадгалах хүртэл
 * дэлгүүрт харагдахгүй.
 */
export function CollectionImageGenerator({
  collectionId,
  value,
  onUse,
}: {
  collectionId: string;
  /** Формын одоогийн зураг — аль үр дүн сонгогдсоныг тэмдэглэнэ. */
  value: string;
  onUse: (url: string) => void;
}) {
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [starting, setStarting] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  // Сүүлийн утгуудыг ref-ээр — `load` нь polling-ийн interval дотор амьдардаг.
  const latest = React.useRef({ value, onUse });
  React.useEffect(() => {
    latest.current = { value, onUse };
  });

  const load = React.useCallback(async () => {
    const r = await adminFetch<{ jobs?: Job[]; imageUrl?: string | null }>(
      `/api/admin/collections/${collectionId}/generate-image`,
    );
    if (!r.ok) return;
    setJobs(r.data?.jobs ?? []);
    // Зураггүй багцад үр дүн сервер дээр шууд хадгалагдсан — формд ч
    // тусгана, эс бөгөөс «Хадгалах» нь хоосон зургаар дарж бичнэ.
    const saved = r.data?.imageUrl;
    if (saved && !latest.current.value) latest.current.onUse(saved);
  }, [collectionId]);

  // Эхний уншилт шууд — өмнө үүсгэсэн зургууд хуудас нээгдэхэд харагдана.
  React.useEffect(() => {
    void load();
  }, [load]);

  const polling = jobs.some((j) => isBusy(j.status));
  React.useEffect(() => {
    if (!polling) return;
    const iv = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(iv);
  }, [polling, load]);

  async function generate() {
    setStarting(true);
    setNote(null);
    const res = await adminFetch<{ missing?: string[] }>(
      `/api/admin/collections/${collectionId}/generate-image`,
      { method: "POST" },
    );
    setStarting(false);
    if (res.ok) {
      await load();
      return;
    }
    if (res.demo) {
      setNote("Demo горим: зураг үүсгэх боломжгүй.");
    } else if (res.error.includes("NO_REFERENCE")) {
      const missing = res.data?.missing ?? [];
      setNote(
        missing.length
          ? `Зураггүй үнэртэн: ${missing.join(", ")}. Эхлээд барааных нь зургийг оруулна уу.`
          : "Багцад зурагтай үнэртэн алга.",
      );
    } else if (res.error.includes("UNAVAILABLE")) {
      setNote("AI зураг үүсгэх тохиргоо хийгдээгүй байна (OPENAI_API_KEY).");
    } else {
      setNote(res.error);
    }
  }

  const visible = jobs.filter((j) => j.status !== "done" || j.result_url);

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-medium">AI poster</h3>
          <p className="text-muted-foreground text-xs">
            Дөрвөн үнэртний үндсэн зургийг лавлах болгож, хадгалсан нэр,
            тайлбараас дүр зургийг үүсгэнэ. Нэг зураг 2 минут орчим. Багц
            зураггүй бол үр дүн нь шууд багцын зураг болж хадгалагдана.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={starting}
          onClick={() => void generate()}
        >
          {starting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          Зураг үүсгэх
        </Button>
      </div>

      {note && (
        <p role="alert" className="text-destructive text-sm">
          {note}
        </p>
      )}

      {visible.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {visible.map((job) => {
            const selected =
              Boolean(job.result_url) && job.result_url === value;
            return (
              <li key={job.id} className="space-y-1.5">
                <div
                  className={cn(
                    "bg-muted/40 relative aspect-square overflow-hidden rounded-lg border",
                    selected && "ring-primary ring-2",
                  )}
                >
                  {job.status === "done" && job.result_url ? (
                    <Image
                      src={job.result_url}
                      alt=""
                      fill
                      unoptimized
                      sizes="200px"
                      className="object-cover"
                    />
                  ) : isBusy(job.status) ? (
                    <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-2 text-xs">
                      <Loader2 className="size-5 animate-spin" />
                      {job.status === "pending"
                        ? "Дараалалд…"
                        : "Үүсгэж байна…"}
                    </div>
                  ) : (
                    <p
                      className="text-destructive flex size-full items-center justify-center p-2 text-center text-xs"
                      title={job.error ?? undefined}
                    >
                      Амжилтгүй
                      {job.error ? `: ${job.error.slice(0, 80)}` : ""}
                    </p>
                  )}
                </div>
                {job.status === "done" && job.result_url && (
                  <Button
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    className="w-full"
                    disabled={selected}
                    onClick={() => onUse(job.result_url!)}
                  >
                    {selected ? (
                      <>
                        <Check className="size-4" /> Сонгогдсон
                      </>
                    ) : (
                      "Ашиглах"
                    )}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
