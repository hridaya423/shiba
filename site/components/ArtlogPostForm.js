import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { uploadMiscFile } from './utils/uploadMiscFile';

const ArtlogPostForm = forwardRef(({ 
  onSubmit, 
  onCancel, 
  postContent, 
  setPostContent,
  isPosting,
  setIsPosting,
  setPostMessage 
}, ref) => {
  const [timelapseFile, setTimelapseFile] = useState(null);
  const [githubImageLink, setGithubImageLink] = useState('');
  const [timeScreenshotFile, setTimeScreenshotFile] = useState(null);
  const [hoursSpent, setHoursSpent] = useState(0);
  const [minutesSpent, setMinutesSpent] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [errors, setErrors] = useState({});

  // File input refs
  const timelapseFileInputRef = useRef(null);
  const timeScreenshotInputRef = useRef(null);

  const clearFileInputs = () => {
    setTimelapseFile(null);
    setTimeScreenshotFile(null);
    setUploadedFiles({});
    setUploadProgress({});
    setErrors({});
  };

  const uploadFileToS3 = async (file, fileType) => {
    const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
    
    setUploadProgress(prev => ({ ...prev, [fileKey]: 0 }));
    
    try {
      const result = await uploadMiscFile({ file });
      
      if (result.ok) {
        setUploadedFiles(prev => ({ 
          ...prev, 
          [fileType]: { fileKey, url: result.url, fileId: result.fileId } 
        }));
        setUploadProgress(prev => ({ ...prev, [fileKey]: 100 }));
      } else {
        setUploadProgress(prev => ({ ...prev, [fileKey]: -1 }));
        throw new Error(result.error);
      }
    } catch (error) {
      setUploadProgress(prev => ({ ...prev, [fileKey]: -1 }));
      throw error;
    }
  };

  // Function to validate form and get data
  const getFormData = () => {
    setErrors({});
    
    // Validate required fields
    if (!postContent.trim()) {
      setErrors({ content: 'Description is required' });
      return null;
    }
    if (!timelapseFile) {
      setErrors({ timelapse: 'Timelapse video is required' });
      return null;
    }
    if (!githubImageLink.trim()) {
      setErrors({ github: 'GitHub image link is required' });
      return null;
    }
    if (!timeScreenshotFile) {
      setErrors({ screenshot: 'Time screenshot is required' });
      return null;
    }
    if (hoursSpent === 0 && minutesSpent === 0) {
      setErrors({ time: 'Please specify time spent' });
      return null;
    }

    // Return validated data
    return {
      postType: 'artlog',
      content: postContent.trim(),
      timelapseVideoId: uploadedFiles.timelapse?.url,
      githubImageLink: githubImageLink.trim(),
      timeScreenshotId: uploadedFiles.screenshot?.url,
      hoursSpent: parseInt(hoursSpent),
      minutesSpent: parseInt(minutesSpent)
    };
  };

  // Expose the validation function to parent component
  useImperativeHandle(ref, () => ({
    getFormData,
    isValid: () => {
      // Only validate if we're actually in artlog mode and have all required fields
      // AND ensure hours spent is greater than 0
      return postContent.trim() && 
             timelapseFile && 
             githubImageLink.trim() && 
             timeScreenshotFile && 
             (hoursSpent > 0 || minutesSpent > 0) &&
             uploadedFiles.timelapse && 
             uploadedFiles.screenshot;
    }
  }), [postContent, timelapseFile, githubImageLink, timeScreenshotFile, hoursSpent, minutesSpent, uploadedFiles]);

  return (
    <div className="artlog-form">
      <div className="moments-footer">
        {/* Timelapse Video Upload */}
        <input
          ref={timelapseFileInputRef}
          type="file"
          accept=".mp4,.mov"
          style={{ display: "none" }}
          onChange={async (e) => {
            const file = (e.target.files && e.target.files[0]) || null;
            if (file) {
              // Validate file type
              const validTypes = ["video/mp4", "video/quicktime"];
              if (!validTypes.includes(file.type)) {
                alert("❌ Invalid file format! Please select an MP4 or MOV file.");
                e.target.value = "";
                return;
              }
              
              // Validate file size (50MB limit)
              if (file.size > 50 * 1024 * 1024) {
                alert("❌ File too large! Please select a file under 50MB.");
                e.target.value = "";
                return;
              }
              
              setTimelapseFile(file);
              await uploadFileToS3(file, 'timelapse');
            }
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="moments-attach-btn"
          onClick={() => timelapseFileInputRef.current?.click()}
        >
          {timelapseFile
            ? `Timelapse: ${timelapseFile.name}`
            : "Upload Timelapse Video (.mp4/.mov)"}
        </button>

        {/* GitHub Image Link */}
        <div className="github-link-input">
          <input
            type="url"
            placeholder="Link to asset in Github repo"
            value={githubImageLink}
            onChange={(e) => setGithubImageLink(e.target.value)}
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: "8px",
              fontSize: "12px"
            }}
          />
        </div>

        {/* Time Screenshot Upload */}
        <input
          ref={timeScreenshotInputRef}
          type="file"
          accept="image/*,.png,.jpg,.jpeg"
          style={{ display: "none" }}
          onChange={async (e) => {
            const file = (e.target.files && e.target.files[0]) || null;
            if (file) {
              // Validate file type
              const validTypes = ["image/"];
              if (!validTypes.some(type => file.type.startsWith(type))) {
                alert("❌ Invalid file format! Please select an image file.");
                e.target.value = "";
                return;
              }
              
              setTimeScreenshotFile(file);
              await uploadFileToS3(file, 'screenshot');
            }
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="moments-attach-btn"
          onClick={() => timeScreenshotInputRef.current?.click()}
        >
          {timeScreenshotFile
            ? `Screenshot: ${timeScreenshotFile.name}`
            : "Upload Time Screenshot"}
        </button>

        {/* Time Spent Input */}
        <div className="time-spent-inputs">
          <input
            type="number"
            min="0"
            placeholder="Hours"
            value={hoursSpent}
            onChange={(e) => setHoursSpent(e.target.value)}
            style={{
              width: "60px",
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "14px",
              textAlign: "center"
            }}
          />
          <span style={{ color: "#666", fontSize: "14px" }}>h</span>
          <input
            type="number"
            min="0"
            max="59"
            placeholder="Min"
            value={minutesSpent}
            onChange={(e) => setMinutesSpent(e.target.value)}
            style={{
              width: "60px",
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "14px",
              textAlign: "center"
            }}
          />
          <span style={{ color: "#666", fontSize: "14px" }}>m</span>
        </div>
        
        {/* Time validation helper */}
        {(hoursSpent === 0 && minutesSpent === 0) && (
          <div style={{ 
            fontSize: "11px", 
            color: "#d32f2f", 
            fontStyle: "italic",
            marginTop: "4px"
          }}>
            ⚠️ You must specify time spent to create an artlog
          </div>
        )}
        

      </div>

      {/* File Previews */}
      {(timelapseFile || timeScreenshotFile) && (
        <div className="moments-previews">
          {/* Timelapse Preview */}
          {timelapseFile && (
            <div className="moments-preview-item">
              <video
                src={uploadedFiles.timelapse?.url || URL.createObjectURL(timelapseFile)}
                className="moments-preview-media"
                muted
                playsInline
              />
              {uploadProgress[`${timelapseFile.name}-${timelapseFile.size}-${timelapseFile.lastModified}`] === -1 && (
                <div className="upload-error-overlay">
                  <span>❌ Upload Failed</span>
                </div>
              )}
              <button
                type="button"
                className="moments-remove-btn"
                title="Remove"
                onClick={() => {
                  setTimelapseFile(null);
                  setUploadedFiles(prev => {
                    const newFiles = { ...prev };
                    delete newFiles.timelapse;
                    return newFiles;
                  });
                }}
              >
                ×
              </button>
            </div>
          )}

          {/* Screenshot Preview */}
          {timeScreenshotFile && (
            <div className="moments-preview-item">
              <img
                src={uploadedFiles.screenshot?.url || URL.createObjectURL(timeScreenshotFile)}
                alt="Time screenshot"
                className="moments-preview-media"
              />
              {uploadProgress[`${timeScreenshotFile.name}-${timeScreenshotFile.size}-${timeScreenshotFile.lastModified}`] === -1 && (
                <div className="upload-error-overlay">
                  <span>❌ Upload Failed</span>
                </div>
              )}
              <button
                type="button"
                className="moments-remove-btn"
                title="Remove"
                onClick={() => {
                  setTimeScreenshotFile(null);
                  setUploadedFiles(prev => {
                    const newFiles = { ...prev };
                    delete newFiles.screenshot;
                    return newFiles;
                  });
                }}
              >
                ×
              </button>
            </div>
          )}

        </div>
      )}

      {/* Error Display */}
      {Object.keys(errors).length > 0 && (
        <div className="error-messages">
          {Object.entries(errors).map(([field, message]) => (
            <div key={field} className="error-message">
              ❌ {message}
            </div>
          ))}
        </div>
      )}



      <style jsx>{`
        .artlog-form {
          /* No additional margin since it's nested in the devlog form */
        }
        
        .moments-footer {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 16px;
          align-items: center;
          /* No padding since parent devlog form already has padding */
        }
        
        .moments-attach-btn {
          appearance: none;
          border: 1px solid rgba(0, 0, 0, 0.18);
          background: rgba(255, 255, 255, 0.75);
          color: rgba(0, 0, 0, 0.8);
          border-radius: 8px;
          padding: 8px 10px;
          cursor: pointer;
          font-weight: 600;
          font-size: 12px;
        }
        
        .github-link-input {
          flex: 1;
          min-width: 200px;
        }
        
        .time-spent-inputs {
          display: flex;
          align-items: center;
          gap: 8px;
          /* No padding since parent devlog form already has padding */
        }
        
        .moments-previews {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          flex-wrap: wrap;
          /* No padding since parent devlog form already has padding */
        }
        
        .moments-preview-item {
          position: relative;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #ddd;
        }
        
        .moments-preview-media {
          width: 120px;
          height: 120px;
          object-fit: cover;
        }
        
        .moments-remove-btn {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 24px;
          height: 24px;
          background: rgba(255, 0, 0, 0.8);
          color: white;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
        }
        
        .upload-error-overlay {
          position: absolute;
          inset: 0;
          background: rgba(255, 0, 0, 0.8);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
        }
        
        .error-messages {
          margin-bottom: 16px;
          /* No padding since parent devlog form already has padding */
        }
        
        .error-message {
          color: #d32f2f;
          font-size: 14px;
          margin-bottom: 4px;
          padding: 8px 12px;
          background: rgba(255, 0, 0, 0.1);
          border-radius: 4px;
          border: 1px solid rgba(255, 0, 0, 0.3);
        }
        

      `}</style>
    </div>
  );
});

export default ArtlogPostForm;
