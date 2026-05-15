import { useState } from "react";
import { Calendar, ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { AttendanceTracker } from "./AttendanceTracker";
import { AttendanceLogs } from "./AttendanceLogs";

export function AttendancePage() {
  const [activeTab, setActiveTab] = useState("tracker");

  return (
    <div className="min-h-screen space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-red-600">Attendance</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Attendance Tracker & Logs</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Manage session attendance, review recognition results, and explore attendance history all in one place.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Current workspace</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-900">
                <Calendar className="h-4 w-4 text-red-600" />
                Attendance management
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Quick access</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-900">
                <ClipboardCheck className="h-4 w-4 text-slate-700" />
                Logs are now inside Attendance
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-red-600" />
            Attendance Workspace
          </CardTitle>
          <CardDescription>
            Switch between live tracker controls and attendance history without leaving the attendance workflow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
              <TabsTrigger value="tracker" className="rounded-xl text-sm font-medium">
                Tracker
              </TabsTrigger>
              <TabsTrigger value="logs" className="rounded-xl text-sm font-medium">
                Logs
              </TabsTrigger>
            </TabsList>
            <TabsContent value="tracker" className="space-y-6">
              <AttendanceTracker />
            </TabsContent>
            <TabsContent value="logs" className="space-y-6">
              <AttendanceLogs />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
