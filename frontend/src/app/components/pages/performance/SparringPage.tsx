import { useState, useEffect } from "react";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Alert, AlertDescription } from "../../ui/alert";
import { Badge } from "../../ui/badge";
import {
  Plus,
  Clock,
  Users,
  TrendingUp,
  Settings,
  Eye,
  Edit2,
  Trash2,
  Play,
  StopCircle,
  Calendar,
  Zap,
  AlertCircle,
  CheckCircle,
  Loader,
  Swords,
} from "lucide-react";

// Helper functions for API calls since they're not exported as an object
async function fetchSparringMatches(filters?: Record<string, any>) {
  const queryString = filters 
    ? '?' + Object.entries(filters)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&')
    : '';
  const response = await fetch(`http://127.0.0.1:8000/api/students/sparring-matches/${queryString}`, {
    headers: {
      'Authorization': `Bearer ${window.localStorage.getItem('karate-management-access-token')}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Failed to fetch sparring matches');
  return response.json();
}

async function generateMatchSuggestions() {
  const response = await fetch(`http://127.0.0.1:8000/api/students/sparring-matches/generate_matches/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${window.localStorage.getItem('karate-management-access-token')}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Failed to generate suggestions');
  return response.json();
}

async function createSparringMatch(data: Record<string, any>) {
  const response = await fetch(`http://127.0.0.1:8000/api/students/sparring-matches/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${window.localStorage.getItem('karate-management-access-token')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create match');
  return response.json();
}

async function createMatchFromSuggestion(data: Record<string, any>) {
  const response = await fetch(`http://127.0.0.1:8000/api/students/sparring-matches/create_from_suggestion/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${window.localStorage.getItem('karate-management-access-token')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create match from suggestion');
  return response.json();
}

async function updateMatchScores(matchId: number, scores: { score_a: number; score_b: number }) {
  const response = await fetch(`http://127.0.0.1:8000/api/students/sparring-matches/${matchId}/update_scores/`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${window.localStorage.getItem('karate-management-access-token')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(scores),
  });
  if (!response.ok) throw new Error('Failed to update scores');
  return response.json();
}

async function startMatch(matchId: number) {
  const response = await fetch(`http://127.0.0.1:8000/api/students/sparring-matches/${matchId}/start_match/`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${window.localStorage.getItem('karate-management-access-token')}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Failed to start match');
  return response.json();
}

async function completeMatch(matchId: number) {
  const response = await fetch(`http://127.0.0.1:8000/api/students/sparring-matches/${matchId}/complete_match/`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${window.localStorage.getItem('karate-management-access-token')}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Failed to complete match');
  return response.json();
}

async function cancelMatch(matchId: number) {
  const response = await fetch(`http://127.0.0.1:8000/api/students/sparring-matches/${matchId}/cancel_match/`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${window.localStorage.getItem('karate-management-access-token')}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Failed to cancel match');
  return response.json();
}

async function deleteMatch(matchId: number) {
  const response = await fetch(`http://127.0.0.1:8000/api/students/sparring-matches/${matchId}/`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${window.localStorage.getItem('karate-management-access-token')}`,
    },
  });
  if (!response.ok) throw new Error('Failed to delete match');
}

async function fetchStudentsList() {
  const response = await fetch(`http://127.0.0.1:8000/api/students/students/`, {
    headers: {
      'Authorization': `Bearer ${window.localStorage.getItem('karate-management-access-token')}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch students');
  return response.json();
}

interface Student {
  student_id: number;
  first_name: string;
  last_name: string;
  current_belt_rank: string;
  gender: string;
  personal_info?: {
    height: number;
    weight: number;
    birth_date: string;
  };
}

interface SparringMatch {
  match_id: number;
  student_a: number;
  student_b: number;
  student_a_name: string;
  student_b_name: string;
  student_a_belt: string;
  student_b_belt: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  matchmaking_type: "automated" | "manual";
  score_a: number;
  score_b: number;
  duration_minutes: number;
  match_date: string;
  match_time: string | null;
  started_at: string | null;
  completed_at: string | null;
  height_diff: number;
  weight_diff: number;
  age_diff: number;
  belt_diff: number;
  same_sex: boolean;
  winner_name: string | null;
  notes: string;
}

interface MatchSuggestion {
  student_a_id: number;
  student_a_name: string;
  student_b_id: number;
  student_b_name: string;
  compatibility_score: number;
  height_diff: number;
  weight_diff: number;
  age_diff: number;
  belt_diff: number;
  same_sex: boolean;
}

export function SparringPage() {
  const [activeTab, setActiveTab] = useState<"schedule" | "live" | "history">("schedule");
  const [matches, setMatches] = useState<SparringMatch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<SparringMatch | null>(null);
  const [liveMatch, setLiveMatch] = useState<SparringMatch | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(120);
  const [timerRunning, setTimerRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [studentA, setStudentA] = useState<number | null>(null);
  const [studentB, setStudentB] = useState<number | null>(null);
  const [duration, setDuration] = useState(2);
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split("T")[0]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch matches on mount
  useEffect(() => {
    fetchMatches();
    fetchStudents();
  }, []);

  // Timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (timerRunning && timerSeconds > 0) {
      interval = setInterval(() => setTimerSeconds(s => s - 1), 1000);
    } else if (timerSeconds === 0 && timerRunning) {
      setTimerRunning(false);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [timerRunning, timerSeconds]);

  const fetchMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSparringMatches();
      setMatches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching matches:", error);
      setError("Failed to load matches. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const data = await fetchStudentsList();
      const activeStudents = Array.isArray(data) ? data.filter((s: Student) => s && s.student_id) : [];
      setStudents(activeStudents);
      if (activeStudents.length === 0) {
        setError("No students found. Please add students to the system first.");
      }
    } catch (error) {
      console.error("Error fetching students:", error);
      setError("Failed to load students.");
    }
  };

  const generateSuggestions = async () => {
    setGeneratingSuggestions(true);
    setError(null);
    try {
      const data = await generateMatchSuggestions();
      const suggestionList = Array.isArray(data) ? data : [];
      if (suggestionList.length === 0) {
        setError("No compatible matches found. Ensure you have at least 2 active students.");
      } else {
        setSuggestions(suggestionList);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error("Error generating suggestions:", error);
      setError("Failed to generate match suggestions. Please try again.");
    } finally {
      setGeneratingSuggestions(false);
    }
  };

  const createMatchFromSuggestionHandler = async (suggestion: MatchSuggestion) => {
    setError(null);
    setLoading(true);
    try {
      const payload = {
        student_a_id: suggestion.student_a_id,
        student_b_id: suggestion.student_b_id,
        duration_minutes: duration,
        match_date: matchDate,
      };
      await createMatchFromSuggestion(payload);
      await fetchMatches();
      setShowSuggestions(false);
      setSuggestions([]);
      setActiveTab("schedule");
    } catch (error: any) {
      console.error("Error creating match:", error);
      setError(error.message || "Failed to create match from suggestion");
    } finally {
      setLoading(false);
    }
  };

  const createManualMatch = async () => {
    setFormError(null);
    setError(null);

    if (!studentA) {
      setFormError("Please select Student A");
      return;
    }
    if (!studentB) {
      setFormError("Please select Student B");
      return;
    }
    if (studentA === studentB) {
      setFormError("Cannot create match with the same student");
      return;
    }

    setLoading(true);
    try {
      await createSparringMatch({
        student_a: studentA,
        student_b: studentB,
        duration_minutes: duration,
        match_date: matchDate,
        matchmaking_type: "manual",
      });
      await fetchMatches();
      setShowScheduleForm(false);
      setStudentA(null);
      setStudentB(null);
      setFormError(null);
      setActiveTab("schedule");
    } catch (error: any) {
      console.error("Error creating match:", error);
      setError(error.message || "Failed to create match");
    } finally {
      setLoading(false);
    }
  };

  const startMatchHandler = async (match: SparringMatch) => {
    setError(null);
    setLoading(true);
    try {
      const data = await startMatch(match.match_id);
      setLiveMatch(data);
      setTimerSeconds(match.duration_minutes * 60);
      setTimerRunning(true);
      await fetchMatches();
      setActiveTab("live");
    } catch (error: any) {
      console.error("Error starting match:", error);
      setError(error.message || "Failed to start match");
    } finally {
      setLoading(false);
    }
  };

  const updateScore = async (studentSide: "a" | "b", points: number) => {
    if (!liveMatch) return;

    const newScoreA = studentSide === "a" ? liveMatch.score_a + points : liveMatch.score_a;
    const newScoreB = studentSide === "b" ? liveMatch.score_b + points : liveMatch.score_b;

    if (newScoreA > 9 || newScoreB > 9) {
      setError("Score cannot exceed 9 points");
      return;
    }

    try {
      const data = await updateMatchScores(liveMatch.match_id, {
        score_a: newScoreA,
        score_b: newScoreB,
      });
      setLiveMatch(data);
      setError(null);
    } catch (error: any) {
      console.error("Error updating score:", error);
      setError(error.message || "Failed to update score");
    }
  };

  const completeMatchHandler = async () => {
    if (!liveMatch) return;

    setError(null);
    setLoading(true);
    try {
      await completeMatch(liveMatch.match_id);
      setTimerRunning(false);
      setLiveMatch(null);
      await fetchMatches();
      setActiveTab("history");
    } catch (error: any) {
      console.error("Error completing match:", error);
      setError(error.message || "Failed to complete match");
    } finally {
      setLoading(false);
    }
  };

  const deleteMatchHandler = async (matchId: number) => {
    if (!window.confirm("Are you sure you want to delete this match? This action cannot be undone.")) return;

    setError(null);
    try {
      await deleteMatch(matchId);
      await fetchMatches();
    } catch (error: any) {
      console.error("Error deleting match:", error);
      setError(error.message || "Failed to delete match");
    }
  };

  const cancelMatchHandler = async (matchId: number) => {
    if (!window.confirm("Are you sure you want to cancel this match?")) return;

    setError(null);
    try {
      await cancelMatch(matchId);
      await fetchMatches();
    } catch (error: any) {
      console.error("Error cancelling match:", error);
      setError(error.message || "Failed to cancel match");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-info/20 text-info";
      case "in_progress":
        return "bg-warning/20 text-warning";
      case "completed":
        return "bg-success/20 text-success";
      case "cancelled":
        return "bg-primary/20 text-primary";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Swords className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-neutral-900">Sparring Management</h1>
          </div>
          <p className="text-neutral-600">Create and manage sparring matches with smart pairing, live timers, scoring, and match history.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={fetchMatches}
            variant="outline"
            className="text-primary border-primary"
          >
            <Eye className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => generateSuggestions()}
            disabled={generatingSuggestions || students.length < 2}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {generatingSuggestions ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
            Generate Suggestions
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="border-primary/30 bg-primary/10">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertDescription className="text-primary">{error}</AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-info">{matches.filter(m => m.status === "scheduled").length}</p>
              <p className="text-sm text-neutral-600 mt-1">Scheduled Matches</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-warning">{matches.filter(m => m.status === "in_progress").length}</p>
              <p className="text-sm text-neutral-600 mt-1">Active Matches</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-success">{matches.filter(m => m.status === "completed").length}</p>
              <p className="text-sm text-neutral-600 mt-1">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-neutral-600">{students.length}</p>
              <p className="text-sm text-neutral-600 mt-1">Active Students</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab("schedule")}
            className={`px-1 py-3 border-b-2 font-medium transition-colors ${
              activeTab === "schedule"
                ? "border-primary text-primary"
                : "border-transparent text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Scheduled Matches
            </div>
          </button>
          <button
            onClick={() => setActiveTab("live")}
            className={`px-1 py-3 border-b-2 font-medium transition-colors ${
              activeTab === "live"
                ? "border-primary text-primary"
                : "border-transparent text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Live Match
              {matches.some(m => m.status === "in_progress") && <Badge variant="default" className="ml-2">Active</Badge>}
            </div>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-1 py-3 border-b-2 font-medium transition-colors ${
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-neutral-600 hover:text-neutral-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Match History
            </div>
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && activeTab === "schedule" ? (
        <Card>
          <CardContent className="pt-6 flex items-center justify-center min-h-64">
            <div className="text-center">
              <Loader className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-neutral-600">Loading matches...</p>
            </div>
          </CardContent>
        </Card>
      ) : activeTab === "schedule" ? (
        <ScheduledMatchesTab
          matches={matches.filter(m => m.status === "scheduled")}
          showScheduleForm={showScheduleForm}
          setShowScheduleForm={setShowScheduleForm}
          studentA={studentA}
          setStudentA={setStudentA}
          studentB={studentB}
          setStudentB={setStudentB}
          duration={duration}
          setDuration={setDuration}
          matchDate={matchDate}
          setMatchDate={setMatchDate}
          students={students}
          suggestions={suggestions}
          showSuggestions={showSuggestions}
          setShowSuggestions={setShowSuggestions}
          loading={loading}
          formError={formError}
          onCreateMatch={createManualMatch}
          onCreateFromSuggestion={createMatchFromSuggestionHandler}
          onStartMatch={startMatchHandler}
          onCancelMatch={cancelMatchHandler}
          onDeleteMatch={deleteMatchHandler}
          getStatusColor={getStatusColor}
        />
      ) : activeTab === "live" ? (
        <LiveMatchTab
          match={liveMatch || matches.find(m => m.status === "in_progress")}
          timerSeconds={timerSeconds}
          timerRunning={timerRunning}
          formatTime={formatTime}
          setTimerRunning={setTimerRunning}
          onUpdateScore={updateScore}
          onCompleteMatch={completeMatchHandler}
          onStartMatch={startMatchHandler}
          matches={matches.filter(m => m.status === "scheduled")}
          loading={loading}
          onSelectMatch={setSelectedMatch}
        />
      ) : (
        <HistoryTab
          matches={matches.filter(m => m.status === "completed" || m.status === "cancelled")}
          getStatusColor={getStatusColor}
          onDeleteMatch={deleteMatchHandler}
        />
      )}
    </div>
  );
}

// Sub-components
function ScheduledMatchesTab({
  matches,
  showScheduleForm,
  setShowScheduleForm,
  studentA,
  setStudentA,
  studentB,
  setStudentB,
  duration,
  setDuration,
  matchDate,
  setMatchDate,
  students,
  suggestions,
  showSuggestions,
  setShowSuggestions,
  loading,
  formError,
  onCreateMatch,
  onCreateFromSuggestion,
  onStartMatch,
  onCancelMatch,
  onDeleteMatch,
  getStatusColor,
}: any) {
  return (
    <div className="space-y-6">
      {!showScheduleForm && !showSuggestions && (
        <Button
          onClick={() => setShowScheduleForm(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="mr-2 h-4 w-4" />
          Schedule New Match
        </Button>
      )}

      {showScheduleForm && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule New Match</CardTitle>
            <CardDescription>Create a manual sparring match between two students</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {formError && (
              <Alert className="border-primary/30 bg-primary/10">
                <AlertCircle className="h-4 w-4 text-primary" />
                <AlertDescription className="text-primary">{formError}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-neutral-900">Student A</label>
                <select
                  value={studentA || ""}
                  onChange={(e) => {
                    setStudentA(e.target.value ? parseInt(e.target.value) : null);
                    formError && (formError.includes("Student A") || formError.includes("both")) && setStudentA(null);
                  }}
                  className="w-full border border-neutral-300 rounded-lg px-4 py-2 text-neutral-900 bg-white hover:border-neutral-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select first student...</option>
                  {students.map((s: Student) => (
                    <option key={s.student_id} value={s.student_id}>
                      {s.first_name} {s.last_name} — {s.current_belt_rank}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-neutral-900">Student B</label>
                <select
                  value={studentB || ""}
                  onChange={(e) => {
                    setStudentB(e.target.value ? parseInt(e.target.value) : null);
                    formError && (formError.includes("Student B") || formError.includes("both")) && setStudentB(null);
                  }}
                  className="w-full border border-neutral-300 rounded-lg px-4 py-2 text-neutral-900 bg-white hover:border-neutral-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select second student...</option>
                  {students.map((s: Student) => (
                    <option key={s.student_id} value={s.student_id}>
                      {s.first_name} {s.last_name} — {s.current_belt_rank}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-neutral-900">Match Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="w-full border border-neutral-300 rounded-lg px-4 py-2 text-neutral-900 bg-white hover:border-neutral-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value={1}>1 minute</option>
                  <option value={2}>2 minutes</option>
                  <option value={3}>3 minutes</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-neutral-900">Match Date</label>
                <input
                  type="date"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                  className="w-full border border-neutral-300 rounded-lg px-4 py-2 text-neutral-900 bg-white hover:border-neutral-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => {
                  setShowScheduleForm(false);
                  setStudentA(null);
                  setStudentB(null);
                }}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={onCreateMatch}
                disabled={loading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {loading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create Match
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showSuggestions && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recommended Pairings</CardTitle>
              <CardDescription>
                {suggestions.length > 0
                  ? `Found ${suggestions.length} compatible pairing${suggestions.length !== 1 ? "s" : ""}`
                  : "No compatible pairings found"}
              </CardDescription>
            </div>
            <Button
              onClick={() => setShowSuggestions(false)}
              variant="outline"
              size="sm"
            >
              Close
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {suggestions.length === 0 ? (
                <p className="text-neutral-600 py-4 text-center">No suggestions available. Try generating suggestions again.</p>
              ) : (
                suggestions.map((suggestion: MatchSuggestion, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-gradient-to-r from-primary/5 to-neutral-50 p-4 rounded-lg border border-primary/30 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-neutral-900">
                        {suggestion.student_a_name} <span className="text-neutral-500 font-normal">vs</span> {suggestion.student_b_name}
                      </p>
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                        <div>
                          <span className="text-neutral-600">Compatibility</span>
                          <p className="font-semibold text-info">{(suggestion.compatibility_score * 100).toFixed(0)}%</p>
                        </div>
                        <div>
                          <span className="text-neutral-600">Height</span>
                          <p className="font-semibold">{Math.abs(suggestion.height_diff).toFixed(1)} cm</p>
                        </div>
                        <div>
                          <span className="text-neutral-600">Weight</span>
                          <p className="font-semibold">{Math.abs(suggestion.weight_diff).toFixed(1)} kg</p>
                        </div>
                        <div>
                          <span className="text-neutral-600">Belt Level</span>
                          <p className="font-semibold">{suggestion.belt_diff} rank{suggestion.belt_diff !== 1 ? "s" : ""}</p>
                        </div>
                        <div>
                          <span className="text-neutral-600">Gender</span>
                          <p className="font-semibold">{suggestion.same_sex ? "Same" : "Mixed"}</p>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => onCreateFromSuggestion(suggestion)}
                      className="ml-4 bg-primary hover:bg-primary/90 text-primary-foreground"
                      size="sm"
                    >
                      Create
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scheduled Matches List */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Matches</CardTitle>
          <CardDescription>
            {matches.length === 0 ? "No scheduled matches yet" : `${matches.length} match${matches.length !== 1 ? "es" : ""} scheduled`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {matches.length === 0 ? (
            <div className="text-center py-8">
              <Swords className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-600">No scheduled matches yet.</p>
              <p className="text-neutral-500 text-sm">Create a new match or generate suggestions to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((match: SparringMatch) => (
                <div
                  key={match.match_id}
                  className="flex items-center justify-between bg-neutral-50 hover:bg-neutral-100 p-4 rounded-lg border border-neutral-200 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-neutral-900">
                      {match.student_a_name} <span className="font-normal text-neutral-500 text-sm">({match.student_a_belt})</span> vs {match.student_b_name} <span className="font-normal text-neutral-500 text-sm">({match.student_b_belt})</span>
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      <span className="text-neutral-600">📅 {match.match_date}</span>
                      <span className="text-neutral-600">⏱️ {match.duration_minutes} min</span>
                      <Badge variant="outline" className="text-neutral-600">
                        {match.matchmaking_type === "automated" ? "🤖 Automated" : "👤 Manual"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(match.status)}>
                      {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
                    </Badge>
                    <Button
                      onClick={() => onStartMatch(match)}
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      title="Start this match"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => onCancelMatch(match.match_id)}
                      size="sm"
                      variant="outline"
                      title="Cancel this match"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => onDeleteMatch(match.match_id)}
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      title="Delete this match"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LiveMatchTab({
  match,
  timerSeconds,
  timerRunning,
  formatTime,
  setTimerRunning,
  onUpdateScore,
  onCompleteMatch,
  onStartMatch,
  matches,
  loading,
  onSelectMatch,
}: any) {
  if (!match) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <Play className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-700 font-semibold mb-2">No Live Match In Progress</p>
            <p className="text-neutral-600 text-sm mb-6">Select a scheduled match to begin scoring</p>
            {matches.length > 0 ? (
              <div className="space-y-3 max-w-md mx-auto">
                <p className="text-xs font-semibold text-neutral-600 mb-3">AVAILABLE MATCHES</p>
                {matches.map((m: SparringMatch) => (
                  <Button
                    key={m.match_id}
                    onClick={() => onStartMatch(m)}
                    variant="outline"
                    className="w-full text-left justify-start"
                    disabled={loading}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {m.student_a_name} vs {m.student_b_name}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-neutral-500 text-sm">No scheduled matches available. Create one first.</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border border-neutral-200 shadow-sm">
        <CardContent className="px-6 py-6">
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-neutral-500">Live Sparring Match</p>
              <p className="mt-1 text-base font-semibold text-neutral-900">
                {match.match_date} · {match.duration_minutes} min
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_280px_1fr] items-center">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Student A</p>
                <p className="mt-3 text-lg font-semibold text-neutral-900">{match.student_a_name}</p>
                <p className="text-sm text-neutral-500">{match.student_a_belt}</p>
                <p className="mt-5 text-5xl font-bold text-neutral-900">{match.score_a}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => onUpdateScore("a", 1)} size="sm" className="min-w-[44px] bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-100">
                    +1
                  </Button>
                  <Button onClick={() => onUpdateScore("a", 2)} size="sm" className="min-w-[44px] bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-100">
                    +2
                  </Button>
                  <Button onClick={() => onUpdateScore("a", 3)} size="sm" className="min-w-[44px] bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-100">
                    +3
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Timer</p>
                <p className="mt-4 text-5xl font-bold text-neutral-900">{formatTime(timerSeconds)}</p>
                <p className="text-sm text-neutral-500 mt-1">remaining</p>
                <Button
                  onClick={() => setTimerRunning(!timerRunning)}
                  className={timerRunning ? "mt-5 w-full bg-neutral-900 text-white" : "mt-5 w-full bg-neutral-800 text-white"}
                  size="sm"
                >
                  {timerRunning ? "Pause" : "Start"}
                </Button>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Student B</p>
                <p className="mt-3 text-lg font-semibold text-neutral-900">{match.student_b_name}</p>
                <p className="text-sm text-neutral-500">{match.student_b_belt}</p>
                <p className="mt-5 text-5xl font-bold text-neutral-900">{match.score_b}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => onUpdateScore("b", 1)} size="sm" className="min-w-[44px] bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-100">
                    +1
                  </Button>
                  <Button onClick={() => onUpdateScore("b", 2)} size="sm" className="min-w-[44px] bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-100">
                    +2
                  </Button>
                  <Button onClick={() => onUpdateScore("b", 3)} size="sm" className="min-w-[44px] bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-100">
                    +3
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <Button onClick={onCompleteMatch} className="bg-success text-white px-5 py-3">
                Complete Match
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Match Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle>Match Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-neutral-600">Current Leader</p>
              <p className="text-lg font-bold text-neutral-900">
                {match.score_a > match.score_b
                  ? match.student_a_name
                  : match.score_b > match.score_a
                  ? match.student_b_name
                  : "Tied"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-neutral-600">Score Difference</p>
              <p className="text-lg font-bold text-neutral-900">{Math.abs(match.score_a - match.score_b)} pts</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-neutral-600">Total Points</p>
              <p className="text-lg font-bold text-neutral-900">{match.score_a + match.score_b}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-neutral-600">Match Type</p>
              <Badge variant="outline">{match.matchmaking_type === "automated" ? "🤖 Automated" : "👤 Manual"}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryTab({
  matches,
  getStatusColor,
  onDeleteMatch,
}: any) {
  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-700 font-semibold mb-2">No Match History Yet</p>
            <p className="text-neutral-600 text-sm">Completed and cancelled matches will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Separate completed and cancelled matches
  const completedMatches = matches.filter((m: SparringMatch) => m.status === "completed");
  const cancelledMatches = matches.filter((m: SparringMatch) => m.status === "cancelled");

  return (
    <div className="space-y-6">
      {/* Completed Matches */}
      {completedMatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Completed Matches</CardTitle>
            <CardDescription>{completedMatches.length} match{completedMatches.length !== 1 ? "es" : ""}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {completedMatches.map((match: SparringMatch) => (
                <div
                  key={match.match_id}
                  className="flex items-center justify-between bg-gradient-to-r from-success/5 to-neutral-50 p-4 rounded-lg border border-success/30 hover:border-success/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-semibold text-neutral-900">
                        {match.student_a_name} <span className="font-normal text-neutral-500 text-sm">({match.student_a_belt})</span>
                      </p>
                      <div className="px-3 py-1 bg-white rounded border border-neutral-200">
                        <p className="font-bold text-neutral-900">{match.score_a}</p>
                      </div>
                      <span className="text-neutral-500 font-medium">vs</span>
                      <div className="px-3 py-1 bg-white rounded border border-neutral-200">
                        <p className="font-bold text-neutral-900">{match.score_b}</p>
                      </div>
                      <p className="font-semibold text-neutral-900">
                        {match.student_b_name} <span className="font-normal text-neutral-500 text-sm">({match.student_b_belt})</span>
                      </p>
                    </div>
                    {match.winner_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <p className="text-success font-semibold">Winner: {match.winner_name}</p>
                      </div>
                    )}
                    <p className="text-xs text-neutral-600 mt-2">
                      📅 {match.match_date} • ⏱️ {match.duration_minutes} min • 🏷️ {match.matchmaking_type === "automated" ? "Automated" : "Manual"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(match.status)}>Completed</Badge>
                    <Button
                      onClick={() => onDeleteMatch(match.match_id)}
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Delete this match record"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancelled Matches */}
      {cancelledMatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cancelled Matches</CardTitle>
            <CardDescription>{cancelledMatches.length} match{cancelledMatches.length !== 1 ? "es" : ""}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cancelledMatches.map((match: SparringMatch) => (
                <div
                  key={match.match_id}
                  className="flex items-center justify-between bg-gradient-to-r from-red-50 to-neutral-50 p-4 rounded-lg border border-red-200 hover:border-red-300 transition-colors opacity-75"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-neutral-700">
                      {match.student_a_name} <span className="font-normal text-neutral-500 text-sm">({match.student_a_belt})</span> vs {match.student_b_name} <span className="font-normal text-neutral-500 text-sm">({match.student_b_belt})</span>
                    </p>
                    <p className="text-xs text-neutral-600 mt-2">
                      📅 {match.match_date} • ⏱️ {match.duration_minutes} min
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(match.status)}>Cancelled</Badge>
                    <Button
                      onClick={() => onDeleteMatch(match.match_id)}
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Delete this match record"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
