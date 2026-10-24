import { AddressBook } from "@/features/account/components/address-book";
import { AccountPageHeader } from "@/features/account/components/account-page-header";

export default function AddressesPage() {
  return (
    <div className="space-y-4">
      <AccountPageHeader title="Хаягууд" />
      <AddressBook />
    </div>
  );
}
