import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileInfo } from "../types";
import { FieldEditor } from "./field-editors";

const mutate = vi.fn();
vi.mock("../use-profile-info", () => ({
  useUpdateProfileInfo: () => ({ mutate, isPending: false }),
  useRefreshProfileInfo: () => vi.fn(),
}));
// Өөрийн урсгалтай (verify.mn, addresses) — энд хэрэггүй.
vi.mock("@/features/account/components/phone-verify", () => ({
  PhoneVerify: () => null,
}));
vi.mock("@/features/account/components/address-book", () => ({
  AddressBook: () => null,
}));

const info: ProfileInfo = {
  avatarUrl: null,
  fullName: "Болд",
  phone: "",
  phoneVerified: false,
  email: null,
  gender: null,
  birthday: null,
  job: "",
  scentPreferences: [],
  favoritePerfumes: [],
  address: { count: 0, summary: null },
  reward: { points: 500, claimedPoints: null },
};

function openJob(job = "") {
  render(
    <FieldEditor
      field="job"
      info={{ ...info, job }}
      families={[]}
      onClose={vi.fn()}
    />,
  );
}

const save = () =>
  userEvent.click(screen.getByRole("button", { name: "Хадгалах" }));

beforeEach(() => mutate.mockReset());

describe("JobEditor", () => {
  it("бэлэн сонголтыг нэг товшилтоор сонгож хадгална", async () => {
    openJob();
    expect(screen.getByRole("button", { name: "Хадгалах" })).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: /Багш/ }));
    await save();
    expect(mutate).toHaveBeenCalledWith({ job: "Багш" }, expect.anything());
  });

  it("«Бусад»-аар гараар бичсэнийг trim хийж хадгална", async () => {
    openJob();
    await userEvent.click(screen.getByRole("radio", { name: /Бусад/ }));
    await userEvent.type(
      screen.getByLabelText("Таны ажил мэргэжил"),
      "  Тогооч ",
    );
    await save();
    expect(mutate).toHaveBeenCalledWith({ job: "Тогооч" }, expect.anything());
  });

  it("жагсаалтад байгаа утгаар тэр карт сонгогдож нээгдэнэ", () => {
    openJob("Эмч");
    expect(screen.getByRole("radio", { name: /Эмч/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.queryByLabelText("Таны ажил мэргэжил")).toBeNull();
  });

  it("жагсаалтад байхгүй утгаар «Бусад» бичсэнтэйгээ нээгдэнэ", () => {
    // «Программист» жагсаалтаас хасагдсан ч хадгалсан утга алдагдахгүй.
    openJob("Программист");
    expect(screen.getByRole("radio", { name: /Бусад/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("Таны ажил мэргэжил")).toHaveValue(
      "Программист",
    );
  });

  it("«Бусад» хоосон бол хадгалуулахгүй", async () => {
    openJob();
    await userEvent.click(screen.getByRole("radio", { name: /Бусад/ }));
    await userEvent.type(screen.getByLabelText("Таны ажил мэргэжил"), "   ");
    expect(screen.getByRole("button", { name: "Хадгалах" })).toBeDisabled();
    expect(mutate).not.toHaveBeenCalled();
  });
});

describe("BirthdayEditor", () => {
  it("сонгосон өдрийг насны хамт харуулж хадгална", async () => {
    render(
      <FieldEditor
        field="birthday"
        info={{ ...info, birthday: "1995-03-14" }}
        families={[]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/1995 оны 3-р сарын 14/)).toBeInTheDocument();
    expect(screen.getByText(/нас/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "1995-03-20" }));
    await save();
    expect(mutate).toHaveBeenCalledWith(
      { birthday: "1995-03-20" },
      expect.anything(),
    );
  });
});
