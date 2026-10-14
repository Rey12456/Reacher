export type School = { name: string; degree?: string; years?: string };
export type Employer = { name: string; title?: string; years?: string };

export type Profile = {
  user_id: string;
  consented_at: string | null;
  name: string | null;
  schools: School[];
  employers: Employer[];
  city: string | null;
  summary: string | null;
};

export type FactType = "school" | "employer" | "city";
export type Fact = { type: FactType; value: string };

export type Ask = "chat" | "advice" | "referral";
export type Label = "peer" | "manager" | "recruiter";
export type Status = "not_sent" | "sent" | "accepted" | "replied" | "no_response";

export const STATUSES: { value: Status; label: string }[] = [
  { value: "not_sent", label: "Not sent" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "replied", label: "Replied" },
  { value: "no_response", label: "No response" },
];

// A search result row joined with its contact, as the results table renders it.
export type ResultRow = {
  id: string;
  rank: number;
  label: Label;
  reason: string;
  verified: Fact[];
  possible: Fact[];
  ask_used: Ask;
  note_text: string | null;
  message_text: string | null;
  contact: {
    id: string;
    linkedin_url: string;
    name: string;
    title: string | null;
    location: string | null;
    status: Status;
    sent_at: string | null;
  };
};

export const NOTE_LIMIT = 200;
