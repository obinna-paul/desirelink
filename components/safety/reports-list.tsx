import { Badge } from "@/components/ui/badge";
import type { MyReportData } from "@/lib/report";

const STATUS_VARIANT = {
  pending: "outline",
  reviewed: "secondary",
  resolved: "neon",
} as const;

export function ReportsList({ reports }: { reports: MyReportData[] }) {
  if (reports.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
        You haven&apos;t submitted any reports.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {reports.map((report) => (
        <li key={report.id} className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="capitalize">
                {report.targetType}
              </Badge>
              <span className="text-sm font-medium">{report.reason}</span>
            </div>
            <Badge variant={STATUS_VARIANT[report.status]} className="capitalize">
              {report.status.replace("_", " ")}
            </Badge>
          </div>
          {report.reportedUser && (
            <p className="text-xs text-muted-foreground">
              Reported user: {report.reportedUser.displayName} (@{report.reportedUser.username})
            </p>
          )}
          {report.details && <p className="text-xs text-muted-foreground">{report.details}</p>}
          <p className="text-[10px] text-muted-foreground">
            Submitted {new Date(report.createdAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
