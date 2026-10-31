import type { ModelMessage } from "ai";

export interface SessionState {
  orchestrator: ModelMessage[];
  it: ModelMessage[];
  hr: ModelMessage[];
}

export function createSessionState(): SessionState {
  return { orchestrator: [], it: [], hr: [] };
}

export function trimHistory(messages: ModelMessage[], max = 20): ModelMessage[] {
  if (messages.length <= max) return messages;
  // Drop from the start, keep user/assistant pairs aligned
  const drop = messages.length - max;
  return messages.slice(drop);
}

export interface SessionStore {
  get(key: string): Promise<SessionState | undefined>;
  set(key: string, state: SessionState): Promise<void>;
}

// Not durable; will be replaced with a Durable Object store later.
export class InMemorySessionStore implements SessionStore {
  private store = new Map<string, SessionState>();
  private maxSessions = 200;

  async get(key: string): Promise<SessionState | undefined> {
    return this.store.get(key);
  }

  async set(key: string, state: SessionState): Promise<void> {
    if (this.store.size >= this.maxSessions && !this.store.has(key)) {
      // Drop the oldest entry (insertion order preserved in Map)
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, state);
  }
}
