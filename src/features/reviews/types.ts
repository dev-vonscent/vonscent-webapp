/**
 * Review shapes shared by the server data layer (`api.ts`, which is
 * `server-only`) and the client list/form components. Kept in their own module
 * so a client component can import the type without pulling `server-only` in.
 */

export interface Review {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorAvatar: string | null;
}

export interface RecentReview extends Review {
  productName: string;
  productSlug: string;
  brand: string;
  productImage: string | null;
}

export interface ReviewPage {
  reviews: Review[];
  /** Every review on the product, text or rating-only — matches `rating_count`. */
  total: number;
}
