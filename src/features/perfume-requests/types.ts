/** `POST /api/perfume-requests` */
export interface SubmitPerfumeRequestResponse {
  ok: true;
  /** Энэ хэрэглэгч өмнө нь ижил үнэртэнд санал өгсөн байсан. */
  alreadyRequested: boolean;
}

/** Админы жагсаалтын нэг мөр. */
export interface AdminPerfumeRequest {
  id: string;
  brand: string;
  name: string;
  concentration: string | null;
  voteCount: number;
  lastVotedAt: string;
  createdAt: string;
}

/** Админы дэлгэрэнгүй — санал өгсөн хүмүүс. */
export interface AdminPerfumeRequestVoter {
  userId: string;
  name: string | null;
  phone: string | null;
  note: string | null;
  votedAt: string;
}
