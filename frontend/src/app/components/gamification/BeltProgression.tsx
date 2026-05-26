import React from "react";
import { Progress } from "../ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";

// Belt progression constants matching backend
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

const BELT_COLORS: Record<string, string> = {
  "White Belt": "bg-white border-gray-300",
  "Yellow Belt": "bg-yellow-300",
  "Orange Belt": "bg-orange-400",
  "Green Belt": "bg-green-500",
  "Purple Belt": "bg-purple-500",
  "1st Class Purple Belt": "bg-purple-700",
  "Brown Belt": "bg-amber-700",
  "1st Class Brown Belt": "bg-amber-900",
  "2nd Class Brown Belt": "bg-amber-950",
  "Black Belt": "bg-black",
};

const BELT_BADGE_COLORS: Record<string, string> = {
  "White Belt": "bg-white text-black border border-gray-300",
  "Yellow Belt": "bg-yellow-300 text-black",
  "Orange Belt": "bg-orange-400 text-white",
  "Green Belt": "bg-green-500 text-white",
  "Purple Belt": "bg-purple-500 text-white",
  "1st Class Purple Belt": "bg-purple-700 text-white",
  "Brown Belt": "bg-amber-700 text-white",
  "1st Class Brown Belt": "bg-amber-900 text-white",
  "2nd Class Brown Belt": "bg-amber-950 text-white",
  "Black Belt": "bg-black text-white",
};

interface BeltProgressionDisplayProps {
  currentBelt: string;
  targetBelt?: string;
  overallReadinessPercentage?: number;
  showFullProgression?: boolean;
  compact?: boolean;
}

export function BeltProgressionDisplay({
  currentBelt,
  targetBelt,
  overallReadinessPercentage = 0,
  showFullProgression = false,
  compact = false,
}: BeltProgressionDisplayProps) {
  const currentBeltIndex = BELT_LEVELS.indexOf(currentBelt);
  const targetBeltIndex = targetBelt ? BELT_LEVELS.indexOf(targetBelt) : currentBeltIndex + 1;
  const progressPercentage =
    targetBeltIndex > currentBeltIndex
      ? ((currentBeltIndex + 1) / BELT_LEVELS.length) * 100
      : 100;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-full border-2 ${
            BELT_COLORS[currentBelt] || "bg-gray-200"
          }`}
        ></div>
        <span className="text-sm font-medium">{currentBelt}</span>
        {targetBelt && targetBelt !== currentBelt && (
          <>
            <span className="text-xs text-gray-500">→</span>
            <span className="text-xs text-gray-600">{targetBelt}</span>
          </>
        )}
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Belt Progression</CardTitle>
        <CardDescription>Current rank and progression status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Belt Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-lg border-2 ${
                BELT_COLORS[currentBelt] || "bg-gray-200"
              }`}
            ></div>
            <div>
              <p className="text-sm text-gray-600">Current Belt</p>
              <p className="text-lg font-semibold">{currentBelt}</p>
            </div>
          </div>
          <Badge className={BELT_BADGE_COLORS[currentBelt] || "bg-gray-200"}>
            Level {currentBeltIndex + 1}/10
          </Badge>
        </div>

        {/* Target Belt Display */}
        {targetBelt && targetBelt !== currentBelt && (
          <div className="flex items-center gap-3 opacity-70">
            <div
              className={`w-12 h-12 rounded-lg border-2 border-dashed ${
                BELT_COLORS[targetBelt] || "bg-gray-200"
              }`}
            ></div>
            <div>
              <p className="text-sm text-gray-600">Target Belt</p>
              <p className="text-lg font-semibold">{targetBelt}</p>
            </div>
          </div>
        )}

        {/* Readiness Progress */}
        {overallReadinessPercentage > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex justify-between">
              <p className="text-sm font-medium">Readiness for Next Belt</p>
              <span className="text-sm font-semibold text-blue-600">
                {Math.round(overallReadinessPercentage)}%
              </span>
            </div>
            <Progress value={overallReadinessPercentage} className="h-2" />
          </div>
        )}

        {/* Full Progression Timeline */}
        {showFullProgression && (
          <div className="pt-4 border-t space-y-3">
            <p className="text-sm font-medium">Belt Progression Path</p>
            <div className="flex gap-1 flex-wrap">
              {BELT_LEVELS.map((belt, index) => (
                <React.Fragment key={belt}>
                  <div
                    className={`flex flex-col items-center gap-1 ${
                      index > currentBeltIndex ? "opacity-40" : ""
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded border-2 ${
                        BELT_COLORS[belt] || "bg-gray-200"
                      } ${index <= currentBeltIndex ? "ring-2 ring-blue-400" : ""}`}
                    ></div>
                    <span className="text-xs text-gray-600 text-center max-w-[60px]">
                      {belt.split(" ")[0]}
                    </span>
                  </div>
                  {index < BELT_LEVELS.length - 1 && (
                    <div className="flex items-end mb-1">
                      <div className="w-2 h-1 bg-gray-300"></div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
