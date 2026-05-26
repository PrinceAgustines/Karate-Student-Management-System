import { useEffect, useState } from "react";
import { Edit2, Trash2, Plus, Save } from "lucide-react";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../ui/dialog";
import {
  fetchInstructorRatingsByStudent,
  createInstructorRating,
  updateInstructorRating,
  deleteInstructorRating,
} from "../../../api";

type InstructorRatingRecord = {
  id: number;
  student: number;
  kata_score: number;
  kumite_score: number;
  discipline_score: number;
  remarks: string;
  date_evaluated: string;
};

interface InstructorRatingEditorProps {
  studentId: number;
  ratingType: "kata" | "kumite" | "discipline"; // which score to display/edit
  onUpdate?: () => void;
}

function ScoreInput({ value, onChange }: { value: number; onChange?: (value: number) => void }) {
  return (
    <div className="flex items-center gap-4">
      <input
        type="number"
        min="1"
        max="100"
        value={value || ""}
        onChange={(e) => onChange?.(parseInt(e.target.value) || 0)}
        className="w-24 px-3 py-2 border border-neutral-300 rounded-lg text-center text-lg font-semibold"
        placeholder="1-100"
      />
      <span className="text-sm text-neutral-600">out of 100</span>
    </div>
  );
}

export function InstructorRatingEditor({
  studentId,
  ratingType,
  onUpdate,
}: InstructorRatingEditorProps) {
  const [ratings, setRatings] = useState<InstructorRatingRecord[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [kataScore, setKataScore] = useState(0);
  const [kumiteScore, setKumiteScore] = useState(0);
  const [disciplineScore, setDisciplineScore] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [dateEvaluated, setDateEvaluated] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRatings();
  }, [studentId]);

  const loadRatings = async () => {
    try {
      setLoading(true);
      const data = await fetchInstructorRatingsByStudent(studentId);
      setRatings(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load ratings"
      );
      setRatings([]);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentRating = () => {
    if (ratings.length === 0) return null;
    // Return the most recent rating
    return ratings.sort(
      (a, b) =>
        new Date(b.date_evaluated).getTime() -
        new Date(a.date_evaluated).getTime()
    )[0];
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setKataScore(0);
    setKumiteScore(0);
    setDisciplineScore(0);
    setRemarks("");
    setDateEvaluated(new Date().toISOString().split("T")[0]);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (rating: InstructorRatingRecord) => {
    setEditingId(rating.id);
    setKataScore(rating.kata_score);
    setKumiteScore(rating.kumite_score);
    setDisciplineScore(rating.discipline_score);
    setRemarks(rating.remarks);
    setDateEvaluated(rating.date_evaluated);
    setIsEditOpen(true);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      // Only send the relevant score based on ratingType
      const payload: any = {
        remarks,
        date_evaluated: dateEvaluated,
      };

      if (ratingType === "kata") {
        payload.kata_score = kataScore;
      } else if (ratingType === "kumite") {
        payload.kumite_score = kumiteScore;
      } else if (ratingType === "discipline") {
        payload.discipline_score = disciplineScore;
      }

      if (editingId) {
        // Update existing
        await updateInstructorRating(editingId, payload);
        setIsEditOpen(false);
      } else {
        // Create new
        payload.student = studentId;
        await createInstructorRating(payload);
        setIsAddOpen(false);
      }
      await loadRatings();
      onUpdate?.();
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save rating"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (ratingId: number) => {
    if (!window.confirm("Are you sure you want to delete this rating?")) return;

    try {
      setLoading(true);
      await deleteInstructorRating(ratingId);
      await loadRatings();
      onUpdate?.();
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete rating"
      );
    } finally {
      setLoading(false);
    }
  };

  const currentRating = getCurrentRating();

  const currentScore =
    ratingType === "kata"
      ? currentRating?.kata_score
      : ratingType === "kumite"
      ? currentRating?.kumite_score
      : currentRating?.discipline_score;

  const getRatingLabel = () => {
    switch (ratingType) {
      case "kata":
        return "Kata (Forms)";
      case "kumite":
        return "Kumite (Sparring)";
      case "discipline":
        return "Discipline";
      default:
        return "Performance";
    }
  };

  const getDialogTitle = () => {
    switch (ratingType) {
      case "kata":
        return "Add Kata Rating";
      case "kumite":
        return "Add Kumite Rating";
      case "discipline":
        return "Add Discipline Rating";
      default:
        return "Add Rating";
    }
  };

  const getDialogDescription = () => {
    switch (ratingType) {
      case "kata":
        return "Rate student performance in forms";
      case "kumite":
        return "Rate student performance in sparring";
      case "discipline":
        return "Rate student discipline and conduct";
      default:
        return "Rate student performance";
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {currentRating && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenEdit(currentRating)}
            disabled={loading}
          >
            <Edit2 className="h-4 w-4 mr-1" />
            Edit
          </Button>
        )}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={handleOpenAdd} disabled={loading}>
              <Plus className="h-4 w-4 mr-1" />
              {currentRating ? "Add New" : "Add Rating"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{getDialogTitle()}</DialogTitle>
              <DialogDescription>
                {getDialogDescription()}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date Evaluated</Label>
                <input
                  id="date"
                  type="date"
                  value={dateEvaluated}
                  onChange={(e) => setDateEvaluated(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
                />
              </div>

              {/* Only show the relevant rating field based on ratingType */}
              <div className="space-y-2">
                <Label>{getRatingLabel()} Rating</Label>
                {ratingType === "kata" && (
                  <ScoreInput value={kataScore} onChange={setKataScore} />
                )}
                {ratingType === "kumite" && (
                  <ScoreInput value={kumiteScore} onChange={setKumiteScore} />
                )}
                {ratingType === "discipline" && (
                  <ScoreInput value={disciplineScore} onChange={setDisciplineScore} />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks/Comments</Label>
                <Textarea
                  id="remarks"
                  placeholder="Additional comments about performance..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsAddOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={handleSave}
                  disabled={loading}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {loading ? "Saving..." : "Save Rating"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Current Rating Display */}
      {currentRating && (
        <div className="bg-neutral-50 p-4 rounded-lg">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold text-red-600">{currentScore}/100</div>
            </div>
            {currentRating.remarks && (
              <div className="text-sm text-neutral-600">
                <strong>Remarks:</strong> {currentRating.remarks}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {getRatingLabel()} Rating</DialogTitle>
            <DialogDescription>Update student performance rating</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-date">Date Evaluated</Label>
              <input
                id="edit-date"
                type="date"
                value={dateEvaluated}
                onChange={(e) => setDateEvaluated(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
              />
            </div>

            {/* Only show the relevant rating field based on ratingType */}
            <div className="space-y-2">
              <Label>{getRatingLabel()} Rating</Label>
              {ratingType === "kata" && (
                <ScoreInput value={kataScore} onChange={setKataScore} />
              )}
              {ratingType === "kumite" && (
                <ScoreInput value={kumiteScore} onChange={setKumiteScore} />
              )}
              {ratingType === "discipline" && (
                <ScoreInput value={disciplineScore} onChange={setDisciplineScore} />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-remarks">Remarks/Comments</Label>
              <Textarea
                id="edit-remarks"
                placeholder="Additional comments about performance..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsEditOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (editingId) handleDelete(editingId);
                }}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={handleSave}
                disabled={loading}
              >
                <Save className="h-4 w-4 mr-1" />
                {loading ? "Saving..." : "Update"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rating History */}
      {ratings.length > 1 && (
        <div className="mt-4 pt-4 border-t border-neutral-200">
          <p className="text-sm font-medium text-neutral-700 mb-3">Rating History</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {ratings.map((rating) => (
              <div
                key={rating.id}
                className="text-xs p-2 bg-neutral-50 rounded border border-neutral-200"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      {ratingType === "kata"
                        ? `Kata: ${rating.kata_score}/100`
                        : ratingType === "kumite"
                        ? `Kumite: ${rating.kumite_score}/100`
                        : `Discipline: ${rating.discipline_score}/100`}
                    </p>
                    <p className="text-neutral-500">
                      {new Date(rating.date_evaluated).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(rating)}
                    disabled={loading}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
