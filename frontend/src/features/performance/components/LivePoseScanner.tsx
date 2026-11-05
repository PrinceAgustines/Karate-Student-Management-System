import { useEffect, useRef, useState } from "react";
import { Camera, LoaderCircle, Maximize, Minimize, ScanLine } from "lucide-react";
import { Button } from "../../../shared/components/ui/button";
import { analyzeLivePoseFrame } from "../../../shared/lib/api";

type Landmark = {
  x: number;
  y: number;
  visibility?: number;
};

type LivePoseResult = {
  has_pose: boolean;
  landmarks: Landmark[];
  stance_type: string | null;
  confidence: number;
  reference_match?: {
    template_id: number;
    stance_label: string;
    similarity: number;
    matched: boolean;
  } | null;
};

type LivePoseScannerProps = {
  onStop: () => void;
};

const FRAME_INTERVAL_MS = 250;
const MAX_FRAME_WIDTH = 640;
const POSE_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [17, 19], [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 29], [29, 31],
  [27, 31], [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
];

function drawPose(canvas: HTMLCanvasElement, landmarks: Landmark[]) {
  const context = canvas.getContext("2d");
  if (!context) return;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#22c55e";
  context.fillStyle = "#22c55e";
  context.lineWidth = Math.max(2, canvas.width / 320);

  for (const [firstIndex, lastIndex] of POSE_CONNECTIONS) {
    const first = landmarks[firstIndex];
    const last = landmarks[lastIndex];
    if ((first.visibility ?? 0) < 0.35 || (last.visibility ?? 0) < 0.35) continue;

    context.beginPath();
    context.moveTo(first.x * canvas.width, first.y * canvas.height);
    context.lineTo(last.x * canvas.width, last.y * canvas.height);
    context.stroke();
  }

  for (const landmark of landmarks) {
    if ((landmark.visibility ?? 0) < 0.35) continue;
    context.beginPath();
    context.arc(
      landmark.x * canvas.width,
      landmark.y * canvas.height,
      Math.max(2.5, canvas.width / 160),
      0,
      Math.PI * 2,
    );
    context.fill();
  }
}

function getCameraError(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Camera access was denied. Allow camera access in your browser and try again.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No camera was found. Connect a webcam and try again.";
  }
  return error instanceof Error ? error.message : "Could not start live pose scanning.";
}

export function LivePoseScanner({ onStop }: LivePoseScannerProps) {
  const scannerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState("Preparing camera…");
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<LivePoseResult | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const updateFullscreen = () => {
      setIsFullscreen(document.fullscreenElement === scannerRef.current);
    };
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let animationFrame = 0;
    let lastFrameTime = 0;
    let requestInFlight = false;
    let stream: MediaStream | null = null;
    const abortController = new AbortController();
    const captureCanvas = document.createElement("canvas");

    const sendFrame = (video: HTMLVideoElement, overlay: HTMLCanvasElement) => {
      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      const scale = Math.min(1, MAX_FRAME_WIDTH / sourceWidth);
      captureCanvas.width = Math.round(sourceWidth * scale);
      captureCanvas.height = Math.round(sourceHeight * scale);
      const captureContext = captureCanvas.getContext("2d");
      if (!captureContext) {
        setError("Could not capture a camera frame.");
        requestInFlight = false;
        return;
      }

      captureContext.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
      captureCanvas.toBlob(async (frame) => {
        try {
          if (!frame) {
            if (!cancelled) setError("Could not encode the camera frame.");
            return;
          }
          if (cancelled) return;

          const result = await analyzeLivePoseFrame(frame, abortController.signal) as LivePoseResult;
          if (cancelled) return;
          setReading(result.has_pose ? result : null);
          setError(null);
          setStatus("Scanning in real time");
          if (result.has_pose) {
            drawPose(overlay, result.landmarks);
          } else {
            overlay.getContext("2d")?.clearRect(0, 0, overlay.width, overlay.height);
          }
        } catch (requestError) {
          if (cancelled || abortController.signal.aborted) return;
          setError(getCameraError(requestError));
          setStatus("Pose service unavailable");
        } finally {
          requestInFlight = false;
        }
      }, "image/jpeg", 0.7);
    };

    const scan = (timestamp: number) => {
      const video = videoRef.current;
      const overlay = canvasRef.current;

      if (
        video &&
        overlay &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        !requestInFlight &&
        timestamp - lastFrameTime >= FRAME_INTERVAL_MS
      ) {
        if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
          overlay.width = video.videoWidth;
          overlay.height = video.videoHeight;
        }
        lastFrameTime = timestamp;
        requestInFlight = true;
        sendFrame(video, overlay);
      }

      animationFrame = requestAnimationFrame(scan);
    };

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera access requires a secure connection (HTTPS or localhost).");
        }

        setStatus("Requesting camera access…");
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) throw new Error("Camera preview could not be initialized.");
        video.srcObject = stream;
        await video.play();

        setStatus("Connecting to pose service…");
        animationFrame = requestAnimationFrame(scan);
      } catch (startError) {
        if (!cancelled) {
          setError(getCameraError(startError));
          setStatus("Scanner unavailable");
        }
      }
    };

    void start();
    return () => {
      cancelled = true;
      abortController.abort();
      cancelAnimationFrame(animationFrame);
      stream?.getTracks().forEach((track) => track.stop());
      if (document.fullscreenElement === scannerRef.current) {
        void document.exitFullscreen();
      }
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === scannerRef.current) {
        await document.exitFullscreen();
      } else if (scannerRef.current?.requestFullscreen) {
        await scannerRef.current.requestFullscreen();
      } else {
        setError("Fullscreen mode is not supported by this browser.");
      }
    } catch (fullscreenError) {
      setError(getCameraError(fullscreenError));
    }
  };

  return (
    <div
      ref={scannerRef}
      className={`space-y-4 ${isFullscreen ? "fixed inset-0 z-[100] flex h-[100dvh] flex-col bg-black p-4 text-white" : ""}`}
    >
      <div className={`relative mx-auto aspect-video w-full overflow-hidden rounded-lg bg-neutral-950 ${isFullscreen ? "min-h-0 flex-1 aspect-auto" : ""}`}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
        />
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
        />
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white">
          <span className={`h-2 w-2 rounded-full ${status === "Scanning in real time" ? "animate-pulse bg-red-500" : "bg-amber-400"}`} />
          {status}
        </div>
        {reading?.has_pose && (
          <div className={`absolute bottom-3 right-3 max-w-[85%] rounded px-3 py-2 text-sm font-medium text-white shadow ${reading.reference_match?.matched ? "bg-green-700/90" : "bg-amber-700/90"}`}>
            <p>{Math.round(reading.confidence * 100)}% {reading.stance_type}</p>
            {reading.reference_match?.matched && (
              <p className="mt-1 text-xs font-normal">
                Compared to saved reference #{reading.reference_match.template_id} · {Math.round(reading.reference_match.similarity * 100)}% match
              </p>
            )}
            {!reading.reference_match?.matched && (
              <p className="mt-1 text-xs font-normal">
                No saved reference matched
              </p>
            )}
          </div>
        )}
        {!reading?.has_pose && status === "Scanning in real time" && (
          <div className="absolute bottom-3 right-3 rounded bg-black/70 px-3 py-2 text-sm text-white">
            No pose detected
          </div>
        )}
        {error && (
          <div className="absolute inset-x-4 bottom-4 rounded-md bg-red-950/90 p-3 text-sm text-white">
            {error}
          </div>
        )}
        {status !== "Scanning in real time" && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <LoaderCircle className="h-8 w-8 animate-spin text-white" />
          </div>
        )}
      </div>
      <div className={`flex items-center justify-between gap-3 ${isFullscreen ? "shrink-0" : ""}`}>
        <div className="flex items-start gap-2 text-sm text-neutral-500">
          <ScanLine className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Pose landmarks are analyzed by the system&apos;s backend stance classifier and are not saved.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" onClick={() => void toggleFullscreen()}>
            {isFullscreen ? <Minimize className="mr-2 h-4 w-4" /> : <Maximize className="mr-2 h-4 w-4" />}
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </Button>
          {isFullscreen && (
            <Button type="button" variant="destructive" onClick={onStop}>
              <Camera className="mr-2 h-4 w-4" />
              Stop camera
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
