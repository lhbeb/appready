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

  const videoConstraints = {
    width: { ideal: 3840 }, // 4K
    height: { ideal: 2160 },
    facingMode: isFrontCamera ? 'user' : 'environment',
    aspectRatio: 16/9,
    advanced: [
      {
        exposureMode: 'continuous',
        focusMode: 'continuous',
        whiteBalanceMode: 'continuous',
      },
    ],
  };

  // Handle video stream ready state
  useEffect(() => {
    const video = webcamRef.current?.video;
    if (!video) return;

    const handleLoadedMetadata = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setIsVideoReady(true);
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    // Check if video is already ready
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      setIsVideoReady(true);
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  // Simulate ID card detection based on light levels and motion
  useEffect(() => {
    if (!isVideoReady) return;

    let animationFrame: number;
    const detectCard = () => {
      const video = webcamRef.current?.video;
      
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        animationFrame = requestAnimationFrame(detectCard);
        return;
      }

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        try {
          context.drawImage(video, 0, 0);
          
          // Get the center region of the frame
          const centerData = context.getImageData(
            Math.floor(canvas.width * 0.25),
            Math.floor(canvas.height * 0.25),
            Math.floor(canvas.width * 0.5),
            Math.floor(canvas.height * 0.5)
          );
          
          // Calculate average brightness
          let brightness = 0;
          for (let i = 0; i < centerData.data.length; i += 4) {
            brightness += (centerData.data[i] + centerData.data[i + 1] + centerData.data[i + 2]) / 3;
          }
          brightness /= (centerData.data.length / 4);
          
          setLightLevel(brightness);
          setIsCardDetected(brightness > 100 && brightness < 240); // Detect card based on reasonable light levels
        } catch (error) {
          console.error('Error processing video frame:', error);
        }
      }
      
      animationFrame = requestAnimationFrame(detectCard);
    };

    detectCard();
    return () => cancelAnimationFrame(animationFrame);
  }, [isVideoReady]);

  const toggleCamera = useCallback(() => {
    setIsFrontCamera(prev => !prev);
    setIsVideoReady(false); // Reset video ready state when switching cameras
  }, []);

  const toggleFlash = useCallback(() => {
    const track = webcamRef.current?.video?.srcObject?.getVideoTracks()[0];
    if (track?.getCapabilities().torch) {
      track.applyConstraints({
        advanced: [{ torch: !flashEnabled }],
      });
      setFlashEnabled(!flashEnabled);
    } else {
      toast.error('Flash is not available on this device');
    }
  }, [flashEnabled]);

  const captureImage = useCallback(async () => {
    try {
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

      // Compress the image while maintaining quality
      new Compressor(blob, {
        quality: 0.9,
        maxWidth: 3840,
        maxHeight: 2160,
        success: (compressedBlob) => {
          const file = new File([compressedBlob], `${side}-id.jpg`, {
            type: 'image/jpeg',
          });
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
          videoConstraints={videoConstraints}
          className="w-full h-full object-cover"
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