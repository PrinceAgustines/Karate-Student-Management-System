import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/components/ui/tabs";
import { AttendanceTracker } from "./AttendanceTracker";
import { AttendanceLogs } from "./AttendanceLogs";

export function AttendancePage() {
  const [activeTab, setActiveTab] = useState("tracker");

  return (
    <div className="min-h-screen space-y-3 bg-[#f7f7f7]">
      <div>
        <h1 className="text-xl font-bold uppercase tracking-tight text-neutral-950 sm:text-3xl">Attendance</h1>
        <div className="mt-2 hidden h-2.5 w-[430px] max-w-full rounded-full bg-neutral-200 sm:block" />
      </div>

      <div className="rounded-lg sm:border sm:border-neutral-300 sm:bg-white sm:p-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-1">
          <TabsList className="grid h-10 w-full grid-cols-2 gap-0 overflow-hidden rounded-lg bg-neutral-100 p-1 sm:h-8 sm:rounded-lg sm:border sm:border-neutral-300 sm:bg-white sm:p-0">
            <TabsTrigger value="tracker" className="rounded-md bg-transparent text-[10px] font-semibold text-black data-[state=active]:bg-black data-[state=active]:text-white sm:rounded-none sm:bg-white sm:text-sm sm:data-[state=active]:bg-red-600">
              Take Attendance
            </TabsTrigger>
            <TabsTrigger value="logs" className="rounded-md bg-transparent text-[10px] font-semibold text-black data-[state=active]:bg-black data-[state=active]:text-white sm:rounded-none sm:bg-white sm:text-sm sm:data-[state=active]:bg-red-600">
              Attendance Logs
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tracker" className="mt-3 space-y-6 sm:mt-1">
            <AttendanceTracker />
          </TabsContent>
          <TabsContent value="logs" className="mt-3 space-y-6 sm:mt-1">
            <AttendanceLogs />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
