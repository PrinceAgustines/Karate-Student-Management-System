import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Users, Plus, Eye, UserMinus, LayoutDashboard } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../ui/dialog";
import { fetchMyChildren, addChildToParent, removeChildFromParent, fetchAvailableStudents } from "../../../api";

type ParentStudentRecord = {
  id: number;
  parent: number;
  parent_name: string;
  student: number;
  student_name: string;
  relationship: string;
  is_primary_contact: boolean;
  added_at: string;
};

type StudentRecord = {
  student_id: number;
  first_name: string;
  last_name: string;
  current_belt_rank: string;
  role: string;
};

export function ChildrenPage() {
  const [children, setChildren] = useState<ParentStudentRecord[]>([]);
  const [availableStudents, setAvailableStudents] = useState<StudentRecord[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const init = async () => {
      const currentChildren = await loadChildren();
      await loadAvailableStudents(currentChildren);
    };
    init();
  }, []);

  const loadChildren = async () => {
    try {
      const data = await fetchMyChildren();
      setChildren(data);
      return data;
    } catch (err) {
      console.error("Failed to load children:", err);
      return [] as ParentStudentRecord[];
    }
  };

  const loadAvailableStudents = async (currentChildren?: ParentStudentRecord[]) => {
    try {
      const data = await fetchAvailableStudents();
      const addedStudentIds = new Set((currentChildren ?? children).map(c => c.student));
      const available = data.filter((student: StudentRecord) => !addedStudentIds.has(student.student_id));
      setAvailableStudents(available);
    } catch (err) {
      console.error("Failed to load available students:", err);
    }
  };

  const handleAddChild = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const studentId = formData.get("studentId")?.toString();
    const relationship = formData.get("relationship")?.toString();

    if (!studentId || !relationship) {
      setError("Please fill in all fields.");
      setIsLoading(false);
      return;
    }

    try {
      await addChildToParent(studentId, relationship);
      setIsAddDialogOpen(false);
      const currentChildren = await loadChildren();
      await loadAvailableStudents(currentChildren);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add child.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveChild = async (relationshipId: number) => {
    if (!confirm("Are you sure you want to remove this child from your account?")) {
      return;
    }

    try {
      await removeChildFromParent(relationshipId);
      const currentChildren = await loadChildren();
      await loadAvailableStudents(currentChildren);
    } catch (err) {
      alert("Failed to remove child. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Children</h1>
          <p className="text-sm text-neutral-500">Manage the children you want to monitor</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Child
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a Child</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddChild} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="studentId">Select Student</Label>
                <Select name="studentId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStudents.map((student) => (
                      <SelectItem key={student.student_id} value={student.student_id.toString()}>
                        {student.first_name} {student.last_name} (ID: {student.student_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="relationship">Relationship</Label>
                <Select name="relationship" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mother">Mother</SelectItem>
                    <SelectItem value="father">Father</SelectItem>
                    <SelectItem value="guardian">Guardian</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {error && <div className="text-sm text-red-600">{error}</div>}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading} className="bg-red-600 hover:bg-red-700">
                  {isLoading ? "Adding..." : "Add Child"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {children.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-12 text-center">
          <Users className="h-16 w-16 text-neutral-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Children Added Yet</h2>
          <p className="text-neutral-600 mb-6 max-w-md mx-auto">
            Add your children to start monitoring their karate progress and performance.
          </p>
          <Button onClick={() => setIsAddDialogOpen(true)} className="bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Child
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {children.map((child) => (
            <div key={child.id} className="bg-white border border-neutral-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-semibold">
                  {child.student_name.charAt(0)}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveChild(child.id)}
                  className="text-neutral-400 hover:text-red-600"
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-lg">{child.student_name}</h3>
                <p className="text-sm text-neutral-500 capitalize">{child.relationship}</p>
                {child.is_primary_contact && (
                  <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                    Primary Contact
                  </span>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <Link to={`/dashboard/students/${child.student}/dashboard`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    View Dashboard
                  </Button>
                </Link>
                <Link to={`/dashboard/students/${child.student}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <Eye className="h-4 w-4 mr-2" />
                    View Profile
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}