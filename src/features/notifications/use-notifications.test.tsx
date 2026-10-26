import * as React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  type InfiniteData,
} from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppNotification, NotificationFeedPage } from "./types";

const postNotificationsRead = vi.fn();

vi.mock("@/components/feature-flags", () => ({ useFeatureFlag: () => true }));
vi.mock("@/features/account/use-profile-summary", () => ({
  PROFILE_SUMMARY_KEY: ["profile-summary"],
  useProfileSummary: () => ({ profile: { id: USER } }),
}));
vi.mock("./api", async (orig) => ({
  ...(await orig<typeof import("./api")>()),
  postNotificationsRead: (...a: unknown[]) => postNotificationsRead(...a),
}));

const { notificationKeys, useMarkNotificationsRead } =
  await import("./use-notifications");
type PollState = import("./use-notifications").PollState;

/**
 * Optimistic уншсан болгох: badge нь id тус бүрийг НЭГ л удаа хасна (panel ба
 * бүтэн хуудас хоёуланд байсан ч), уншсан мөрийг дахин хасахгүй, алдаа гарвал
 * бүгд буцна.
 */

const USER = "user-1";
const PANEL = notificationKeys.feed(USER, 10);
const PAGE = notificationKeys.feed(USER, 20);
const POLL = notificationKeys.poll(USER);

function n(id: string, read = false): AppNotification {
  return {
    id,
    kind: "promotion",
    title: id,
    body: null,
    url: null,
    imageUrl: null,
    read,
    visibleAt: "2026-10-19T04:00:00.000Z",
  };
}

const feed = (
  items: AppNotification[],
): InfiniteData<NotificationFeedPage> => ({
  pages: [{ items, nextCursor: null }],
  pageParams: [undefined],
});

function seed(client: QueryClient, unread: number, fresh: AppNotification[]) {
  // a, b — уншаагүй, хоёр кэшид хоёуланд; c — аль хэдийн уншсан.
  client.setQueryData(PANEL, feed([n("a"), n("b"), n("c", true)]));
  client.setQueryData(PAGE, feed([n("a"), n("b"), n("c", true)]));
  client.setQueryData<PollState>(POLL, {
    unread,
    freshCount: fresh.length,
    fresh,
    nextCursor: "cur",
    epoch: 1,
    seq: 1,
  });
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useMarkNotificationsRead(), { wrapper });
  return { client, result };
}

const items = (client: QueryClient, key: readonly unknown[]) =>
  client
    .getQueryData<InfiniteData<NotificationFeedPage>>(key)!
    .pages.flatMap((p) => p.items);
const readIds = (client: QueryClient, key: readonly unknown[]) =>
  items(client, key)
    .filter((x) => x.read)
    .map((x) => x.id);
const poll = (client: QueryClient) => client.getQueryData<PollState>(POLL)!;

beforeEach(() => {
  postNotificationsRead.mockReset();
  postNotificationsRead.mockResolvedValue(undefined);
});

describe("useMarkNotificationsRead", () => {
  it("marks a row in every feed cache but lowers the badge once", async () => {
    const { client, result } = setup();
    seed(client, 5, []);

    await act(() => result.current.mutateAsync({ ids: [n("a").id] }));

    expect(readIds(client, PANEL)).toEqual(["a", "c"]);
    expect(readIds(client, PAGE)).toEqual(["a", "c"]);
    expect(poll(client).unread).toBe(4);
  });

  it("does not lower the badge for an already read row", async () => {
    const { client, result } = setup();
    seed(client, 5, []);

    await act(() => result.current.mutateAsync({ ids: ["c"] }));

    expect(poll(client).unread).toBe(5);
  });

  it("counts a toast-only row (not in any feed) from the poll's fresh list", async () => {
    const { client, result } = setup();
    seed(client, 5, [n("t")]);

    await act(() => result.current.mutateAsync({ ids: ["t"] }));

    expect(poll(client).fresh[0].read).toBe(true);
    expect(poll(client).unread).toBe(4);
  });

  it("does not count a toast-only row that was already read", async () => {
    const { client, result } = setup();
    seed(client, 5, [n("t", true)]);

    await act(() => result.current.mutateAsync({ ids: ["t"] }));

    expect(poll(client).unread).toBe(5);
  });

  it("never drops the badge below zero", async () => {
    const { client, result } = setup();
    seed(client, 1, [n("t")]);

    await act(() => result.current.mutateAsync({ ids: ["a", "b", "t"] }));

    expect(poll(client).unread).toBe(0);
  });

  it("marks everything on all: true", async () => {
    const { client, result } = setup();
    seed(client, 7, [n("t")]);

    await act(() => result.current.mutateAsync({ all: true }));

    expect(readIds(client, PANEL)).toEqual(["a", "b", "c"]);
    expect(readIds(client, PAGE)).toEqual(["a", "b", "c"]);
    expect(poll(client).fresh.every((x) => x.read)).toBe(true);
    expect(poll(client).unread).toBe(0);
  });

  it("rolls every cache back when the request fails", async () => {
    const { client, result } = setup();
    seed(client, 5, [n("t")]);
    postNotificationsRead.mockRejectedValue(
      new Error("notifications_read_failed"),
    );

    act(() => result.current.mutate({ all: true }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(readIds(client, PANEL)).toEqual(["c"]);
    expect(readIds(client, PAGE)).toEqual(["c"]);
    expect(poll(client).unread).toBe(5);
    expect(poll(client).fresh[0].read).toBe(false);
  });
});
