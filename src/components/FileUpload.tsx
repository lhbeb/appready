import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CameraCapture from './CameraCapture';

interface FileUploadProps {
  onFileAccepted: (file: File) => void;
  side: 'front' | 'back';
  file: File | null;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileAccepted,
  side,
  file
}) => {
  const [showCamera, setShowCamera] = useState(false);

  if (showCamera) {
    return (
      <CameraCapture
        onCapture={(file) => {
          onFileAccepted(file);
          setShowCamera(false);
        }}
        onClose={() => setShowCamera(false)}
        side={side}
      />
    );
  }

  return (
    <div className="w-full">
      <AnimatePresence>
        {!file ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <button
              onClick={() => setShowCamera(true)}
              className="w-full h-[200px] flex flex-col items-center justify-center space-y-4 border-2 border-red-100 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
            >
              <Camera className="w-12 h-12" />
              <div className="text-center">
                <p className="font-medium">Capture {side} of ID</p>
                <p className="text-sm text-red-500 mt-1">Click to open camera</p>
              </div>
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="relative p-4 border rounded-lg bg-gray-50"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Camera className="w-5 h-5 text-gray-500" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">
                    {side} of ID captured
                  </p>
                  <p className="text-xs text-gray-500">
                    Click to retake photo
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCamera(true)}
                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                Retake
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileUpload;