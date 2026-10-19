"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useFeatureFlag } from "@/components/feature-flags";
import { useProfileSummary } from "@/features/account/use-profile-summary";
import type { NotificationReadInput } from "@/lib/validators/notification";
import {
  fetchNotificationFeed,
  fetchNotificationPoll,
  postNotificationsRead,
} from "./api";
import type { NotificationFeedPage, NotificationPoll } from "./types";

/**
 * Query key-д `userId` — logout / хэрэглэгч солигдоход өмнөхийн feed,
 * cursor харагдахгүй.
 */
export const notificationKeys = {
  all: (userId: string | null) => ["notifications", userId] as const,
  poll: (userId: string | null) => ["notifications", userId, "poll"] as const,
  feed: (userId: string | null) => ["notifications", userId, "feed"] as const,
};

/** Poll-ын кэш — `seq` нь toast hook шинэ хариуг таних тоолуур. */
export interface PollState extends NotificationPoll {
  seq: number;
}

/**
 * Хонх харагдах хэрэглэгч: туг нээлттэй + нэвтэрсэн. Зочинд null (plan #3).
 */
export function useNotificationUserId(): string | null {
  const flagOn = useFeatureFlag("notifications");
  const { profile } = useProfileSummary();
  return flagOn && profile ? profile.id : null;
}

/**
 * Уншаагүйн тоо + шинэ мөр — 60с тутам ба tab руу буцахад. Global config
 * `refetchOnWindowFocus: false` тул энд тодорхой асаана. Cursor нь кэш дотор
 * (өмнөх хариуны `nextCursor`) — хэд хэдэн хонх нэг query-г хуваалцана.
 */
export function useNotificationPoll() {
  const userId = useNotificationUserId();
  const qc = useQueryClient();
  return useQuery<PollState>({
    queryKey: notificationKeys.poll(userId),
    queryFn: async () => {
      const prev = qc.getQueryData<PollState>(notificationKeys.poll(userId));
      const res = await fetchNotificationPoll(prev?.nextCursor || undefined);
      if (res.freshCount > 0) {
        void qc.invalidateQueries({ queryKey: notificationKeys.feed(userId) });
      }
      return { ...res, seq: (prev?.seq ?? 0) + 1 };
    },
    enabled: !!userId,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    gcTime: Infinity,
    // Toast hook `seq`-ээр хариу бүрийг ялгана — ижил агуулгатай ч шинэ объект.
    structuralSharing: false,
  });
}

export function useNotificationFeed({
  enabled = true,
}: { enabled?: boolean } = {}) {
  const userId = useNotificationUserId();
  return useInfiniteQuery<
    NotificationFeedPage,
    Error,
    InfiniteData<NotificationFeedPage>,
    ReturnType<typeof notificationKeys.feed>,
    string | undefined
  >({
    queryKey: notificationKeys.feed(userId),
    queryFn: ({ pageParam }) => fetchNotificationFeed(pageParam),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: enabled && !!userId,
    staleTime: 30_000,
  });
}

/** Уншсан болгох — optimistic (feed + badge), алдаа гарвал буцаана. */
export function useMarkNotificationsRead() {
  const userId = useNotificationUserId();
  const qc = useQueryClient();
  const feedKey = notificationKeys.feed(userId);
  const pollKey = notificationKeys.poll(userId);

  return useMutation({
    mutationFn: postNotificationsRead,
    onMutate: async (input: NotificationReadInput) => {
      await qc.cancelQueries({ queryKey: feedKey });
      const prevFeed =
        qc.getQueryData<InfiniteData<NotificationFeedPage>>(feedKey);
      const prevPoll = qc.getQueryData<PollState>(pollKey);
      const ids = "ids" in input ? new Set(input.ids) : null;
      const hits = (id: string) => ids === null || ids.has(id);

      let marked = 0;
      if (prevFeed) {
        qc.setQueryData<InfiniteData<NotificationFeedPage>>(feedKey, {
          ...prevFeed,
          pages: prevFeed.pages.map((p) => ({
            ...p,
            items: p.items.map((n) => {
              if (n.read || !hits(n.id)) return n;
              marked += 1;
              return { ...n, read: true };
            }),
          })),
        });
      } else if (ids) {
        // Feed ачаалагдаагүй (toast-оос дарсан) — тэр мөрүүд уншаагүй байсан.
        marked = ids.size;
      }
      if (prevPoll) {
        qc.setQueryData<PollState>(pollKey, {
          ...prevPoll,
          unread: ids === null ? 0 : Math.max(0, prevPoll.unread - marked),
        });
      }
      return { prevFeed, prevPoll };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prevFeed) qc.setQueryData(feedKey, ctx.prevFeed);
      if (ctx?.prevPoll) qc.setQueryData(pollKey, ctx.prevPoll);
    },
  });
}
