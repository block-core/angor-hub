export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface ExternalIdentity {
  platform: string;
  username: string;
  proofUrl?: string;
}
