import { useEffect, useMemo, useState } from "react";
import { Bug, ChevronLeft, ChevronRight, ListFilter, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../../shared/components/ui/button";
import { fetchBugReports, updateBugReportStatus } from "../../../shared/lib/api";

type BugStatus = "active" | "fixed";
type BugReport = {
  id: number;
  title: string;
  description: string;
  picture_url: string | null;
  status: BugStatus;
  created_at: string;
  reporter_name: string;
};
type BugReportResponse = {
  total_count: number;
  fixed_count: number;
  active_count: number;
  reports: BugReport[];
};
type ReportFilter = "all" | BugStatus;
type ReportSort = "newest" | "oldest" | "active" | "fixed";

const PAGE_SIZE = 10;

export function BugReportsPage() {
  const [reportData, setReportData] = useState<BugReportResponse | null>(null);
  const [filter, setFilter] = useState<ReportFilter>("all");
  const [sort, setSort] = useState<ReportSort>("newest");
  const [page, setPage] = useState(1);
  const [expandedReport, setExpandedReport] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingReportId, setUpdatingReportId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadReports = async () => {
    setError("");
    try {
      setReportData(await fetchBugReports());
    } catch (loadError) {
      console.error("Failed to load bug reports:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Unable to load bug reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
  }, []);

  const visibleReports = useMemo(() => {
    const reports = reportData?.reports ?? [];
    const filtered = reports.filter((report) => filter === "all" || report.status === filter);
    return filtered.sort((first, second) => {
      if (sort === "active") return Number(second.status === "active") - Number(first.status === "active");
      if (sort === "fixed") return Number(second.status === "fixed") - Number(first.status === "fixed");

      const dateOrder = new Date(first.created_at).getTime() - new Date(second.created_at).getTime();
      return sort === "newest" ? -dateOrder : dateOrder;
    });
  }, [filter, reportData, sort]);
  const pageCount = Math.max(1, Math.ceil(visibleReports.length / PAGE_SIZE));
  const pageReports = visibleReports.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const updateFilter = (value: ReportFilter) => {
    setFilter(value);
    setPage(1);
  };
  const updateSort = (value: ReportSort) => {
    setSort(value);
    setPage(1);
  };

  const toggleReportStatus = async (report: BugReport) => {
    const nextStatus = report.status === "active" ? "fixed" : "active";
    setUpdatingReportId(report.id);
    try {
      await updateBugReportStatus(report.id, nextStatus);
      toast.success(nextStatus === "fixed" ? "Bug marked as fixed." : "Bug reopened.");
      await loadReports();
    } catch (updateError) {
      console.error("Failed to update bug report status:", updateError);
      toast.error(updateError instanceof Error ? updateError.message : "Unable to update bug status.");
    } finally {
      setUpdatingReportId(null);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-neutral-900 sm:text-3xl">System Bugs and Errors</h1>
        </div>
        <Button onClick={() => void loadReports()} variant="outline" size="sm" disabled={loading} className="hidden gap-2 sm:inline-flex">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      <section aria-label="Bug report summary">
        <div className="grid grid-cols-2 gap-2 sm:hidden">
          <SummaryCard label="Total Bug Reports" value={reportData?.total_count ?? 0} tone="neutral" />
          <SummaryCard label="Total Bug Fixed" value={reportData?.fixed_count ?? 0} tone="green" />
          <SummaryCard className="col-span-2" label="Active Bugs" value={reportData?.active_count ?? 0} tone="red" />
        </div>
        <div className="hidden rounded-xl border border-neutral-200 bg-white p-4 sm:block sm:p-5">
          <div className="mx-auto grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryCard label="Total Bug Reports" value={reportData?.total_count ?? 0} tone="neutral" />
            <SummaryCard label="Total Bug Fixed" value={reportData?.fixed_count ?? 0} tone="green" />
            <SummaryCard label="Active Bugs" value={reportData?.active_count ?? 0} tone="red" />
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-neutral-300 bg-white p-3 sm:mt-0 sm:p-4">
        <div className="mb-3 flex flex-col gap-3 border-b border-neutral-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-600 sm:flex" aria-label="Bug status legend">
            <span className="font-medium text-neutral-800">Status:</span>
            <StatusLegend status="fixed" label="Bug Fixed" />
            <StatusLegend status="active" label="Active Bug" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="bug-report-filter">Filter bug reports</label>
            <select
              id="bug-report-filter"
              value={filter}
              onChange={(event) => updateFilter(event.target.value as ReportFilter)}
              className="h-8 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-red-500 sm:h-9 sm:flex-none sm:px-3 sm:text-sm"
            >
              <option value="all">All reports</option>
              <option value="active">Active bugs</option>
              <option value="fixed">Fixed bugs</option>
            </select>
            <label className="sr-only" htmlFor="bug-report-sort">Sort bug reports</label>
            <select
              id="bug-report-sort"
              value={sort}
              onChange={(event) => updateSort(event.target.value as ReportSort)}
              className="h-8 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-red-500 sm:h-9 sm:flex-none sm:px-3 sm:text-sm"
            >
              <option value="newest">Newest added</option>
              <option value="oldest">Oldest added</option>
              <option value="active">Active bugs first</option>
              <option value="fixed">Fixed bugs first</option>
            </select>
            <ListFilter className="hidden h-4 w-4 text-neutral-400 sm:block" aria-hidden="true" />
          </div>
        </div>

        <h2 className="mb-1 text-sm font-semibold text-neutral-900 sm:hidden">Bug Reports</h2>
        {loading && !reportData ? (
          <div className="flex min-h-[300px] items-center justify-center text-sm text-neutral-500">Loading bug reports...</div>
        ) : pageReports.length > 0 ? (
          <ul className="divide-y divide-neutral-200">
            {pageReports.map((report) => (
              <li key={report.id} className="px-1 py-2 sm:px-2">
                <div className="flex min-h-10 items-center justify-between gap-2 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => setExpandedReport((current) => current === report.id ? null : report.id)}
                    className="min-w-0 flex-1 truncate text-left text-xs text-neutral-800 hover:text-red-700 sm:text-sm"
                  >
                    {report.title}
                  </button>
                  <div className="flex shrink-0 items-center gap-3">
                    <time className="hidden text-xs text-neutral-500 sm:block" dateTime={report.created_at}>
                      {new Date(report.created_at).toLocaleString()}
                    </time>
                    <span className="hidden sm:inline-flex">
                      <StatusIndicator status={report.status} />
                    </span>
                    <StatusBadgeButton
                      report={report}
                      disabled={updatingReportId === report.id}
                      onClick={() => void toggleReportStatus(report)}
                    />
                    <button
                      type="button"
                      disabled={updatingReportId === report.id}
                      onClick={() => void toggleReportStatus(report)}
                      className="hidden text-xs font-medium text-red-600 underline underline-offset-2 disabled:opacity-50 sm:inline"
                    >
                      {updatingReportId === report.id ? "Saving..." : report.status === "active" ? "Mark fixed" : "Reopen"}
                    </button>
                  </div>
                </div>
                {expandedReport === report.id ? (
                  <div className="space-y-2 pb-2 pl-2 pr-4 text-sm text-neutral-600">
                    <p className="whitespace-pre-wrap">{report.description}</p>
                    <p className="text-xs">Reported by {report.reporter_name} on {new Date(report.created_at).toLocaleString()}</p>
                    {report.picture_url ? (
                      <a href={report.picture_url} target="_blank" rel="noreferrer" className="inline-block text-red-600 underline">
                        View attached picture
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-4 text-center">
            <Bug className="mb-3 h-9 w-9 text-neutral-300" aria-hidden="true" />
            <h2 className="font-semibold text-neutral-800">{error ? "Bug reports unavailable" : "No bug reports yet"}</h2>
            <p className="mt-1 max-w-md text-sm text-neutral-500">
              {error ? "Refresh the page or try again later." : "Submitted reports will appear here."}
            </p>
          </div>
        )}

        <footer className="mt-3 flex items-center justify-center gap-2 border-t border-neutral-200 pt-3 sm:justify-end">
          <button
            type="button"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              aria-current={pageNumber === page ? "page" : undefined}
              aria-label={`Page ${pageNumber}`}
              onClick={() => setPage(pageNumber)}
              className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm font-semibold ${
                pageNumber === page
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {pageNumber}
            </button>
          ))}
          <button
            type="button"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </footer>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  className = "",
}: {
  label: string;
  value: number;
  tone: "neutral" | "green" | "red";
  className?: string;
}) {
  const indicatorClasses = {
    neutral: "bg-neutral-300",
    green: "bg-green-500",
    red: "bg-red-600",
  };

  return (
    <article className={`rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-left sm:px-4 sm:py-3 sm:text-center ${className}`}>
      <h2 className="flex items-center gap-1.5 text-[10px] font-medium text-neutral-500 sm:justify-center sm:gap-2 sm:text-sm sm:font-semibold sm:text-neutral-800">
        {tone !== "neutral" ? <span className={`hidden h-4 w-4 rounded sm:inline-block ${indicatorClasses[tone]}`} aria-hidden="true" /> : null}
        {label}
      </h2>
      <p className="mt-1 text-2xl font-bold leading-none text-neutral-950 sm:text-4xl">{value}</p>
    </article>
  );
}

function StatusBadgeButton({
  report,
  disabled,
  onClick,
}: {
  report: BugReport;
  disabled: boolean;
  onClick: () => void;
}) {
  const isFixed = report.status === "fixed";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={`${isFixed ? "Reopen" : "Mark fixed"}: ${report.title}`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-medium disabled:opacity-50 sm:hidden ${
        isFixed ? "bg-green-100 text-neutral-800" : "bg-red-100 text-neutral-800"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isFixed ? "bg-green-500" : "bg-red-600"}`} aria-hidden="true" />
      {isFixed ? "Fixed" : "Active"}
    </button>
  );
}

function StatusLegend({ status, label }: { status: BugStatus; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <StatusIndicator status={status} />
      {label}
    </span>
  );
}

function StatusIndicator({ status }: { status: BugStatus }) {
  const statusLabel = status === "fixed" ? "Bug fixed" : "Active bug";
  return (
    <span
      className={`h-3 w-3 rounded-full ${status === "fixed" ? "bg-green-500" : "bg-red-600"}`}
      role="img"
      aria-label={statusLabel}
      title={statusLabel}
    />
  );
}
