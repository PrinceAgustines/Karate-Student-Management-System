import React, { useState, useRef, useEffect } from 'react';
import { Check, User, AlertCircle } from 'lucide-react';
import { Button } from '../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';

interface FaceRegion {
  face_index: number;
  bounding_box: [number, number, number, number]; // [x, y, width, height]
  encoding?: string | null;
  assignedStudent?: number;
  status: 'unassigned' | 'assigned' | 'selected';
}

interface Student {
  id: number;
  name: string;
}

interface FaceSelectionCanvasProps {
  imageFile: File;
  faces: FaceRegion[];
  students: Student[];
  onAssignmentChange: (faceIndex: number, studentId: number) => void;
  assignments: Record<number, number>;
}

export function FaceSelectionCanvas({
  imageFile,
  faces,
  students,
  onAssignmentChange,
  assignments
}: FaceSelectionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedFaceIndex, setSelectedFaceIndex] = useState<number | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0, originalWidth: 0, originalHeight: 0 });

  // Load and display the image on canvas
  useEffect(() => {
    if (!imageFile || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);
    img.onload = () => {
      // Calculate canvas size (max 1200px width, maintain aspect ratio)
      const maxWidth = 1200;
      const scale = Math.min(maxWidth / img.width, 1);
      const displayWidth = img.width * scale;
      const displayHeight = img.height * scale;

      canvas.width = displayWidth;
      canvas.height = displayHeight;
      setImageDimensions({
        width: displayWidth,
        height: displayHeight,
        originalWidth: img.width,
        originalHeight: img.height,
      });

      // Draw the image
      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
      setImageLoaded(true);
    };
    img.src = objectUrl;

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [imageFile]);

  // Draw face overlays whenever faces or assignments change
  useEffect(() => {
    if (!imageLoaded || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and redraw image
    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      drawFaceOverlays();
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  }, [imageLoaded, faces, assignments, selectedFaceIndex, imageFile]);

  const drawFaceOverlays = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = imageDimensions.originalWidth > 0 ? canvas.width / imageDimensions.originalWidth : 1;
    const scaleY = imageDimensions.originalHeight > 0 ? canvas.height / imageDimensions.originalHeight : 1;

    faces.forEach((face) => {
      const [x, y, width, height] = face.bounding_box;
      const scaledX = x * scaleX;
      const scaledY = y * scaleY;
      const scaledWidth = width * scaleX;
      const scaledHeight = height * scaleY;

      // Determine border color based on status
      let borderColor = '#ef4444'; // red for unassigned
      let borderWidth = 2;

      const assignedStudentId = assignments[face.face_index];
      if (assignedStudentId !== undefined && assignedStudentId !== -1) {
        borderColor = '#22c55e'; // green for assigned
      } else if (assignedStudentId === -1) {
        borderColor = '#f59e0b'; // amber for skipped guest/invalid
      } else if (selectedFaceIndex === face.face_index) {
        borderColor = '#3b82f6'; // blue for selected
        borderWidth = 3;
      }

      // Draw face rectangle
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

      // Draw assignment indicator
      if (assignments[face.face_index] !== undefined) {
        ctx.fillStyle = borderColor;
        ctx.beginPath();
        ctx.arc(scaledX + scaledWidth - 15, scaledY + 15, 12, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('✓', scaledX + scaledWidth - 15, scaledY + 20);
      }

      // Draw face index label
      ctx.fillStyle = borderColor;
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${face.face_index + 1}`,
        scaledX + scaledWidth / 2,
        scaledY - 5
      );
    });
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Scale from original image coordinates to canvas display coordinates
    const scaleX = imageDimensions.originalWidth > 0 ? canvas.width / imageDimensions.originalWidth : 1;
    const scaleY = imageDimensions.originalHeight > 0 ? canvas.height / imageDimensions.originalHeight : 1;

    // Find clicked face
    const clickedFace = faces.find((face) => {
      const [faceX, faceY, faceWidth, faceHeight] = face.bounding_box;
      const scaledX = faceX * scaleX;
      const scaledY = faceY * scaleY;
      const scaledWidth = faceWidth * scaleX;
      const scaledHeight = faceHeight * scaleY;

      return (
        x >= scaledX &&
        x <= scaledX + scaledWidth &&
        y >= scaledY &&
        y <= scaledY + scaledHeight
      );
    });

    if (clickedFace) {
      setSelectedFaceIndex(clickedFace.face_index);
    } else {
      setSelectedFaceIndex(null);
    }
  };

  const handleStudentAssignment = (studentId: string) => {
    if (selectedFaceIndex !== null) {
      onAssignmentChange(selectedFaceIndex, parseInt(studentId));
      setSelectedFaceIndex(null); // Deselect after assignment
    }
  };

  const handleSkipFace = () => {
    // Mark face as skipped by setting assignment to -1 (special marker)
    if (selectedFaceIndex !== null) {
      onAssignmentChange(selectedFaceIndex, -1);
      setSelectedFaceIndex(null);
    }
  };

  const assignedCount = Object.values(assignments).filter((studentId) => studentId !== -1).length;
  const skippedCount = Object.values(assignments).filter((studentId) => studentId === -1).length;
  const totalFaces = faces.length;

  return (
    <div className="space-y-4">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">
          Select Faces to Assign ({assignedCount}/{totalFaces} assigned, {skippedCount} skipped)
        </h3>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>Unassigned</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>Selected</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>Assigned</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-amber-400 rounded"></div>
            <span>Skipped</span>
          </div>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="cursor-pointer border border-neutral-300 rounded max-w-full h-auto"
          style={{ display: imageLoaded ? 'block' : 'none' }}
        />

        {!imageLoaded && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-neutral-400 mx-auto mb-2" />
              <p className="text-neutral-500">Loading image...</p>
            </div>
          </div>
        )}
      </div>

      {/* Face Assignment Panel */}
      {selectedFaceIndex !== null && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <User className="h-5 w-5 text-blue-600" />
            <h4 className="font-medium text-blue-900">
              Face #{selectedFaceIndex + 1} - Select Student or Skip
            </h4>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium text-blue-800 mb-2 block">
              Select Student
            </label>
            <Select onValueChange={handleStudentAssignment}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a student..." />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.id} value={String(student.id)}>
                    {student.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 mt-3">
            <Button
              onClick={handleSkipFace}
              variant="outline"
              size="sm"
              className="text-amber-600 border-amber-300 hover:bg-amber-50"
            >
              Skip (Guest)
            </Button>
            <Button
              onClick={() => setSelectedFaceIndex(null)}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Assignment Summary */}
      {assignedCount > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-900 mb-2">Assigned Faces</h4>
          <div className="space-y-1">
            {Object.entries(assignments).map(([faceIndex, studentId]) => {
              if (studentId === -1) return null; // Skip "guest" entries in display
              const student = students.find(s => s.id === studentId);
              return (
                <div key={faceIndex} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>Face #{parseInt(faceIndex) + 1} → {student?.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Skipped Faces Summary */}
      {Object.values(assignments).filter(id => id === -1).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-medium text-amber-900 mb-2">Skipped Faces</h4>
          <p className="text-sm text-amber-800">
            {Object.values(assignments).filter(id => id === -1).length} face(s) skipped (guest/invalid)
          </p>
        </div>
      )}
    </div>
  );
}