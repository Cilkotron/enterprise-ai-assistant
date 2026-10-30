import { z } from "zod";
import type { ToolDef } from "./types.js";
import { SERVICES } from "../fixtures.js";

export const getServiceStatusTool: ToolDef<{ service: "vpn" | "email" | "wifi" | "hr_portal" }> = {
  name: "getServiceStatus",
  capability: "getServiceStatus",
  description: "Returns the current status of an internal IT service (vpn, email, wifi, hr_portal).",
  inputSchema: z.object({
    service: z.enum(["vpn", "email", "wifi", "hr_portal"]),
  }),
  async execute({ service }) {
    const data = SERVICES[service];
    return { service, ...data };
  },
};
