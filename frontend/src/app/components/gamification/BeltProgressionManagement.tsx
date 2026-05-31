import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Alert, AlertDescription } from "../ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Progress } from "../ui/progress";
import { AlertCircle, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { Badge } from "../ui/badge";
import { BeltProgressionDisplay } from "./BeltProgression";
import { BeltReadinessMetrics } from "./BeltReadinessMetrics";

const BELT_LEVELS = [
  "White Belt",
  "Yellow Belt",
  "Orange Belt",
  "Green Belt",
  "Purple Belt",
  "1st Class Purple Belt",
  "Brown Belt",
  "1st Class Brown Belt",
  "2nd Class Brown Belt",
  "Black Belt",
];

interface StudentBeltProgress {
  student_id: number;
  name: string;
  current_belt: string;
  target_belt: string;
  overall_readiness: number;
  readiness_status: string;
  last_assessment_date: string;
}

interface BeltProgressionManagementProps {
  onUpdate?: () => void;
}

export function BeltProgressionManagement({
  onUpdate,
}: BeltProgressionManagementProps) {
  const [students, setStudents] = useState<StudentBeltProgress[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentBeltProgress | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("readiness");

  useEffect(() => {
    // TODO: Fetch students belt progression data from API
    // For now, using placeholder data structure
    setLoading(false);
  }, []);

  const filteredStudents = students
    .filter((s) =>
      filterStatus === "all"
        ? true
        : s.readiness_status === filterStatus
    )
    .sort((a, b) => {
      if (sortBy === "readiness") {
        return b.overall_readiness - a.overall_readiness;
      }
      return a.name.localeCompare(b.name);
    });

  const getReadinessColor = (readiness: number) => {
    if (readiness >= 85) return "bg-success/20";
    if (readiness >= 70) return "bg-warning/20";
    if (readiness >= 50) return "bg-accent/20";
    return "bg-primary/20";
  };

  const getStatusBadgeColor = (status: string) => {
    const statusColors: Record<string, string> = {
      not_ready: "bg-muted text-muted-foreground",
      in_progress: "bg-secondary text-secondary-foreground",
      ready: "bg-warning text-warning-foreground",
      tested: "bg-accent text-accent-foreground",
      promoted: "bg-success text-success-foreground",
    };
    return statusColors[status] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6 w-full">
      <div>
        <h2 className="text-2xl font-semibold">Belt Progression Management</h2>
        <p className="text-sm text-neutral-500">
          Monitor and manage student belt progression across all levels
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {students.length}
              </div>
              <p className="text-sm text-muted-foreground">Total Students</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-warning">
                {students.filter((s) => s.readiness_status === "ready").length}
              </div>
              <p className="text-sm text-muted-foreground">Ready for Testing</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-success">
                {students.filter((s) => s.readiness_status === "promoted").length}
              </div>
              <p className="text-sm text-muted-foreground">Recently Promoted</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-accent">
                {(
                  students.reduce((sum, s) => sum + s.overall_readiness, 0) /
                  Math.max(1, students.length)
                ).toFixed(0)}
                %
              </div>
              <p className="text-sm text-muted-foreground">Avg Readiness</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="by-belt">By Belt Level</TabsTrigger>
          <TabsTrigger value="ready-for-test">Ready for Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <CardTitle>All Students</CardTitle>
                  <CardDescription>
                    Monitor readiness and progression status
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="not_ready">Not Ready</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="ready">Ready for Testing</SelectItem>
                      <SelectItem value="tested">Tested</SelectItem>
                      <SelectItem value="promoted">Promoted</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="readiness">Readiness %</SelectItem>
                      <SelectItem value="name">Name (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600">
                        Student
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600">
                        Current Belt
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600">
                        Target Belt
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600">
                        Readiness
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600">
                        Last Assessment
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-neutral-600">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {filteredStudents.map((student) => (
                      <tr key={student.student_id} className="hover:bg-neutral-50">
                        <td className="px-4 py-4 font-medium text-neutral-900">
                          {student.name}
                        </td>
                        <td className="px-4 py-4 text-neutral-600">
                          {student.current_belt}
                        </td>
                        <td className="px-4 py-4 text-neutral-600">
                          {student.target_belt}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={student.overall_readiness}
                              className="h-2 flex-1 max-w-xs"
                            />
                            <span className="text-sm font-semibold min-w-[40px]">
                              {Math.round(student.overall_readiness)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Badge
                            className={`${getStatusBadgeColor(
                              student.readiness_status
                            )}`}
                          >
                            {student.readiness_status
                              .replace("_", " ")
                              .split(" ")
                              .map(
                                (w) =>
                                  w.charAt(0).toUpperCase() +
                                  w.slice(1)
                              )
                              .join(" ")}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-neutral-500 text-xs">
                          {new Date(
                            student.last_assessment_date
                          ).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedStudent(student)}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-belt">
          <div className="grid grid-cols-1 gap-4">
            {BELT_LEVELS.map((belt) => {
              const studentsAtBelt = students.filter(
                (s) => s.current_belt === belt
              );
              return (
                <Card key={belt}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{belt}</CardTitle>
                    <CardDescription>
                      {studentsAtBelt.length} student
                      {studentsAtBelt.length !== 1 ? "s" : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {studentsAtBelt.map((student) => (
                        <div
                          key={student.student_id}
                          className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-neutral-900">
                              {student.name}
                            </p>
                            <p className="text-xs text-neutral-500">
                              → {student.target_belt}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-neutral-900">
                              {Math.round(student.overall_readiness)}%
                            </div>
                            <Badge
                              className={getStatusBadgeColor(
                                student.readiness_status
                              )}
                              variant="secondary"
                            >
                              {student.readiness_status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                      {studentsAtBelt.length === 0 && (
                        <p className="text-sm text-neutral-500 py-4 text-center">
                          No students at this belt level
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="ready-for-test">
          <Card>
            <CardHeader>
              <CardTitle>Ready for Testing</CardTitle>
              <CardDescription>
                Students who meet all requirements for belt promotion testing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {students
                .filter((s) => s.readiness_status === "ready")
                .map((student) => (
                  <div key={student.student_id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-neutral-900">
                          {student.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {student.current_belt} → {student.target_belt}
                        </p>
                      </div>
                      <Badge className="bg-success text-success-foreground">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Ready
                      </Badge>
                    </div>
                    <Progress
                      value={student.overall_readiness}
                      className="h-2"
                    />
                    <p className="text-xs text-neutral-500 mt-2">
                      Overall Readiness: {Math.round(student.overall_readiness)}%
                    </p>
                  </div>
                ))}
              {students.filter((s) => s.readiness_status === "ready")
                .length === 0 && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    No students are currently ready for testing
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Student Detail Modal / Sidebar */}
      {selectedStudent && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{selectedStudent.name}</CardTitle>
                <CardDescription>Detailed progression analysis</CardDescription>
              </div>
              <Button
                variant="ghost"
                onClick={() => setSelectedStudent(null)}
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <BeltProgressionDisplay
                currentBelt={selectedStudent.current_belt}
                targetBelt={selectedStudent.target_belt}
                overallReadinessPercentage={selectedStudent.overall_readiness}
                compact={false}
              />
              <p className="text-sm text-neutral-600">
                <strong>Status:</strong>{" "}
                {selectedStudent.readiness_status
                  .replace("_", " ")
                  .split(" ")
                  .map(
                    (w) => w.charAt(0).toUpperCase() + w.slice(1)
                  )
                  .join(" ")}
              </p>
              <p className="text-sm text-neutral-600">
                <strong>Last Assessment:</strong>{" "}
                {new Date(
                  selectedStudent.last_assessment_date
                ).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
