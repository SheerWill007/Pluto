import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { gsap } from 'gsap';

export const DocumentUpload = ({ onUploadSuccess }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadState, setUploadState] = useState('idle'); // 'idle', 'uploading', 'success', 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [fileName, setFileName] = useState('');

  const dropZoneRef = useRef(null);
  const rippleRef = useRef(null);
  const fileInputRef = useRef(null);

  const triggerRippleBurst = () => {
    if (!rippleRef.current) return;
    gsap.killTweensOf(rippleRef.current);
    gsap.fromTo(rippleRef.current,
      { scale: 0.05, opacity: 0.85 },
      { scale: 3.5, opacity: 0, duration: 1.2, ease: "power2.out" }
    );
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const uploadFile = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'txt', 'md', 'docx', 'csv', 'json'].includes(ext)) {
      setUploadState('error');
      setErrorMsg('Unsupported file format. Please upload PDF, TXT, MD, DOCX, CSV or JSON.');
      return;
    }

    setFileName(file.name);
    setUploadState('uploading');

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("https://atlasmultiagentsystem.onrender.com/api/v1/rag/ingest", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Upload process failed.");
      }
      
      const data = await response.json();
      setUploadState('success');
      triggerRippleBurst();
      if (onUploadSuccess) onUploadSuccess(data);
    } catch (err) {
      console.error(err);
      setUploadState('error');
      setErrorMsg(err.message || 'File ingestion failed.');
    }
  };

  return (
    <div
      ref={dropZoneRef}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      className={`relative w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all duration-300 overflow-hidden ${
        dragActive 
          ? 'border-beige-400 dark:border-beige-500 bg-beige-150/40 dark:bg-stone-800/40' 
          : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600 bg-white/40 dark:bg-stone-800/40'
      }`}
    >
      <div 
        ref={rippleRef}
        className="absolute pointer-events-none rounded-full bg-gradient-to-tr from-beige-300/10 to-beige-500/10 opacity-0"
        style={{ width: '400px', height: '400px', zIndex: 0 }}
      />

      <input
        ref={fileInputRef}
        type="file"
        multiple={false}
        onChange={handleChange}
        accept=".pdf,.txt,.md,.docx,.csv,.json"
        className="hidden"
      />

      <div className="relative z-10 flex flex-col items-center justify-center text-center">
        {uploadState === 'idle' && (
          <>
            <Upload className="h-10 w-10 text-stone-400 dark:text-stone-500 mb-3 animate-bounce" />
            <p className="text-sm font-bold text-stone-700 dark:text-stone-200 mb-1">
              Drag & drop document files here
            </p>
            <p className="text-xs text-stone-400 dark:text-stone-500 mb-4">
              Supports PDF, TXT, MD, DOCX or CSV up to 10MB
            </p>
            <button
              onClick={onButtonClick}
              className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-200/55 dark:hover:bg-stone-700 transition-all cursor-pointer"
            >
              Browse Local Files
            </button>
          </>
        )}

        {uploadState === 'uploading' && (
          <>
            <Loader2 className="h-10 w-10 text-beige-600 dark:text-beige-400 mb-3 animate-spin" />
            <p className="text-sm font-bold text-beige-700 dark:text-beige-300 mb-1">
              Ingesting & Chunking Document...
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-mono italic max-w-xs truncate">
              {fileName}
            </p>
          </>
        )}

        {uploadState === 'success' && (
          <>
            <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400 mb-3" />
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-1">
              Document Ingested Successfully!
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-mono truncate max-w-xs mb-4">
              {fileName}
            </p>
            <button
              onClick={() => setUploadState('idle')}
              className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all cursor-pointer"
            >
              Upload Another File
            </button>
          </>
        )}

        {uploadState === 'error' && (
          <>
            <AlertCircle className="h-10 w-10 text-rose-600 dark:text-rose-400 mb-3" />
            <p className="text-sm font-bold text-rose-700 dark:text-rose-300 mb-1">
              Failed to Upload Document
            </p>
            <p className="text-xs text-rose-600 dark:text-rose-400 max-w-xs mb-4">
              {errorMsg}
            </p>
            <button
              onClick={() => setUploadState('idle')}
              className="px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all cursor-pointer"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentUpload;
