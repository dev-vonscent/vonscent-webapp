import Image from "next/image";
import type { BlogPost } from "@/features/blog/seed";
import { cn } from "@/lib/utils";

/**
 * Зураггүй нийтлэлийн нүүр. Өмнө нь picsum-ийн санамсаргүй зураг гарч
 * «хаанаас ирсэн зураг вэ» гэсэн төөрөгдөл үүсгэдэг байсан. Одоо бол
 * загварын өөрийн хэлбэр: ангилал + serif гарчгийн эхний үсэг.
 */
function CoverPlaceholder({ post }: { post: BlogPost }) {
  return (
    <div
      aria-hidden
      className="bg-secondary text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2"
    >
      <span className="text-foreground/15 font-serif text-7xl leading-none font-semibold select-none">
        {post.title.trim().charAt(0).toUpperCase() || "V"}
      </span>
      {post.category && (
        <span className="text-[11px] tracking-[0.2em] uppercase">
          {post.category}
        </span>
      )}
    </div>
  );
}

/** Жагсаалт / картын нүүр: зураг, эсвэл placeholder. */
export function BlogCoverThumb({
  post,
  sizes,
  className,
}: {
  post: BlogPost;
  sizes: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-muted relative aspect-16/10 overflow-hidden",
        className,
      )}
    >
      {post.cover ? (
        <Image
          src={post.cover}
          alt={post.title}
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <CoverPlaceholder post={post} />
      )}
    </div>
  );
}

/**
 * Дэлгэрэнгүй хуудасны толгой. Зураггүй бол блок огт гарахгүй — хоосон
 * хүрээ, зохиомол зураг хоёулаа нийтлэлийг «дутуу» харагдуулна.
 */
export function BlogCoverHero({ post }: { post: BlogPost }) {
  if (!post.cover) return null;
  return (
    <div className="border-border bg-muted relative mt-8 aspect-video overflow-hidden rounded-xl border">
      <Image
        src={post.cover}
        alt={post.title}
        fill
        priority
        sizes="(max-width: 768px) 100vw, 768px"
        className="object-cover"
      />
    </div>
  );
}
