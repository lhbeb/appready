import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, X, Zap, ZapOff, FlipHorizontal, Loader2 } from 'lucide-react';
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
  const frameRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(false);
  const [lightLevel, setLightLevel] = useState(0);
  const [isCardDetected, setIsCardDetected] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [isVideoReady, setIsVideoReady] = useState(false);

  // Progressive fallback for camera constraints to ensure compatibility
  const getVideoConstraints = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    if (isIOS && isSafari) {
      // Conservative constraints for iOS Safari
      return {
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        facingMode: isFrontCamera ? 'user' : 'environment',
      };
    } else {
      // Higher resolution for other browsers/devices
      return {
        width: { ideal: 2560, min: 1920 },
        height: { ideal: 1440, min: 1080 },
        facingMode: isFrontCamera ? 'user' : 'environment',
      };
    }
  };

  const videoConstraints = getVideoConstraints();

  // Handle video stream ready state
  useEffect(() => {
    const video = webcamRef.current?.video;
    if (!video) return;

    const handleLoadedMetadata = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setIsVideoReady(true);
        
        // Log camera resolution for debugging (development only)
        if (import.meta.env.DEV) {
          console.log(`Camera stream resolution: ${video.videoWidth}x${video.videoHeight}`);
        }
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    // Check if video is already ready
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  // Simplified card detection and light monitoring
  useEffect(() => {
    if (!isVideoReady) return;

    let animationFrame: number;
    let frameCount = 0;
    
    const detectCard = () => {
      // Only run detection every 10 frames to reduce CPU load
      frameCount++;
      if (frameCount % 10 !== 0) {
        animationFrame = requestAnimationFrame(detectCard);
        return;
      }
      
      const video = webcamRef.current?.video;
      
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        animationFrame = requestAnimationFrame(detectCard);
        return;
      }

      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (context) {
          // Use smaller canvas for faster processing
          canvas.width = 320;
          canvas.height = 240;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Get sample pixels from center region
          const centerData = context.getImageData(
            Math.floor(canvas.width * 0.3),
            Math.floor(canvas.height * 0.3),
            Math.floor(canvas.width * 0.4),
            Math.floor(canvas.height * 0.4)
          );
          
          // Calculate average brightness from sample
          let brightness = 0;
          const sampleSize = Math.min(centerData.data.length / 4, 1000); // Limit sample size
          
          for (let i = 0; i < sampleSize * 4; i += 16) { // Sample every 4th pixel
            brightness += (centerData.data[i] + centerData.data[i + 1] + centerData.data[i + 2]) / 3;
          }
          brightness /= sampleSize;
          
          setLightLevel(brightness);
          setIsCardDetected(brightness > 80 && brightness < 250); // More lenient detection
        }
      } catch (error) {
        // Silently handle errors to avoid console spam
        if (import.meta.env.DEV) {
          console.warn('Frame processing error:', error);
        }
      }
      
      animationFrame = requestAnimationFrame(detectCard);
    };

    detectCard();
    return () => cancelAnimationFrame(animationFrame);
  }, [isVideoReady]);

  const toggleCamera = useCallback(async () => {
    setIsFrontCamera(prev => !prev);
    setIsVideoReady(false); // Reset video ready state when switching cameras
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
      const imageSrc = webcamRef.current?.getScreenshot();
      
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
  }, [onCapture, side, isCardDetected]);

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
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          screenshotQuality={1.0}  // Maximum screenshot quality
          videoConstraints={videoConstraints}
          className="w-full h-full object-cover"
          onUserMedia={(stream) => {
            setIsVideoReady(true);
            // Log stream info when camera starts (development only)
            if (import.meta.env.DEV) {
              const videoTrack = stream.getVideoTracks()[0];
              if (videoTrack) {
                console.log('Video track constraints applied:', videoTrack.getConstraints());
                console.log('Video track settings:', videoTrack.getSettings());
              }
            }
            
            // Try to optimize resolution after successful stream initialization
            setTimeout(() => {
              const videoTrack = stream.getVideoTracks()[0];
              if (videoTrack) {
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                
                // Apply higher resolution if not iOS Safari
                if (!(isIOS && isSafari)) {
                  videoTrack.applyConstraints({
                    width: { ideal: 3840 },
                    height: { ideal: 2160 }
                  }).catch(err => {
                    if (import.meta.env.DEV) {
                      console.log('Could not apply higher resolution:', err);
                    }
                  });
                }
              }
            }, 500);
          }}
          onUserMediaError={(error) => {
            console.error('Camera error:', error);
            setIsVideoReady(false);
            
            const errorName = typeof error === 'string' ? error : (error as any)?.name || 'Unknown';
            
            if (errorName === 'NotAllowedError') {
              toast.error('Camera permission denied. Please allow camera access and try again.');
            } else if (errorName === 'NotFoundError') {
              toast.error('No camera found. Please check your device.');
            } else if (errorName === 'OverconstrainedError') {
              toast.error('Camera constraints not supported. Trying with lower resolution...');
              // The component will re-render with fallback constraints
            } else {
              toast.error('Failed to access camera. Please try again.');
            }
          }}
        />

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
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="text-white text-sm font-medium px-4 py-2 bg-black/30 rounded-full">
            {!isVideoReady ? 'Initializing Camera...' : isCardDetected ? 'ID Detected' : 'Position ID Card'}
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

        {/* Camera Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-t from-black/50 to-transparent">
          <button
            onClick={toggleCamera}
            className="p-3 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
          >
            <FlipHorizontal className="w-6 h-6" />
          </button>

          <button
            onClick={captureImage}
            disabled={isCapturing || !isCardDetected || !isVideoReady}
            className={`p-5 rounded-full transition-all ${
              isCardDetected && isVideoReady
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

        {/* Light Level Indicator */}
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2">
          <div className="px-4 py-2 rounded-full bg-black/30 text-white text-sm">
            {!isVideoReady ? '📷 Camera Initializing' : 
              lightLevel < 50 ? '📷 Too Dark' : 
              lightLevel > 240 ? '📷 Too Bright' : 
              '📷 Good Lighting'
            }
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CameraCapture;