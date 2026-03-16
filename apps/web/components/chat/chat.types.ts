export interface ChatReplyTarget {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
}

export interface ChatEditTarget {
  id: string;
  text: string;
}
