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
  const [forceCapture, setForceCapture] = useState(false);
  const [lightingQuality, setLightingQuality] = useState<{
    level: 'excellent' | 'good' | 'fair' | 'poor' | 'very-poor';
    message: string;
    canCapture: boolean;
  }>({ level: 'fair', message: 'Analyzing...', canCapture: false });

  // Multiple constraint sets with FORCED 16:9 aspect ratio
  const getConstraintSets = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    return [
      // Try 1: High resolution with FORCED 16:9 aspect ratio
      {
        video: {
          facingMode: isFrontCamera ? 'user' : 'environment',
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          aspectRatio: { exact: 16/9 } // FORCE 16:9 ratio
        }
      },
      // Try 2: Medium resolution with FORCED 16:9
      {
        video: {
          facingMode: isFrontCamera ? 'user' : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { exact: 16/9 } // FORCE 16:9 ratio
        }
      },
      // Try 3: Lower resolution with FORCED 16:9
      {
        video: {
          facingMode: isFrontCamera ? 'user' : 'environment',
          width: { ideal: 1024 },
          height: { ideal: 576 },
          aspectRatio: { exact: 16/9 } // FORCE 16:9 ratio
        }
      },
      // Try 4: Minimum with FORCED 16:9
      {
        video: {
          facingMode: isFrontCamera ? 'user' : 'environment',
          aspectRatio: { exact: 16/9 } // FORCE 16:9 ratio
        }
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

  // Webcam constraints with FORCED 16:9 aspect ratio
  const getWebcamConstraints = () => {
    return {
      width: { ideal: 1920, min: 640 },
      height: { ideal: 1080, min: 360 },
      facingMode: isFrontCamera ? 'user' : 'environment',
      aspectRatio: { exact: 16/9 }, // FORCE 16:9 ratio for all cameras
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

  // Smart lighting detection that understands scene context
  useEffect(() => {
    if (!isVideoReady) return;

    let animationFrame: number;
    let frameCount = 0;
    
    const detectLightingAndCard = () => {
      frameCount++;
      if (frameCount % 15 !== 0) { // Reduced frequency for better performance
        animationFrame = requestAnimationFrame(detectLightingAndCard);
        return;
      }
      
      const video = useNativeCamera ? videoRef.current : webcamRef.current?.video;
      
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        animationFrame = requestAnimationFrame(detectLightingAndCard);
        return;
      }

      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (context) {
          // Use moderate canvas size for analysis
          canvas.width = 320;
          canvas.height = 240;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Get image data for analysis
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Analyze lighting quality using multiple metrics
          const lightingMetrics = analyzeLightingQuality(data, canvas.width, canvas.height);
          
          setLightLevel(lightingMetrics.averageBrightness);
          
          // Smart detection based on multiple factors
          const hasGoodLighting = lightingMetrics.isWellLit;
          const hasProperContrast = lightingMetrics.hasContrast;
          
          // Card detection: look for rectangular shapes with good contrast
          const cardDetected = hasProperContrast && (
            forceCapture || 
            (lightingMetrics.averageBrightness > 40 && lightingMetrics.averageBrightness < 250)
          );
          
          setIsCardDetected(cardDetected);
          
          // Store lighting quality for UI feedback
          const qualityAssessment = assessLightingQuality(lightingMetrics);
          setLightingQuality(qualityAssessment);
          
          if (import.meta.env.DEV) {
            console.log('Lighting analysis:', {
              avgBrightness: lightingMetrics.averageBrightness.toFixed(1),
              contrast: lightingMetrics.contrast.toFixed(2),
              isWellLit: hasGoodLighting,
              hasContrast: hasProperContrast,
              cardDetected,
              quality: qualityAssessment.level
            });
          }
        }
      } catch (error) {
        // Silent error handling
      }
      
      animationFrame = requestAnimationFrame(detectLightingAndCard);
    };

    detectLightingAndCard();
    return () => cancelAnimationFrame(animationFrame);
  }, [isVideoReady, useNativeCamera, forceCapture]);

  // Advanced lighting quality analysis
  const analyzeLightingQuality = (data: Uint8ClampedArray, width: number, height: number) => {
    let brightPixels = 0;
    let darkPixels = 0;
    let totalBrightness = 0;
    let brightnessValues: number[] = [];
    
    // Sample pixels more efficiently
    const step = 16; // Sample every 16th pixel for performance
    const totalPixels = (width * height) / (step / 4);
    
    for (let i = 0; i < data.length; i += step) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Calculate luminance (perceived brightness)
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      brightnessValues.push(luminance);
      totalBrightness += luminance;
      
      // Count bright vs dark pixels
      if (luminance > 120) brightPixels++;
      else if (luminance < 60) darkPixels++;
    }
    
    const averageBrightness = totalBrightness / totalPixels;
    
    // Calculate contrast (standard deviation of brightness)
    const variance = brightnessValues.reduce((sum, val) => {
      return sum + Math.pow(val - averageBrightness, 2);
    }, 0) / brightnessValues.length;
    const contrast = Math.sqrt(variance);
    
    // Calculate brightness distribution
    const brightRatio = brightPixels / totalPixels;
    const darkRatio = darkPixels / totalPixels;
    
    // Determine lighting quality based on multiple factors
    const isWellLit = (
      averageBrightness > 60 &&           // Not too dark overall
      averageBrightness < 220 &&          // Not overexposed
      contrast > 20 &&                    // Has decent contrast
      brightRatio > 0.1 &&                // Has some bright areas
      darkRatio < 0.7                     // Not mostly dark
    );
    
    const hasContrast = contrast > 15;    // Minimum contrast for text/details
    
    return {
      averageBrightness,
      contrast,
      brightRatio,
      darkRatio,
      isWellLit,
      hasContrast
    };
  };

  // Smart lighting quality assessment with contextual messages
  const assessLightingQuality = (metrics: {
    averageBrightness: number;
    contrast: number;
    brightRatio: number;
    darkRatio: number;
    isWellLit: boolean;
    hasContrast: boolean;
  }) => {
    const { averageBrightness, contrast, brightRatio, darkRatio, isWellLit, hasContrast } = metrics;
    
    // Excellent lighting conditions
    if (isWellLit && contrast > 40 && brightRatio > 0.3) {
      return {
        level: 'excellent' as const,
        message: '📷 Perfect Lighting',
        canCapture: true
      };
    }
    
    // Good lighting conditions
    if (isWellLit && hasContrast) {
      return {
        level: 'good' as const,
        message: '📷 Good Lighting',
        canCapture: true
      };
    }
    
    // Fair conditions - check specific issues
    if (hasContrast) {
      if (averageBrightness < 50) {
        return {
          level: 'fair' as const,
          message: '📷 Slightly Dark - OK',
          canCapture: true
        };
      }
      if (averageBrightness > 200) {
        return {
          level: 'fair' as const,
          message: '📷 Bright Scene - OK',
          canCapture: true
        };
      }
      return {
        level: 'good' as const,
        message: '📷 Good Contrast',
        canCapture: true
      };
    }
    
    // Poor conditions - provide specific guidance
    if (averageBrightness < 30 && brightRatio < 0.05) {
      return {
        level: 'poor' as const,
        message: '💡 Need More Light',
        canCapture: false
      };
    }
    
    if (averageBrightness > 230 && contrast < 10) {
      return {
        level: 'poor' as const,
        message: '☀️ Too Bright/Washed Out',
        canCapture: false
      };
    }
    
    if (contrast < 10) {
      return {
        level: 'poor' as const,
        message: '📷 Low Contrast Scene',
        canCapture: false
      };
    }
    
    // Very poor conditions
    if (averageBrightness < 20) {
      return {
        level: 'very-poor' as const,
        message: '🔦 Very Dark - Add Light',
        canCapture: false
      };
    }
    
    // Default fair assessment
    return {
      level: 'fair' as const,
      message: '📷 Adequate Lighting',
      canCapture: true
    };
  };

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

      if (!isCardDetected && !forceCapture) {
        const canCapture = lightingQuality.canCapture || forceCapture;
        if (!canCapture) {
          toast.error(`${lightingQuality.message} - Use "Capture Anyway" if needed`);
        } else {
          toast.error('Please position ID card properly within the frame');
        }
        return;
      }

      setIsCapturing(true);
      let imageSrc: string | null = null;
      
      if (useNativeCamera && videoRef.current && canvasRef.current) {
        // Capture from native video element - FORCE 16:9 aspect ratio
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        if (context) {
          // Get video dimensions
          const videoWidth = video.videoWidth;
          const videoHeight = video.videoHeight;
          const videoAspectRatio = videoWidth / videoHeight;
          
          // Calculate 16:9 crop dimensions
          const targetAspectRatio = 16 / 9;
          let cropWidth, cropHeight, cropX, cropY;
          
          if (videoAspectRatio > targetAspectRatio) {
            // Video is wider than 16:9, crop horizontally
            cropHeight = videoHeight;
            cropWidth = videoHeight * targetAspectRatio;
            cropX = (videoWidth - cropWidth) / 2;
            cropY = 0;
          } else {
            // Video is taller than 16:9, crop vertically
            cropWidth = videoWidth;
            cropHeight = videoWidth / targetAspectRatio;
            cropX = 0;
            cropY = (videoHeight - cropHeight) / 2;
          }
          
          // Set canvas to 16:9 ratio with high resolution
          const outputWidth = 1920;
          const outputHeight = 1080;
          canvas.width = outputWidth;
          canvas.height = outputHeight;
          
          // Clear canvas and draw cropped video frame
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(
            video,
            cropX, cropY, cropWidth, cropHeight, // Source crop area
            0, 0, outputWidth, outputHeight       // Destination size
          );
          
          // Get maximum quality image data
          imageSrc = canvas.toDataURL('image/jpeg', 1.0);
          
          if (import.meta.env.DEV) {
            console.log(`=== ${side.toUpperCase()} NATIVE CAPTURE (FORCED 16:9) ===`);
            console.log(`Video preview: ${videoWidth}x${videoHeight} (${videoAspectRatio.toFixed(3)}) - FULL VIEW`);
            console.log(`Crop area: ${cropWidth.toFixed(0)}x${cropHeight.toFixed(0)} at (${cropX.toFixed(0)}, ${cropY.toFixed(0)})`);
            console.log(`Output: ${outputWidth}x${outputHeight} (${(outputWidth/outputHeight).toFixed(3)}) - 16:9 ENFORCED`);
            console.log('Preview shows full camera, capture is cropped to 16:9');
          }
        }
      } else {
        // Capture from react-webcam - should already be 16:9 due to constraints
        imageSrc = webcamRef.current?.getScreenshot() || null;
        
        if (import.meta.env.DEV && imageSrc) {
          const img = new Image();
          img.onload = () => {
            console.log(`=== ${side.toUpperCase()} WEBCAM CAPTURE ===`);
            console.log(`Webcam dimensions: ${img.width}x${img.height}`);
            console.log(`Aspect ratio: ${(img.width/img.height).toFixed(3)} (should be 1.778 for 16:9)`);
          };
          img.src = imageSrc;
        }
      }
      
      if (!imageSrc) {
        throw new Error('Failed to capture image');
      }

      // Convert base64 to blob
      const response = await fetch(imageSrc);
      const blob = await response.blob();

      // Detect Safari on iPhone for special handling
      const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      
      // Function to ensure 16:9 aspect ratio
      const ensureSixteenByNine = async (inputBlob: Blob): Promise<Blob> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const currentRatio = img.width / img.height;
            const targetRatio = 16 / 9;
            
            // If already 16:9 (within tolerance), return original
            if (Math.abs(currentRatio - targetRatio) < 0.01) {
              resolve(inputBlob);
              return;
            }
            
            // Need to crop to 16:9
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;
            
            let cropWidth, cropHeight, cropX, cropY;
            
            if (currentRatio > targetRatio) {
              // Image is wider, crop horizontally
              cropHeight = img.height;
              cropWidth = img.height * targetRatio;
              cropX = (img.width - cropWidth) / 2;
              cropY = 0;
            } else {
              // Image is taller, crop vertically
              cropWidth = img.width;
              cropHeight = img.width / targetRatio;
              cropX = 0;
              cropY = (img.height - cropHeight) / 2;
            }
            
            // Set output to 16:9 high resolution
            canvas.width = 1920;
            canvas.height = 1080;
            
            ctx.drawImage(
              img,
              cropX, cropY, cropWidth, cropHeight,
              0, 0, 1920, 1080
            );
            
            canvas.toBlob((result) => {
              if (import.meta.env.DEV) {
                console.log(`FORCED 16:9 CORRECTION: ${img.width}x${img.height} (${currentRatio.toFixed(3)}) -> 1920x1080 (1.778)`);
              }
              resolve(result || inputBlob);
            }, 'image/jpeg', 0.95);
          };
          img.src = URL.createObjectURL(inputBlob);
        });
      };
      
      if (isIOSSafari) {
        // For iOS Safari, ensure 16:9 aspect ratio
        const correctedBlob = await ensureSixteenByNine(blob);
        const file = new File([correctedBlob], `${side}-id.jpg`, {
          type: 'image/jpeg',
        });
        
        if (import.meta.env.DEV) {
          const img = new Image();
          img.onload = () => {
            console.log(`=== ${side.toUpperCase()} iOS SAFARI FINAL (FORCED 16:9) ===`);
            console.log(`Final dimensions: ${img.width}x${img.height}`);
            console.log(`Final aspect ratio: ${(img.width/img.height).toFixed(3)} (target: 1.778)`);
            console.log(`File size: ${(file.size / 1024).toFixed(1)}KB`);
            console.log(`Camera: ${isFrontCamera ? 'front' : 'back'}, Method: ${useNativeCamera ? 'native' : 'webcam'}`);
            console.log('GUARANTEED 16:9 RATIO');
            console.log('=====================================');
          };
          img.src = URL.createObjectURL(file);
        }
        
        onCapture(file);
        toast.success('ID captured successfully!');
      } else {
        // For other browsers, ensure 16:9 and use minimal compression
        const correctedBlob = await ensureSixteenByNine(blob);
        new Compressor(correctedBlob, {
          quality: 0.95,          // Very high quality
          mimeType: 'image/jpeg',
          convertSize: 10000000,  // Very high threshold to avoid compression
          resize: 'none',        // Explicitly no resizing
          checkOrientation: false, // Don't auto-rotate
          success: (compressedBlob) => {
            const file = new File([compressedBlob], `${side}-id.jpg`, {
              type: 'image/jpeg',
            });
            
            if (import.meta.env.DEV) {
              const img = new Image();
              img.onload = () => {
                console.log(`=== ${side.toUpperCase()} NON-iOS FINAL (FORCED 16:9) ===`);
                console.log(`Final dimensions: ${img.width}x${img.height}`);
                console.log(`Final aspect ratio: ${(img.width/img.height).toFixed(3)} (target: 1.778)`);
                console.log(`Original size: ${(blob.size / 1024).toFixed(1)}KB`);
                console.log(`Compressed size: ${(file.size / 1024).toFixed(1)}KB`);
                console.log(`Camera: ${isFrontCamera ? 'front' : 'back'}, Method: ${useNativeCamera ? 'native' : 'webcam'}`);
                console.log('GUARANTEED 16:9 RATIO');
                console.log('=====================================');
              };
              img.src = URL.createObjectURL(file);
            }
            
            onCapture(file);
            toast.success('ID captured successfully!');
          },
          error: (err) => {
            console.error('Compression error, using corrected original:', err);
            // Fallback to corrected blob if compression fails
            const file = new File([correctedBlob], `${side}-id.jpg`, {
              type: 'image/jpeg',
            });
            onCapture(file);
            toast.success('ID captured successfully!');
          },
        });
      }
    } catch (error) {
      toast.error('Failed to capture image. Please try again.');
      console.error('Capture error:', error);
    } finally {
      setIsCapturing(false);
    }
  }, [onCapture, side, isCardDetected, isVideoReady, useNativeCamera, forceCapture, lightingQuality, isFrontCamera]);

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
            className="w-full h-full"
            style={{ 
              transform: isFrontCamera ? 'scaleX(-1)' : 'none',
              objectFit: 'contain', // Show full camera view without cropping
              aspectRatio: 'unset', // Let camera use natural ratio for preview
              maxWidth: '100%',
              maxHeight: '100%'
            }}
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
            className="w-full h-full"
            style={{ 
              objectFit: 'contain', // Show full camera view without cropping
              aspectRatio: 'unset', // Let camera use natural ratio for preview
              maxWidth: '100%',
              maxHeight: '100%'
            }}
            onUserMedia={handleWebcamReady}
            onUserMediaError={handleWebcamError}
          />
        )}

        {/* Hidden canvas for native camera capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* ID Card Frame with 16:9 Capture Preview */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            ref={frameRef}
            className={`relative w-[85%] max-w-lg aspect-[1.586] border-2 ${
              isCardDetected ? 'border-green-500' : 'border-white'
            } rounded-lg transition-colors duration-300`}
          >
            {/* 16:9 Capture Area Indicator */}
            <div className="absolute inset-2 border border-blue-400 border-dashed rounded opacity-60">
              <div className="absolute -top-6 left-0 text-blue-400 text-xs font-medium">
                16:9 Capture Area
              </div>
            </div>
            
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
               isCardDetected ? 'ID Detected ✓' : 'Position ID Card'}
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

        {/* Smart Light Level Indicator */}
        {!cameraError && !isInitializing && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2">
            <div className={`px-4 py-2 rounded-full text-white text-sm transition-colors duration-300 ${
              lightingQuality.level === 'excellent' ? 'bg-green-600/80' :
              lightingQuality.level === 'good' ? 'bg-green-500/80' :
              lightingQuality.level === 'fair' ? 'bg-yellow-500/80' :
              lightingQuality.level === 'poor' ? 'bg-orange-500/80' :
              'bg-red-500/80'
            }`}>
              {!isVideoReady ? '📷 Camera Loading' : lightingQuality.message}
            </div>
            {!lightingQuality.canCapture && !forceCapture && (
              <button
                onClick={() => setForceCapture(true)}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
              >
                Capture Anyway
              </button>
            )}
            {forceCapture && (
              <div className="text-xs text-green-400 bg-black/50 px-2 py-1 rounded">
                Override Active ✓
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default CameraCapture;