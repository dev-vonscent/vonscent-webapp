"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { adminFetch } from "@/features/admin/lib/mutate";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { toast } from "@/lib/toast";
import type { CustomTagOption } from "@/features/taxonomy/api";

/**
 * The «…» menu on a custom-tag chip: rename or delete the tag itself.
 *
 * Both actions reach past the product being edited — the pool is shared, so a
 * rename shows up on every product carrying the tag and a delete strips it
 * from all of them. That is why deleting asks first and says so, and why the
 * rename dialog spells out the same thing: from a product screen it is easy to
 * read these as "remove this tag from this product", which is what the
 * checkbox beside them already does.
 */
export function CustomTagActions({
  tag,
  onRenamed,
  onDeleted,
}: {
  tag: CustomTagOption;
  onRenamed: (tag: CustomTagOption) => void;
  onDeleted: (tag: CustomTagOption) => void;
}) {
  const [confirm, confirmDialog] = useConfirm();
  const [renaming, setRenaming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function remove() {
    if (
      !(await confirm({
        title: `«${tag.name}» тагийг устгах уу?`,
        description:
          "Таг бүх бараанаас хасагдана — зөвхөн энэ бараанаас биш. Хайлт, quiz-д ашиглагдаж байсан бол тэнд ч алга болно.",
        confirmLabel: "Устгах",
        destructive: true,
      }))
    )
      return;

    setBusy(true);
    try {
      const res = await adminFetch(`/api/admin/custom-tags/${tag.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(res.demo ? "Demo горим." : "Таг устсангүй.");
        return;
      }
      onDeleted(tag);
      toast.success("Таг устлаа.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {confirmDialog}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={busy}
            aria-label={`${tag.name} — үйлдэл`}
            className="text-muted-foreground hover:text-foreground -mr-1 shrink-0 rounded p-0.5 transition-colors"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MoreHorizontal className="size-4" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <Pencil className="mr-2 size-4" />
            Засах
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            // The confirm dialog cannot open while the menu is still closing.
            onSelect={(e) => {
              e.preventDefault();
              remove();
            }}
          >
            <Trash2 className="mr-2 size-4" />
            Устгах
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameTagDialog
        tag={tag}
        open={renaming}
        onOpenChange={setRenaming}
        onRenamed={(t) => {
          onRenamed(t);
          setRenaming(false);
        }}
      />
    </>
  );
}

function RenameTagDialog({
  tag,
  open,
  onOpenChange,
  onRenamed,
}: {
  tag: CustomTagOption;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenamed: (tag: CustomTagOption) => void;
}) {
  const [name, setName] = React.useState(tag.name);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName(tag.name);
      setError(null);
    }
  }, [open, tag.name]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    if (trimmed === tag.name) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await adminFetch<{ tag?: CustomTagOption }>(
        `/api/admin/custom-tags/${tag.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        },
      );
      if (!res.ok) {
        setError(
          res.demo
            ? "Demo горим: Supabase холбогдсоны дараа хадгалагдана."
            : res.error.includes("DUPLICATE")
              ? "Энэ нэртэй таг бүртгэлтэй байна."
              : "Хадгалагдсангүй.",
        );
        return;
      }
      if (res.data?.tag) {
        onRenamed(res.data.tag);
        toast.success("Таг шинэчиллээ.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Таг засах</DialogTitle>
        <DialogDescription>
          Нэр нь энэ тагтай бүх бараан дээр шинэчлэгдэнэ.
        </DialogDescription>

        {/* Not a <form>: this renders inside the product form, and a nested
            form would save the product on Enter. */}
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="rename-tag">Нэр</Label>
            <Input
              id="rename-tag"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Болих
            </Button>
            <Button
              type="button"
              disabled={busy || !name.trim()}
              onClick={save}
            >
              {busy ? "Хадгалж байна…" : "Хадгалах"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
