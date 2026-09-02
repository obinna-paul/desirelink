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
      <div className="rounded-2xl border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm md:rounded-xl md:bg-transparent md:p-10 md:shadow-none">
        You haven&apos;t submitted any reports.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {reports.map((report) => (
        <li key={report.id} className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:rounded-lg md:shadow-none">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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
              Reported user: {report.reportedUser.displayName} ({report.reportedUser.username})
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
