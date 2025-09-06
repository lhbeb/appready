import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface VideoVerificationProps {
  onComplete: (videos: { video1: Blob; video2: Blob }) => void;
  onClose: () => void;
}

type VerificationStep = 'initial' | 'error' | 'retry' | 'complete';

const VideoVerification: React.FC<VideoVerificationProps> = ({ onComplete, onClose }) => {
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isWebcamReady, setIsWebcamReady] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [currentStep, setCurrentStep] = useState<VerificationStep>('initial');
  const [firstVideo, setFirstVideo] = useState<Blob | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number>();

  const CIRCLE_SIZE = 400;
  const STROKE_WIDTH = 4;
  const RECORDING_DURATION = 7000;

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user",
  };

  const radius = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  
  const getProgressStyle = (progress: number) => {
    const dashOffset = circumference * (1 - progress / 100);
    return {
      strokeDasharray: `${circumference} ${circumference}`,
      strokeDashoffset: dashOffset,
    };
  };

  useEffect(() => {
    if (!isWebcamReady) return;

    const checkFacePosition = () => {
      const video = webcamRef.current?.video;
      if (!video) return;

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (context && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        context.drawImage(video, 0, 0);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = CIRCLE_SIZE / 2;
        
        const imageData = context.getImageData(
          centerX - radius,
          centerY - radius,
          radius * 2,
          radius * 2
        );
        
        let skinTonePixels = 0;
        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          
          if (r > 95 && g > 40 && b > 20 && 
              r > g && r > b && 
              Math.abs(r - g) > 15) {
            skinTonePixels++;
          }
        }
        
        setIsFaceDetected(skinTonePixels > (radius * radius * 0.1));
      }
      
      animationFrameRef.current = requestAnimationFrame(checkFacePosition);
    };

    checkFacePosition();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isWebcamReady]);

  useEffect(() => {
    if (isRecording) {
      const updateProgress = () => {
        if (recordingStartTimeRef.current) {
          const elapsed = Date.now() - recordingStartTimeRef.current;
          const newProgress = Math.min((elapsed / RECORDING_DURATION) * 100, 100);
          setProgress(newProgress);

          if (elapsed >= RECORDING_DURATION) {
            stopRecording();
          } else {
            requestAnimationFrame(updateProgress);
          }
        }
      };

      requestAnimationFrame(updateProgress);
    }
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = () => {
    if (!isFaceDetected) {
      toast.error('Please center your face in the circle');
      return;
    }

    const stream = webcamRef.current?.video?.srcObject as MediaStream;
    if (!stream || isRecording) return;

    try {
      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: 2500000
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        if (blob.size > 0) {
          handleRecordingComplete(blob);
        } else {
          toast.error('Recording failed. Please try again.');
        }
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setProgress(0);
      recordingStartTimeRef.current = Date.now();

      recordingTimeoutRef.current = setTimeout(() => {
        stopRecording();
      }, RECORDING_DURATION);

      toast.success(currentStep === 'initial' ? 'Recording started' : 'Recording second video...');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording. Please try again.');
    }
  };

  const stopRecording = () => {
    try {
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      setIsRecording(false);
      setProgress(100);
      mediaRecorderRef.current = null;
      recordingStartTimeRef.current = null;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      toast.error('Failed to stop recording. Please try again.');
    }
  };

  const handleRecordingComplete = (blob: Blob) => {
    if (currentStep === 'initial') {
      setFirstVideo(blob);
      setCurrentStep('error');
    } else if (currentStep === 'retry') {
      if (firstVideo) {
        onComplete({ video1: firstVideo, video2: blob });
      }
    }
  };

  const headTurnAnimation = {
    initial: { scaleX: 1 },
    animate: {
      scaleX: [1, 1, -1, -1, 1],
      transition: {
        duration: 0.7,
        times: [0, 0.285, 0.285, 0.715, 0.715],
        repeat: Infinity,
        repeatDelay: 0.2,
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-gray-900"
    >
      <div className="relative w-full h-full flex flex-col items-center justify-center">
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gray-900/50 backdrop-blur-sm">
          <button
            onClick={onClose}
            className="text-white hover:text-red-500 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="w-6" />
        </div>

        <AnimatePresence mode="wait">
          {currentStep === 'error' ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex items-center justify-center p-4 bg-gray-900"
            >
              <div className="bg-white rounded-2xl p-8 max-w-xl w-full shadow-lg">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
                  Error verifying your identity
                </h3>
                <p className="text-gray-600 mb-8 text-center">
                  Please follow the head turn motion shown below
                </p>
                <div className="rounded-lg overflow-hidden mb-8 max-w-md mx-auto">
                  <motion.div 
                    className="relative aspect-square w-full"
                    variants={headTurnAnimation}
                    initial="initial"
                    animate="animate"
                  >
                    <img
                      src="https://i.ibb.co/wFNv1sxz/verif-Tuto.webp"
                      alt="Head turn demonstration"
                      className="w-full h-full object-contain"
                    />
                  </motion.div>
                </div>
                <button
                  onClick={() => setCurrentStep('retry')}
                  className="bg-red-600 text-white px-8 py-3 rounded-xl hover:bg-red-700 
                           transition-colors flex items-center justify-center mx-auto"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Start Again
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="relative flex flex-col items-center">
              <motion.div
                key="camera"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="relative"
                style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
              >
                <div className="absolute inset-0 overflow-hidden rounded-full">
                  <Webcam
                    ref={webcamRef}
                    audio={true}
                    videoConstraints={videoConstraints}
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full object-cover"
                    onUserMedia={() => setIsWebcamReady(true)}
                  />
                </div>

                <svg
                  className="absolute inset-0"
                  width={CIRCLE_SIZE}
                  height={CIRCLE_SIZE}
                  style={{ transform: 'rotate(-90deg)' }}
                >
                  <circle
                    cx={CIRCLE_SIZE / 2}
                    cy={CIRCLE_SIZE / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.2)"
                    strokeWidth={STROKE_WIDTH}
                  />
                  <motion.circle
                    cx={CIRCLE_SIZE / 2}
                    cy={CIRCLE_SIZE / 2}
                    r={radius}
                    fill="none"
                    stroke="#E41705"
                    strokeWidth={STROKE_WIDTH}
                    strokeLinecap="round"
                    initial={getProgressStyle(0)}
                    animate={getProgressStyle(progress)}
                    transition={{ duration: 0.1 }}
                  />
                </svg>

                {!isFaceDetected && isWebcamReady && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black bg-opacity-50 rounded-full p-4">
                      <AlertCircle className="w-8 h-8 text-white animate-pulse" />
                    </div>
                  </div>
                )}

                {isRecording && (
                  <div className="absolute top-4 right-4 flex items-center space-x-2 bg-red-600 px-3 py-1 rounded-full">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-white text-sm">
                      {Math.ceil((100 - progress) * RECORDING_DURATION / 100000)}s
                    </span>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {currentStep !== 'error' && (
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <div className="max-w-md mx-auto">
              <p className="text-white text-center mb-6">
                {currentStep === 'retry'
                  ? "Please slowly turn your head left and right"
                  : !isFaceDetected
                  ? "Please center your face within the circle"
                  : isRecording
                  ? "Recording in progress... Please stay still"
                  : "When you are ready, click the button to start"}
              </p>
              
              {!isRecording && (
                <motion.button
                  onClick={startRecording}
                  disabled={!isWebcamReady || !isFaceDetected}
                  className="w-full py-4 bg-red-600 text-white rounded-xl hover:bg-red-700 
                           disabled:bg-gray-600 disabled:cursor-not-allowed
                           flex items-center justify-center space-x-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Camera className="w-5 h-5" />
                  <span>Start {currentStep === 'retry' ? 'Second Recording' : 'Recording'}</span>
                </motion.button>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default VideoVerification;