import { getAllFaqs, getAllBlogPosts } from "@/features/admin/api";
import {
  getPopupSettings,
  getSocialSettings,
  getAboutSettings,
} from "@/features/content/api";
import { ContentManager } from "@/features/admin/components/content-manager";

export default async function AdminContentPage() {
  const [popup, social, faqs, posts, about] = await Promise.all([
    getPopupSettings(),
    getSocialSettings(),
    getAllFaqs(),
    getAllBlogPosts(),
    getAboutSettings(),
  ]);

  return (
    <ContentManager
      popup={popup}
      social={social}
      faqs={faqs}
      posts={posts}
      about={about}
    />
  );
}
