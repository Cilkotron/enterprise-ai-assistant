import type { UserContext, Role, AgentId } from "./types.js";
import { CAPABILITIES } from "./capabilities.js";

export interface PermissionDecisionEvent {
  type: "permission_decision";
  agent: AgentId;
  userId: string;
  role: Role;
  capability: string;
  allowed: boolean;
  reason: string;
}

export interface TraceSink {
  record(event: PermissionDecisionEvent): void;
}

export interface PermissionResult {
  allowed: boolean;
  reason: string;
}

export function checkPermission(
  user: UserContext,
  agent: AgentId,
  capabilityId: string,
  trace?: TraceSink,
): PermissionResult {
  const capability = Object.hasOwn(CAPABILITIES, capabilityId)
    ? CAPABILITIES[capabilityId as keyof typeof CAPABILITIES]
    : null;

  if (!capability) {
    const result: PermissionResult = {
      allowed: false,
      reason: "unknown capability",
    };
    trace?.record({
      type: "permission_decision",
      agent,
      userId: user.userId,
      role: user.role,
      capability: capabilityId,
      allowed: false,
      reason: result.reason,
    });
    return result;
  }

  if (!capability.allowedRoles.includes(user.role)) {
    const result: PermissionResult = {
      allowed: false,
      reason: `role ${user.role} is not permitted`,
    };
    trace?.record({
      type: "permission_decision",
      agent,
      userId: user.userId,
      role: user.role,
      capability: capabilityId,
      allowed: false,
      reason: result.reason,
    });
    return result;
  }

  if (!capability.allowedAgents.includes(agent)) {
    const result: PermissionResult = {
      allowed: false,
      reason: `agent ${agent} is not permitted`,
    };
    trace?.record({
      type: "permission_decision",
      agent,
      userId: user.userId,
      role: user.role,
      capability: capabilityId,
      allowed: false,
      reason: result.reason,
    });
    return result;
  }

  const result: PermissionResult = {
    allowed: true,
    reason: "permitted",
  };
  trace?.record({
    type: "permission_decision",
    agent,
    userId: user.userId,
    role: user.role,
    capability: capabilityId,
    allowed: true,
    reason: result.reason,
  });
  return result;
}

export function getAllowedCapabilities(
  user: UserContext,
  agent: AgentId,
): string[] {
  return Object.values(CAPABILITIES)
    .filter(
      (cap) =>
        cap.allowedRoles.includes(user.role) && cap.allowedAgents.includes(agent),
    )
    .map((cap) => cap.id);
}
