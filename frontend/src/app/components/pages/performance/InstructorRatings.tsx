import { useEffect, useState } from "react";
import { Star, Plus } from "lucide-react";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
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
  DialogTrigger,
} from "../../ui/dialog";
import { fetchInstructorRatings, fetchStudents } from "../../../api";

type RatingHistoryRecord = {
  id: number;
  student: number;
  student_name: string;
  date_evaluated: string;
  kata_score: number;
  kumite_score: number;
  discipline_score: number;
  remarks: string;
};

type StudentRecord = {
  student_id: number;
  first_name: string;
  last_name: string;
  current_belt_rank: string;
};

function StarRating({ value, onChange }: { value: number; onChange?: (value: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          className={`${onChange ? "cursor-pointer" : "cursor-default"}`}
        >
          <Star
            className={`h-5 w-5 ${
              star <= value
                ? "fill-yellow-400 text-yellow-400"
                : star - 0.5 === value
                ? "fill-yellow-400/50 text-yellow-400"
                : "fill-none text-neutral-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function InstructorRatings() {
  const [ratings, setRatings] = useState<RatingHistoryRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [kataRating, setKataRating] = useState(0);
  const [kumiteRating, setKumiteRating] = useState(0);
  const [disciplineRating, setDisciplineRating] = useState(0);

  useEffect(() => {
    fetchStudents()
      .then((data) => {
        if (Array.isArray(data)) {
          setStudents(data);
          if (data.length) {
            setSelectedStudent(String(data[0].student_id));
          }
        }
      })
      .catch(() => setStudents([]));

    fetchInstructorRatings()
      .then((data) => {
        if (Array.isArray(data)) {
          setRatings(data);
        }
      })
      .catch(() => setRatings([]));
  }, []);

  const totalRatings = ratings.length;
  const avgKata = totalRatings
    ? Math.round((ratings.reduce((sum, record) => sum + record.kata_score, 0) / totalRatings) * 10) / 10
    : 0;
  const avgKumite = totalRatings
    ? Math.round((ratings.reduce((sum, record) => sum + record.kumite_score, 0) / totalRatings) * 10) / 10
    : 0;
  const avgDiscipline = totalRatings
    ? Math.round((ratings.reduce((sum, record) => sum + record.discipline_score, 0) / totalRatings) * 10) / 10
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Instructor Ratings</h1>
          <p className="text-sm text-neutral-500">Rate student performance across categories</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Rating
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Student Rating</DialogTitle>
              <DialogDescription>Evaluate student performance</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="student">Select Student</Label>
                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                  <SelectTrigger id="student">
                    <SelectValue placeholder="Choose a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.student_id} value={String(student.student_id)}>
                        {student.first_name} {student.last_name} - {student.current_belt_rank || "Unknown"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Kata (Forms)</Label>
                  <StarRating value={kataRating} onChange={setKataRating} />
                </div>
                <div className="space-y-2">
                  <Label>Kumite (Sparring)</Label>
                  <StarRating value={kumiteRating} onChange={setKumiteRating} />
                </div>
                <div className="space-y-2">
                  <Label>Discipline</Label>
                  <StarRating value={disciplineRating} onChange={setDisciplineRating} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional comments about performance..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => setIsAddOpen(false)}>
                  Save Rating
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500 mb-1">Kata (Forms)</div>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-semibold">{avgKata.toFixed(1)}</div>
            <StarRating value={avgKata} />
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500 mb-1">Kumite (Sparring)</div>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-semibold">{avgKumite.toFixed(1)}</div>
            <StarRating value={avgKumite} />
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-sm text-neutral-500 mb-1">Discipline</div>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-semibold">{avgDiscipline.toFixed(1)}</div>
            <StarRating value={avgDiscipline} />
          </div>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg">
        <div className="p-6 border-b border-neutral-200">
          <h2 className="font-semibold">Recent Ratings</h2>
          <p className="text-xs text-neutral-500">Student performance evaluations</p>
        </div>
        <div className="divide-y divide-neutral-200">
          {ratings.map((record) => (
            <div key={record.id} className="p-6 hover:bg-neutral-50">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-medium mb-1">{record.student_name}</div>
                  <div className="text-sm text-neutral-500">{record.date_evaluated}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Kata</div>
                  <StarRating value={record.kata_score} />
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Kumite</div>
                  <StarRating value={record.kumite_score} />
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">Discipline</div>
                  <StarRating value={record.discipline_score} />
                </div>
              </div>

              <div className="text-sm text-neutral-600">{record.remarks}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
