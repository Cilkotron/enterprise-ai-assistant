import type { Role, AgentId } from "./types.js";

export interface Capability {
  id: CapabilityId;
  description: string;
  allowedRoles: Role[];
  allowedAgents: AgentId[];
}

export const CAPABILITY_IDS = [
  "getServiceStatus",
  "searchHrPolicy",
  "getEquipmentProfile",
  "resetPassword",
  "loadSkill",
  "delegateToIt",
  "delegateToHr",
] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export const CAPABILITIES: Record<CapabilityId, Capability> = {
  getServiceStatus: {
    id: "getServiceStatus",
    description: "Check the status of internal IT services",
    allowedRoles: ["employee", "it_admin"],
    allowedAgents: ["it"],
  },
  searchHrPolicy: {
    id: "searchHrPolicy",
    description: "Search through HR policy documentation",
    allowedRoles: ["employee", "it_admin"],
    allowedAgents: ["hr"],
  },
  getEquipmentProfile: {
    id: "getEquipmentProfile",
    description: "Retrieve equipment assignment details for an employee",
    allowedRoles: ["employee", "it_admin"],
    allowedAgents: ["hr"],
  },
  resetPassword: {
    id: "resetPassword",
    description: "Reset a user's password (IT admin only)",
    allowedRoles: ["it_admin"],
    allowedAgents: ["it"],
  },
  loadSkill: {
    id: "loadSkill",
    description: "Load a skill definition into the agent runtime",
    allowedRoles: ["employee", "it_admin"],
    allowedAgents: ["it"],
  },
  delegateToIt: {
    id: "delegateToIt",
    description: "Delegate a task to the IT specialist agent",
    allowedRoles: ["employee", "it_admin"],
    allowedAgents: ["orchestrator"],
  },
  delegateToHr: {
    id: "delegateToHr",
    description: "Delegate a task to the HR specialist agent",
    allowedRoles: ["employee", "it_admin"],
    allowedAgents: ["orchestrator"],
  },
};
