import type { UserContext } from "./types.js";

export const USERS = {
  ana: { userId: "ana", name: "Ana Petrovic", role: "employee" },
  marko: { userId: "marko", name: "Marko Jovanovic", role: "it_admin" },
} as const satisfies Record<string, UserContext>;

export type UserId = keyof typeof USERS;