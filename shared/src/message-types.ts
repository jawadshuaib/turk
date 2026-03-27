// Messages from the browser/user to an agent
export type UserInstruction = {
  type: "user_instruction";
  turkId: string;
  content: string;
};

export type ControlMessage = {
  type: "control";
  turkId: string;
  action: "pause" | "resume" | "stop";
};

export type InboundMessage = UserInstruction | ControlMessage;

// Messages from an agent back to the browser
export type AgentThought = { kind: "thought"; content: string };
export type AgentAction = {
  kind: "action";
  action: string;
  params: Record<string, string>;
};
export type AgentResult = {
  kind: "result";
  success: boolean;
  detail: string;
};
export type AgentScreenshot = { kind: "screenshot"; base64: string };
export type AgentError = { kind: "error"; message: string };
export type AgentStatus = {
  kind: "status";
  status: "running" | "paused" | "waiting" | "completed" | "error";
};
export type AgentBugReport = {
  kind: "bug_report";
  severity: "critical" | "major" | "minor" | "cosmetic";
  title: string;
  description: string;
  steps: string[];
  screenshot?: string;
};

export type AgentUpdateData =
  | AgentThought
  | AgentAction
  | AgentResult
  | AgentScreenshot
  | AgentError
  | AgentStatus
  | AgentBugReport;

export type AgentUpdate = {
  type: "agent_update";
  turkId: string;
  data: AgentUpdateData;
};

export type WSMessage = InboundMessage | AgentUpdate;
