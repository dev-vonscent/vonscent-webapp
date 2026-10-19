"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useFeatureFlag } from "@/components/feature-flags";
import {
  PROFILE_SUMMARY_KEY,
  useProfileSummary,
} from "@/features/account/use-profile-summary";
import {
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_POLL_INTERVAL_MS,
  NOTIFICATION_STALE_MS,
} from "@/lib/constants";
import type { NotificationReadInput } from "@/lib/validators/notification";
import {
  fetchNotificationFeed,
  fetchNotificationPoll,
  NotificationPollError,
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
  /** Бүх feed (panel + бүтэн хуудас) — invalidate / optimistic-д. */
  feeds: (userId: string | null) => ["notifications", userId, "feed"] as const,
  /** `limit` тус бүр тусдаа кэш — хуудаслалтын cursor нь хуудасны хэмжээнээс хамаарна. */
  feed: (userId: string | null, limit: number) =>
    ["notifications", userId, "feed", limit] as const,
};

/**
 * Poll-ын кэш — `seq` нь toast hook шинэ хариуг таних тоолуур; `epoch` нь
 * кэш шинээр эхлэх бүрт (гарч орох, хэрэглэгч солих) өөрчлөгдөнө.
 */
export interface PollState extends NotificationPoll {
  epoch: number;
  seq: number;
}

let pollEpoch = 0;

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
      let res: Awaited<ReturnType<typeof fetchNotificationPoll>>;
      try {
        res = await fetchNotificationPoll(prev?.nextCursor || undefined);
      } catch (err) {
        // Session server талд дууссан — profile-ийг шинэчилбэл null болж
        // хонх алга болно (кэш нь NotificationCenter-т устна).
        if (err instanceof NotificationPollError && err.status === 401) {
          void qc.invalidateQueries({ queryKey: PROFILE_SUMMARY_KEY });
        }
        throw err;
      }
      // Poll-ын цонх давхцдаг — өмнөх хариунд байгаагүй мөр ирсэн үед л feed-ийг
      // шинэчилнэ (анхны poll-д feed өөрөө татагдана). `fresh` шинэ нь эхэнд тул
      // 20-оос олон зэрэг ирсэн ч шинэ id `fresh`-д орно.
      if (prev) {
        const seen = new Set(prev.fresh.map((n) => n.id));
        if (res.fresh.some((n) => !seen.has(n.id))) {
          void qc.invalidateQueries({
            queryKey: notificationKeys.feeds(userId),
          });
        }
      }
      return {
        ...res,
        epoch: prev ? prev.epoch : ++pollEpoch,
        seq: (prev?.seq ?? 0) + 1,
      };
    },
    enabled: !!userId,
    // 401/404 (session дууссан / туг хаагдсан) — дахин оролдохгүй, poll зогсоно.
    retry: (count, err) =>
      !(err instanceof NotificationPollError && err.final) && count < 3,
    refetchInterval: (query) => {
      const err = query.state.error;
      return err instanceof NotificationPollError && err.final
        ? false
        : NOTIFICATION_POLL_INTERVAL_MS;
    },
    refetchOnWindowFocus: true,
    staleTime: NOTIFICATION_STALE_MS,
    gcTime: Infinity,
    // Toast hook `seq`-ээр хариу бүрийг ялгана — ижил агуулгатай ч шинэ объект.
    structuralSharing: false,
  });
}

export function useNotificationFeed({
  enabled = true,
  limit = NOTIFICATION_PAGE_SIZE,
}: { enabled?: boolean; limit?: number } = {}) {
  const userId = useNotificationUserId();
  return useInfiniteQuery<
    NotificationFeedPage,
    Error,
    InfiniteData<NotificationFeedPage>,
    ReturnType<typeof notificationKeys.feed>,
    string | undefined
  >({
    queryKey: notificationKeys.feed(userId, limit),
    queryFn: ({ pageParam }) => fetchNotificationFeed(pageParam, limit),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: enabled && !!userId,
    staleTime: NOTIFICATION_STALE_MS,
  });
}

/** Уншсан болгох — optimistic (бүх feed кэш + badge), алдаа гарвал буцаана. */
export function useMarkNotificationsRead() {
  const userId = useNotificationUserId();
  const qc = useQueryClient();
  const feedsKey = notificationKeys.feeds(userId);
  const pollKey = notificationKeys.poll(userId);

  return useMutation({
    mutationFn: postNotificationsRead,
    onMutate: async (input: NotificationReadInput) => {
      // Poll-ыг ч цуцална — mutation-аас өмнө эхэлсэн poll хуучин `unread`-тэй
      // буцаж ирээд optimistic badge-ийг дарахгүйн тулд.
      await Promise.all([
        qc.cancelQueries({ queryKey: feedsKey }),
        qc.cancelQueries({ queryKey: pollKey }),
      ]);
      const prevFeeds = qc.getQueriesData<InfiniteData<NotificationFeedPage>>({
        queryKey: feedsKey,
      });
      const prevPoll = qc.getQueryData<PollState>(pollKey);
      const ids = "ids" in input ? new Set(input.ids) : null;
      const hits = (id: string) => ids === null || ids.has(id);

      // Нэг мэдэгдэл panel ба бүтэн хуудасны кэшид хоёуланд байж болно —
      // badge-ийг давхар хасахгүйн тулд id-аар тоолно.
      const marked = new Set<string>();
      const inFeed = new Set<string>();
      for (const [key, data] of prevFeeds) {
        if (!data) continue;
        qc.setQueryData<InfiniteData<NotificationFeedPage>>(key, {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            items: p.items.map((n) => {
              if (!hits(n.id)) return n;
              inFeed.add(n.id);
              if (n.read) return n;
              marked.add(n.id);
              return { ...n, read: true };
            }),
          })),
        });
      }

      if (prevPoll) {
        // Feed-д олдоогүй (toast-оос дарсан) мөрийг poll-ын `fresh`-ээс шалгана —
        // аль хэдийн уншсан мөрийн хуучин toast badge-ийг дахин хасахгүй.
        for (const n of prevPoll.fresh) {
          if (hits(n.id) && !n.read && !inFeed.has(n.id)) marked.add(n.id);
        }
        qc.setQueryData<PollState>(pollKey, {
          ...prevPoll,
          fresh: prevPoll.fresh.map((n) =>
            hits(n.id) ? { ...n, read: true } : n,
          ),
          unread: ids === null ? 0 : Math.max(0, prevPoll.unread - marked.size),
        });
      }
      return { prevFeeds, prevPoll };
    },
    onError: (_err, _input, ctx) => {
      for (const [key, data] of ctx?.prevFeeds ?? [])
        qc.setQueryData(key, data);
      if (ctx?.prevPoll) qc.setQueryData(pollKey, ctx.prevPoll);
    },
    // Цуцалсан poll-ыг нөхөж, серверийн жинхэнэ тоог авна.
    onSettled: () => qc.invalidateQueries({ queryKey: pollKey }),
  });
}
