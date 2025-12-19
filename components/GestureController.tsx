import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { TreeMode } from '../types';

interface GestureControllerProps {
  onModeChange: (mode: TreeMode) => void;
  currentMode: TreeMode;
  onHandPosition?: (x: number, y: number, detected: boolean) => void;
  onTwoHandsDetected?: (detected: boolean) => void;
}

export const GestureController: React.FC<GestureControllerProps> = ({ 
  onModeChange, 
  currentMode, 
  onHandPosition, 
  onTwoHandsDetected 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [gestureStatus, setGestureStatus] = useState<string>("Initializing...");
  const [handPos, setHandPos] = useState<{ x: number; y: number } | null>(null);
  
  const lastModeRef = useRef<TreeMode>(currentMode);
  const openFrames = useRef(0);
  const closedFrames = useRef(0);
  const CONFIDENCE_THRESHOLD = 5;

  useEffect(() => {
    let isMounted = true; 
    let handLandmarker: HandLandmarker | null = null;
    let animationFrameId: number;

    const setupMediaPipe = async () => {
      try {
        // 使用 jsDelivr CDN 加载 WASM 运行环境
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );

        // 使用官方 Google 存储库加载模型，解决 404 报错问题
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });

        if (isMounted) startWebcam();
      } catch (error) {
        console.error("MediaPipe Init Error:", error);
        if (isMounted) setGestureStatus("Gesture control unavailable");
      }
    };

    const startWebcam = async () => {
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, facingMode: "user" }
          });
          
          if (videoRef.current && isMounted) {
            videoRef.current.srcObject = stream;
            // 性能优化：只在视频尺寸准备好时设置一次画布
            videoRef.current.onloadedmetadata = () => {
              if (canvasRef.current && videoRef.current) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
              }
            };
            videoRef.current.addEventListener("loadeddata", predictWebcam);
            setIsLoaded(true);
            setGestureStatus("Waiting for hand...");
          }
        } catch (err) {
          if (isMounted) setGestureStatus("Webcam Permission Denied");
        }
      }
    };

    const predictWebcam = () => {
      if (!handLandmarker || !videoRef.current || !isMounted) return;
      const startTimeMs = performance.now();
      if (videoRef.current.videoWidth > 0) {
        const result = handLandmarker.detectForVideo(videoRef.current, startTimeMs);
        if (result.landmarks && result.landmarks.length > 0) {
          if (onTwoHandsDetected) onTwoHandsDetected(result.landmarks.length >= 2);
          drawAllHands(result.landmarks);
          detectGesture(result.landmarks[0]);
        } else {
          handleNoHand();
        }
      }
      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    const handleNoHand = () => {
      setGestureStatus("No hand detected");
      setHandPos(null);
      openFrames.current = 0;
      closedFrames.current = 0;
      if (onHandPosition) onHandPosition(0.5, 0.5, false);
      if (onTwoHandsDetected) onTwoHandsDetected(false);
      const ctx = canvasRef.current?.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current?.width || 0, canvasRef.current?.height || 0);
    };

    const drawAllHands = (allLandmarks: any[][]) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#D4AF37';
      allLandmarks.forEach(landmarks => {
        const connections = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17]];
        connections.forEach(([s, e]) => {
          ctx.beginPath();
          ctx.moveTo(landmarks[s].x * canvas.width, landmarks[s].y * canvas.height);
          ctx.lineTo(landmarks[e].x * canvas.width, landmarks[e].y * canvas.height);
          ctx.stroke();
        });
      });
    };

    const detectGesture = (landmarks: any[]) => {
      const wrist = landmarks[0];
      const palmX = (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[13].x + landmarks[17].x) / 5;
      const palmY = (landmarks[0].y + landmarks[5].y + landmarks[9].y + landmarks[13].y + landmarks[17].y) / 5;
      setHandPos({ x: palmX, y: palmY });
      if (onHandPosition) onHandPosition(palmX, palmY, true);
      const fingerTips = [8, 12, 16, 20], fingerBases = [5, 9, 13, 17];
      let extendedFingers = 0;
      for (let i = 0; i < 4; i++) {
        const distTip = Math.hypot(landmarks[fingerTips[i]].x - wrist.x, landmarks[fingerTips[i]].y - wrist.y);
        const distBase = Math.hypot(landmarks[fingerBases[i]].x - wrist.x, landmarks[fingerBases[i]].y - wrist.y);
        if (distTip > distBase * 1.5) extendedFingers++;
      }
      if (extendedFingers >= 4) {
        openFrames.current++; closedFrames.current = 0;
        setGestureStatus("OPEN: Unleash");
        if (openFrames.current > CONFIDENCE_THRESHOLD && lastModeRef.current !== TreeMode.CHAOS) {
          onModeChange(TreeMode.CHAOS);
        }
      } else if (extendedFingers <= 1) {
        closedFrames.current++; openFrames.current = 0;
        setGestureStatus("CLOSED: Restore");
        if (closedFrames.current > CONFIDENCE_THRESHOLD && lastModeRef.current !== TreeMode.FORMED) {
          onModeChange(TreeMode.FORMED);
        }
      }
    };

    setupMediaPipe();
    return () => { isMounted = false; cancelAnimationFrame(animationFrameId); handLandmarker?.close(); };
  }, [onModeChange]);

  useEffect(() => { lastModeRef.current = currentMode; }, [currentMode]);

  return (
    <div className="absolute top-6 right-[8%] z-50 flex flex-col items-end pointer-events-none">
      <div className="relative w-[18.75vw] h-[14.0625vw] border-2 border-[#D4AF37] rounded-lg overflow-hidden bg-black shadow-lg">
        <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover transform -scale-x-100 transition-opacity ${isLoaded ? 'opacity-100' : 'opacity-0'}`} />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full transform -scale-x-100 pointer-events-none" />
        {handPos && (
          <div className="absolute w-3 h-3 bg-[#D4AF37] rounded-full border border-white shadow-md"
            style={{ left: `${(1 - handPos.x) * 100}%`, top: `${handPos.y * 100}%`, transform: 'translate(-50%, -50%)' }}
          />
        )}
      </div>
      <div className="mt-2 px-3 py-1 bg-black/60 text-[#D4AF37] text-xs rounded-full border border-[#D4AF37]/30 backdrop-blur-sm">
        {gestureStatus}
      </div>
    </div>
  );
};