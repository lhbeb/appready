import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, X, Zap, ZapOff, FlipHorizontal, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Compressor from 'compressorjs';
import toast from 'react-hot-toast';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
  side: 'front' | 'back';
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose, side }) => {
  const webcamRef = useRef<Webcam>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(false);
  const [lightLevel, setLightLevel] = useState(0);
  const [isCardDetected, setIsCardDetected] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [useNativeCamera, setUseNativeCamera] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);

  // Multiple constraint sets for maximum compatibility
  const getConstraintSets = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    return [
      // Try 1: Basic constraints for maximum compatibility
      {
        video: {
          facingMode: isFrontCamera ? 'user' : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      },
      // Try 2: Even more basic constraints
      {
        video: {
          facingMode: isFrontCamera ? 'user' : 'environment'
        }
      },
      // Try 3: Absolute minimum
      {
        video: true
      }
    ];
  };

  // Native camera initialization function
  const initializeNativeCamera = useCallback(async () => {
    try {
      setIsInitializing(true);
      setCameraError(null);
      
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      const constraintSets = getConstraintSets();
      let stream: MediaStream | null = null;
      
      // Try each constraint set until one works
      for (let i = 0; i < constraintSets.length; i++) {
        try {
          if (import.meta.env.DEV) {
            console.log(`Trying constraint set ${i + 1}:`, constraintSets[i]);
          }
          
          stream = await navigator.mediaDevices.getUserMedia(constraintSets[i]);
          
          if (stream && stream.getVideoTracks().length > 0) {
            if (import.meta.env.DEV) {
              console.log(`Success with constraint set ${i + 1}`);
            }
            break;
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.log(`Constraint set ${i + 1} failed:`, error);
          }
          if (i === constraintSets.length - 1) {
            throw error; // Last attempt failed
          }
        }
      }
      
      if (!stream) {
        throw new Error('No camera stream could be established');
      }
      
      streamRef.current = stream;
      
      // Set up video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        
        videoRef.current.onloadedmetadata = () => {
          setIsVideoReady(true);
          setIsInitializing(false);
          
          if (import.meta.env.DEV && videoRef.current) {
            console.log(`Native camera resolution: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
          }
        };
      }
      
    } catch (error: any) {
      setIsInitializing(false);
      setIsVideoReady(false);
      
      let errorMessage = 'Failed to access camera';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'Camera not supported in this browser.';
      }
      
      setCameraError(errorMessage);
      
      if (import.meta.env.DEV) {
        console.error('Native camera initialization failed:', error);
      }
    }
  }, [isFrontCamera]);

  // Webcam constraints for react-webcam fallback
  const getWebcamConstraints = () => {
    return {
      width: { ideal: 1280, min: 640 },
      height: { ideal: 720, min: 480 },
      facingMode: isFrontCamera ? 'user' : 'environment',
    };
  };

  const videoConstraints = getWebcamConstraints();

  // Initialize camera on component mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!useNativeCamera) {
        // Try react-webcam first, but with a timeout
        const fallbackTimer = setTimeout(() => {
          if (!isVideoReady && retryCount < 2) {
            if (import.meta.env.DEV) {
              console.log('React-webcam failed, switching to native camera');
            }
            setUseNativeCamera(true);
          }
        }, 3000); // 3 second timeout for react-webcam
        
        return () => clearTimeout(fallbackTimer);
      } else {
        initializeNativeCamera();
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [useNativeCamera, initializeNativeCamera, retryCount]);

  // Handle camera switching
  useEffect(() => {
    if (useNativeCamera) {
      initializeNativeCamera();
    } else {
      setIsVideoReady(false);
    }
  }, [isFrontCamera, useNativeCamera, initializeNativeCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Handle webcam ready state for react-webcam
  const handleWebcamReady = useCallback((stream: MediaStream) => {
    setIsVideoReady(true);
    setIsInitializing(false);
    setCameraError(null);
    
    if (import.meta.env.DEV) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        console.log('React-webcam ready, settings:', videoTrack.getSettings());
      }
    }
  }, []);

  // Handle webcam errors for react-webcam
  const handleWebcamError = useCallback((error: any) => {
    setIsInitializing(false);
    setIsVideoReady(false);
    
    if (retryCount < 2) {
      if (import.meta.env.DEV) {
        console.log('React-webcam error, switching to native camera:', error);
      }
      setUseNativeCamera(true);
      setRetryCount(prev => prev + 1);
    } else {
      const errorName = typeof error === 'string' ? error : (error as any)?.name || 'Unknown';
      
      let errorMessage = 'Failed to access camera';
      if (errorName === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access and try again.';
      } else if (errorName === 'NotFoundError') {
        errorMessage = 'No camera found. Please check your device.';
      } else if (errorName === 'OverconstrainedError') {
        errorMessage = 'Camera constraints not supported.';
      }
      
      setCameraError(errorMessage);
    }
  }, [retryCount]);

  // Simplified card detection for both camera types
  useEffect(() => {
    if (!isVideoReady) return;

    let animationFrame: number;
    let frameCount = 0;
    
    const detectCard = () => {
      frameCount++;
      if (frameCount % 15 !== 0) { // Reduced frequency for better performance
        animationFrame = requestAnimationFrame(detectCard);
        return;
      }
      
      const video = useNativeCamera ? videoRef.current : webcamRef.current?.video;
      
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        animationFrame = requestAnimationFrame(detectCard);
        return;
      }

      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (context) {
          canvas.width = 160;
          canvas.height = 120;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const centerData = context.getImageData(
            Math.floor(canvas.width * 0.25),
            Math.floor(canvas.height * 0.25),
            Math.floor(canvas.width * 0.5),
            Math.floor(canvas.height * 0.5)
          );
          
          let brightness = 0;
          const sampleSize = Math.min(centerData.data.length / 4, 500);
          
          for (let i = 0; i < sampleSize * 4; i += 20) {
            brightness += (centerData.data[i] + centerData.data[i + 1] + centerData.data[i + 2]) / 3;
          }
          brightness /= sampleSize;
          
          setLightLevel(brightness);
          setIsCardDetected(brightness > 60 && brightness < 240);
        }
      } catch (error) {
        // Silent error handling
      }
      
      animationFrame = requestAnimationFrame(detectCard);
    };

    detectCard();
    return () => cancelAnimationFrame(animationFrame);
  }, [isVideoReady, useNativeCamera]);

  const toggleCamera = useCallback(async () => {
    setIsFrontCamera(prev => !prev);
    setIsVideoReady(false);
    setIsInitializing(true);
  }, []);

  const retryCamera = useCallback(() => {
    setCameraError(null);
    setIsVideoReady(false);
    setIsInitializing(true);
    setRetryCount(0);
    setUseNativeCamera(false);
  }, []);

  const switchToNativeCamera = useCallback(() => {
    setUseNativeCamera(true);
    setCameraError(null);
    setIsVideoReady(false);
  }, []);

  const toggleFlash = useCallback(() => {
    const video = webcamRef.current?.video;
    if (video && video.srcObject) {
      const stream = video.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities() as any; // torch is not in TS types yet
      if (capabilities?.torch) {
        track.applyConstraints({
          advanced: [{ torch: !flashEnabled } as any], // torch is not in TS types yet
        });
        setFlashEnabled(!flashEnabled);
      } else {
        toast.error('Flash is not available on this device');
      }
    }
  }, [flashEnabled]);

  const captureImage = useCallback(async () => {
    try {
      if (!isVideoReady) {
        toast.error('Camera is still initializing. Please wait a moment.');
        return;
      }

      if (!isCardDetected) {
        toast.error('Please position ID card properly within the frame');
        return;
      }

      setIsCapturing(true);
      let imageSrc: string | null = null;
      
      if (useNativeCamera && videoRef.current && canvasRef.current) {
        // Capture from native video element
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        if (context) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0);
          imageSrc = canvas.toDataURL('image/jpeg', 0.95);
        }
      } else {
        // Capture from react-webcam
        imageSrc = webcamRef.current?.getScreenshot() || null;
      }
      
      if (!imageSrc) {
        throw new Error('Failed to capture image');
      }

      // Convert base64 to blob
      const response = await fetch(imageSrc);
      const blob = await response.blob();

      // Compress the image while maintaining high quality for ID documents
      new Compressor(blob, {
        quality: 0.92,           // High quality but not maximum to ensure compatibility
        maxWidth: 2560,         // Reasonable max width for mobile compatibility
        maxHeight: 1920,        // Reasonable max height for mobile compatibility
        mimeType: 'image/jpeg', // Explicitly set MIME type
        convertSize: 3000000,   // Only compress if file is larger than 3MB
        success: (compressedBlob) => {
          const file = new File([compressedBlob], `${side}-id.jpg`, {
            type: 'image/jpeg',
          });
          
          // Log the final image dimensions for debugging (development only)
          if (import.meta.env.DEV) {
            const img = new Image();
            img.onload = () => {
              console.log(`${side} ID captured at ${img.width}x${img.height} resolution`);
            };
            img.src = URL.createObjectURL(file);
          }
          
          onCapture(file);
          toast.success('ID captured successfully!');
        },
        error: (err) => {
          throw err;
        },
      });
    } catch (error) {
      toast.error('Failed to capture image. Please try again.');
      console.error('Capture error:', error);
    } finally {
      setIsCapturing(false);
    }
  }, [onCapture, side, isCardDetected, isVideoReady, useNativeCamera]);

  // Show initial guide for 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowGuide(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black"
    >
      {/* Camera View */}
      <div className="relative w-full h-full">
        {/* Error State */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white p-6 z-10">
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">Camera Error</h3>
            <p className="text-center mb-6 max-w-md">{cameraError}</p>
            <div className="flex gap-4">
              <button
                onClick={retryCamera}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
                Retry
              </button>
              {!useNativeCamera && (
                <button
                  onClick={switchToNativeCamera}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  Try Alternative
                </button>
              )}
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isInitializing && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white z-10">
            <Loader2 className="w-16 h-16 animate-spin mb-4" />
            <p className="text-lg">Initializing camera...</p>
            <p className="text-sm text-gray-400 mt-2">
              {useNativeCamera ? 'Using native camera' : 'Loading camera component'}
            </p>
          </div>
        )}

        {/* Native Video Element */}
        {useNativeCamera && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: isFrontCamera ? 'scaleX(-1)' : 'none' }}
          />
        )}

        {/* React Webcam Component */}
        {!useNativeCamera && (
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            screenshotQuality={1.0}
            videoConstraints={videoConstraints}
            className="w-full h-full object-cover"
            onUserMedia={handleWebcamReady}
            onUserMediaError={handleWebcamError}
          />
        )}

        {/* Hidden canvas for native camera capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* ID Card Frame */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            ref={frameRef}
            className={`relative w-[85%] max-w-lg aspect-[1.586] border-2 ${
              isCardDetected ? 'border-green-500' : 'border-white'
            } rounded-lg transition-colors duration-300`}
          >
            {/* Corner Markers */}
            <div className={`absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 ${
              isCardDetected ? 'border-green-500' : 'border-white'
            } rounded-tl-lg transition-colors duration-300`} />
            <div className={`absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 ${
              isCardDetected ? 'border-green-500' : 'border-white'
            } rounded-tr-lg transition-colors duration-300`} />
            <div className={`absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 ${
              isCardDetected ? 'border-green-500' : 'border-white'
            } rounded-bl-lg transition-colors duration-300`} />
            <div className={`absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 ${
              isCardDetected ? 'border-green-500' : 'border-white'
            } rounded-br-lg transition-colors duration-300`} />
          </motion.div>
        </div>

        {/* Initial Guide Overlay */}
        <AnimatePresence>
          {showGuide && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 flex items-center justify-center"
            >
              <div className="text-center text-white space-y-4 p-6">
                <h2 className="text-2xl font-bold">Capture Your ID</h2>
                <ul className="text-lg space-y-2">
                  <li>• Position your ID within the frame</li>
                  <li>• Ensure good lighting</li>
                  <li>• Hold steady until frame turns green</li>
                  <li>• Tap capture when ready</li>
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Bar */}
        {!cameraError && (
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="text-white text-sm font-medium px-4 py-2 bg-black/30 rounded-full">
              {isInitializing ? 'Initializing...' : 
               !isVideoReady ? 'Loading Camera...' : 
               isCardDetected ? 'ID Detected' : 'Position ID Card'}
            </div>
            <button
              onClick={toggleFlash}
              className="p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
            >
              {flashEnabled ? (
                <Zap className="w-6 h-6" />
              ) : (
                <ZapOff className="w-6 h-6" />
              )}
            </button>
          </div>
        )}

        {/* Camera Controls */}
        {!cameraError && (
          <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-t from-black/50 to-transparent">
            <button
              onClick={toggleCamera}
              disabled={isInitializing}
              className="p-3 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors disabled:opacity-50"
            >
              <FlipHorizontal className="w-6 h-6" />
            </button>

            <button
              onClick={captureImage}
              disabled={isCapturing || !isCardDetected || !isVideoReady || isInitializing}
              className={`p-5 rounded-full transition-all ${
                isCardDetected && isVideoReady && !isInitializing
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-white/30 cursor-not-allowed'
              }`}
            >
              {isCapturing ? (
                <Loader2 className="w-8 h-8 animate-spin text-white" />
              ) : (
                <Camera className="w-8 h-8 text-white" />
              )}
            </button>

            <div className="w-12" /> {/* Spacer for alignment */}
          </div>
        )}

        {/* Light Level Indicator */}
        {!cameraError && !isInitializing && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2">
            <div className="px-4 py-2 rounded-full bg-black/30 text-white text-sm">
              {!isVideoReady ? '📷 Camera Loading' : 
                lightLevel < 50 ? '📷 Too Dark' : 
                lightLevel > 240 ? '📷 Too Bright' : 
                '📷 Good Lighting'
              }
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default CameraCapture;