// Backward-compatible endpoint for any delayed scheduler request from an older
// deployment. It escalates held payments for review and never releases funds.
export { GET, POST } from "@/app/api/cron/escalate-service-escrow/route";
