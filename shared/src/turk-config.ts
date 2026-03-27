export type TurkType = "testing-agent";

export interface TurkConfig {
  id: string;
  name: string;
  type: TurkType;
  targetUrl: string;
  instructions: string;
  ollamaModel: string;
  credentials: CredentialGroup[];
}

export interface CredentialGroup {
  id: string;
  name: string; // e.g., "Client 1 Login"
  fields: CredentialField[];
}

export interface CredentialField {
  key: string; // e.g., "username"
  value: string;
  isSecret: boolean;
}

export const TURK_TYPES: Record<TurkType, { label: string; description: string }> = {
  "testing-agent": {
    label: "Testing Agent",
    description:
      "Autonomous QA tester that navigates websites, tests flows, and reports bugs like a human tester would.",
  },
};
