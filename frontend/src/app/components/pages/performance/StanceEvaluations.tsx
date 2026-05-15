import { useEffect, useMemo, useState } from "react";
import { Search, Filter, Eye } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { fetchStanceEvaluations } from "../../../api";

type StanceEvaluationRecord = {
  id: number;
  student: number;
  student_name: string;
  stance_type: string;
  score: number;
  evaluator_name?: string;
  date_evaluated: string;
  remarks: string;
};

export function StanceEvaluations() {
  const [evaluations, setEvaluations] = useState<StanceEvaluationRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [stanceFilter, setStanceFilter] = useState("all");

  useEffect(() => {
    fetchStanceEvaluations()
      .then((data) => {
        if (Array.isArray(data)) {
          setEvaluations(data);
        }
      })
      .catch(() => setEvaluations([]));
  }, []);

  const filteredEvaluations = useMemo(
    () =>
      evaluations.filter((evaluation) => {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          evaluation.student_name.toLowerCase().includes(query) ||
          evaluation.stance_type.toLowerCase().includes(query) ||
          evaluation.remarks.toLowerCase().includes(query) ||
          (evaluation.evaluator_name ?? '').toLowerCase().includes(query);
        const matchesStance = stanceFilter === "all" || evaluation.stance_type === stanceFilter;
        return matchesSearch && matchesStance;
      }),
    [evaluations, searchQuery, stanceFilter],
  );

  const avgScore = useMemo(() => {
    return evaluations.length ? Math.round(evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length) : 0;
  }, [evaluations]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Stance Evaluations</h1>
        <p className="text-sm text-neutral-500">View and manage pose assessment records</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500 mb-1">Total Evaluations</div>
          <div className="text-2xl font-semibold">{evaluations.length}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500 mb-1">Average Score</div>
          <div className="text-2xl font-semibold text-green-600">{avgScore}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500 mb-1">High Performers</div>
          <div className="text-2xl font-semibold">{evaluations.filter(e => e.score >= 90).length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={stanceFilter} onValueChange={setStanceFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stances</SelectItem>
              <SelectItem value="Front Stance">Front Stance</SelectItem>
              <SelectItem value="Back Stance">Back Stance</SelectItem>
              <SelectItem value="Horse Stance">Horse Stance</SelectItem>
              <SelectItem value="Cat Stance">Cat Stance</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Evaluations Table */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Student</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Stance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Instructor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Remarks</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredEvaluations.map((evaluation) => (
                <tr key={evaluation.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 text-sm font-medium">{evaluation.student_name}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{evaluation.stance_type}</td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-semibold ${
                      evaluation.score >= 90 ? 'text-green-600' :
                      evaluation.score >= 80 ? 'text-blue-600' :
                      'text-neutral-900'
                    }`}>
                      {evaluation.score}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{evaluation.evaluator_name || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{evaluation.date_evaluated}</td>
                  <td className="px-6 py-4 text-sm text-neutral-600">{evaluation.remarks}</td>
                  <td className="px-6 py-4">
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-neutral-500">
        <div>Showing {filteredEvaluations.length} of {evaluations.length} evaluations</div>
      </div>
    </div>
  );
}
