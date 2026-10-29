process.env.ERP_TEST = "1";
process.env.BILLING_TEST = "1";
await import("./integration.mjs");
