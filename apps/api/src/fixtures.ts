export const SERVICES = {
  vpn: {
    status: "degraded",
    note: "Elevated latency on Belgrade gateway",
    since: "2026-10-29T08:15:00Z",
  },
  email: { status: "operational" },
  wifi: { status: "operational" },
  hr_portal: { status: "operational" },
} as const;

export const ACCOUNTS = ["ana.petrovic", "marko.jovanovic", "ivan.ilic"] as const;
