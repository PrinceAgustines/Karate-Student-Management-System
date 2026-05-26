import { useEffect, useMemo, useState } from "react";
import { Search, Filter, Eye, Edit2, Trash2, X } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import {
  fetchStanceEvaluations,
  updateStanceEvaluation,
  deleteStanceEvaluation,
} from "../../../api";

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
  const [selectedEvaluation, setSelectedEvaluation] = useState<StanceEvaluationRecord | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editedRemarks, setEditedRemarks] = useState("");
  const [editedScore, setEditedScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadEvaluations();
  }, []);

  const loadEvaluations = async () => {
    try {
      setLoading(true);
      const data = await fetchStanceEvaluations();
      if (Array.isArray(data)) {
        setEvaluations(data);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load evaluations");
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvaluations = useMemo(
    () =>
      evaluations.filter((evaluation) => {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          evaluation.student_name.toLowerCase().includes(query) ||
          evaluation.stance_type.toLowerCase().includes(query) ||
          evaluation.remarks.toLowerCase().includes(query) ||
          (evaluation.evaluator_name ?? "").toLowerCase().includes(query);
        const matchesStance = stanceFilter === "all" || evaluation.stance_type === stanceFilter;
        return matchesSearch && matchesStance;
      }),
    [evaluations, searchQuery, stanceFilter],
  );

  const avgScore = useMemo(() => {
    return evaluations.length ? Math.round(evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length) : 0;
  }, [evaluations]);

  const handleView = (evaluation: StanceEvaluationRecord) => {
    setSelectedEvaluation(evaluation);
    setIsViewOpen(true);
  };

  const handleEdit = (evaluation: StanceEvaluationRecord) => {
    setSelectedEvaluation(evaluation);
    setEditedScore(evaluation.score);
    setEditedRemarks(evaluation.remarks);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedEvaluation) return;
    try {
      setLoading(true);
      await updateStanceEvaluation(selectedEvaluation.id, {
        score: editedScore,
        remarks: editedRemarks,
      });
      // Update local state
      setEvaluations(
        evaluations.map((e) =>
          e.id === selectedEvaluation.id
            ? { ...e, score: editedScore, remarks: editedRemarks }
            : e,
        ),
      );
      setIsEditOpen(false);
      setSelectedEvaluation(null);
      setSuccessMessage("Evaluation updated successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update evaluation");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (evaluationId: number) => {
    if (!window.confirm("Are you sure you want to delete this evaluation?")) return;
    try {
      setLoading(true);
      await deleteStanceEvaluation(evaluationId);
      setEvaluations(evaluations.filter((e) => e.id !== evaluationId));
      setSuccessMessage("Evaluation deleted successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete evaluation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Stance Evaluations</h1>
        <p className="text-sm text-neutral-500">View and manage pose assessment records</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center justify-between">
          {successMessage}
          <button onClick={() => setSuccessMessage(null)} className="text-green-700 hover:text-green-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500">Actions</th>
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
                  <td className="px-6 py-4 text-sm text-neutral-600 max-w-xs truncate" title={evaluation.remarks}>{evaluation.remarks || '-'}</td>
                  <td className="px-6 py-4 flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleView(evaluation)}
                      disabled={loading}
                      title="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(evaluation)}
                      disabled={loading}
                      title="Edit evaluation"
                    >
                      <Edit2 className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(evaluation.id)}
                      disabled={loading}
                      title="Delete evaluation"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
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

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Evaluation Details</DialogTitle>
            <DialogDescription>Detailed view of stance evaluation</DialogDescription>
          </DialogHeader>
          {selectedEvaluation && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-neutral-600">Student</label>
                <p className="text-lg font-semibold">{selectedEvaluation.student_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600">Stance Type</label>
                <p className="text-lg font-semibold">{selectedEvaluation.stance_type}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600">Score</label>
                <p className={`text-lg font-semibold ${
                  selectedEvaluation.score >= 90 ? 'text-green-600' :
                  selectedEvaluation.score >= 80 ? 'text-blue-600' :
                  'text-neutral-900'
                }`}>
                  {selectedEvaluation.score}/100
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600">Evaluated By</label>
                <p className="text-lg">{selectedEvaluation.evaluator_name || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600">Date Evaluated</label>
                <p className="text-lg">{new Date(selectedEvaluation.date_evaluated).toLocaleDateString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600">Remarks</label>
                <p className="text-sm text-neutral-700 whitespace-pre-wrap">{selectedEvaluation.remarks || 'No remarks'}</p>
              </div>
              <Button onClick={() => setIsViewOpen(false)} className="w-full">
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Evaluation</DialogTitle>
            <DialogDescription>Update stance evaluation details</DialogDescription>
          </DialogHeader>
          {selectedEvaluation && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-neutral-600">Student</label>
                <p className="text-lg font-semibold">{selectedEvaluation.student_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600">Stance Type</label>
                <p className="text-lg font-semibold">{selectedEvaluation.stance_type}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600">Score (1-100)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={editedScore}
                  onChange={(e) => setEditedScore(Math.max(1, Math.min(100, parseInt(e.target.value) || 0)))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-600">Remarks</label>
                <Textarea
                  value={editedRemarks}
                  onChange={(e) => setEditedRemarks(e.target.value)}
                  rows={4}
                  placeholder="Add evaluation remarks..."
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsEditOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSaveEdit}
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
