// WebSocket management is handled in server.js (inlined for standalone build compatibility).
// This file is kept as a reference for the WebSocket protocol and types.

export type SocketRole = "agent" | "browser";

export interface WSRegistration {
  turkId: string;
  role: SocketRole;
}
