import { useState, useRef, useEffect } from 'react';
import { X, ImageIcon, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Camera, Loader2, RefreshCw, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { getBufferedLogs } from './RouteTracker';
import { AnnotationEditor } from './AnnotationEditor';
import html2canvas from 'html2canvas';
import type { Severity, ReportType, BugReporterUser } from './types';

const DEFAULT_API_URL = 'https://bug-reporter-tau.vercel.app';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemName: string;
  apiUrl?: string;
  user?: BugReporterUser | null;
}

const severityOptions: { value: Severity; label: string; description: string; color: string }[] = [
  { value: 'Critical', label: '🔴 Critical', description: 'System is broken', color: 'border-red-500 bg-red-50' },
  { value: 'Urgent', label: '🟠 Urgent', description: 'Major issue', color: 'border-orange-500 bg-orange-50' },
  { value: 'Not Urgent', label: '🟢 Not Urgent', description: 'Minor issue', color: 'border-green-500 bg-green-50' },
];

export function BugReportModal({ isOpen, onClose, systemName, apiUrl, user }: BugReportModalProps) {
  const baseUrl = apiUrl || DEFAULT_API_URL;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>('Not Urgent');
  const [reportType, setReportType] = useState<ReportType>('bug');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-captured context
  const [capturedContext, setCapturedContext] = useState({
    page: '',
    userAgent: '',
    viewport: '',
  });

  // Capture context when modal opens
  useEffect(() => {
    if (isOpen) {
      setCapturedContext({
        page: window.location.href,
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      });
    }
  }, [isOpen]);

  // ── Screenshot Capture: Native (getDisplayMedia) ──
  const handleNativeCapture = async () => {
    setCapturing(true);
    setIsHiding(true);

    await new Promise(r => setTimeout(r, 300));

    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { displaySurface: 'browser' },
        audio: false,
        preferCurrentTab: true,
      });

      const video = document.createElement('video');
      video.srcObject = stream;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => {
          video.play().then(resolve).catch(reject);
        };
        setTimeout(() => reject(new Error('Video timeout')), 5000);
      });

      await new Promise(r => setTimeout(r, 100));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      video.remove();

      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      setScreenshot(dataUrl);
      setImage(null);
      setImagePreview(null);
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        // User cancelled — do nothing
      } else {
        console.warn('Native capture failed, trying legacy fallback...');
        await handleLegacyCapture();
      }
    } finally {
      setIsHiding(false);
      setCapturing(false);
    }
  };

  // ── Screenshot Capture: Legacy (html2canvas fallback) ──
  const handleLegacyCapture = async () => {
    setCapturing(true);
    setIsHiding(true);
    await new Promise(r => setTimeout(r, 300));

    try {
      await document.fonts.ready;
      const canvas = await html2canvas(document.body, {
        logging: false,
        useCORS: true,
        allowTaint: true,
        scale: 1,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc: Document) => {
          const overlays = clonedDoc.querySelectorAll('[class*="z-[999"]');
          overlays.forEach(el => ((el as HTMLElement).style.display = 'none'));
        },
      });

      setScreenshot(canvas.toDataURL('image/jpeg', 0.6));
      setImage(null);
      setImagePreview(null);
    } catch (error) {
      console.error('Legacy capture failed:', error);
      setErrorMessage('Screenshot capture failed. You can still upload manually.');
    } finally {
      setIsHiding(false);
      setCapturing(false);
    }
  };

  const handleImageSelect = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image must be under 5MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Only image files are allowed');
      return;
    }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    setScreenshot(null);
    setErrorMessage('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageSelect(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    setImage(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSeverity('Not Urgent');
    setReportType('bug');
    removeScreenshot();
    setSubmitStatus('idle');
    setErrorMessage('');
    setShowDetails(false);
    setShowAnnotationEditor(false);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setErrorMessage('Please provide a title');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const logs = getBufferedLogs();

      const finalScreenshot = screenshot;

      const reportPayload: Record<string, any> = {
        message: description || title,
        title,
        description,
        severity,
        type: reportType,
        page: capturedContext.page,
        userAgent: capturedContext.userAgent,
        viewport: capturedContext.viewport,
        logs,
        reportedBy: user ? {
          name: user.name,
          email: user.email,
          role: user.role,
          userId: user.id,
        } : undefined,
      };

      if (finalScreenshot) {
        reportPayload.screenshot = finalScreenshot;
      }

      if (image && !finalScreenshot) {
        const formData = new FormData();
        formData.append('screenshot', image);
        Object.entries(reportPayload).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          if (typeof value === 'object') {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, String(value));
          }
        });

        const response = await fetch(`${baseUrl}/api/bugs/${systemName}/report`, {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) throw new Error('Failed to submit bug report');
      } else {
        const response = await fetch(`${baseUrl}/api/bugs/${systemName}/report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reportPayload),
        });
        if (!response.ok) throw new Error('Failed to submit bug report');
      }

      setSubmitStatus('success');
      setTimeout(() => {
        resetForm();
        onClose();
      }, 1500);
    } catch (err) {
      setSubmitStatus('error');
      setErrorMessage('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  // ── Full-screen Annotation Editor ──
  if (showAnnotationEditor && screenshot) {
    return (
      <>
        <div className="fixed inset-0 bg-black/50 z-[9998]" />
        <div className="fixed inset-4 z-[9999] bg-background rounded-xl overflow-hidden shadow-2xl border border-border">
          <AnnotationEditor
            imageSrc={screenshot}
            onSave={(annotatedImage) => {
              setScreenshot(annotatedImage);
              setShowAnnotationEditor(false);
            }}
            onCancel={() => setShowAnnotationEditor(false)}
          />
        </div>
      </>
    );
  }

  const hasScreenshot = !!screenshot || !!imagePreview;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-[9998] transition-opacity duration-200",
          isHiding && "opacity-0 pointer-events-none"
        )}
        onClick={handleClose}
      />

      {/* Modal */}
      <div className={cn(
        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-full max-w-md transition-opacity duration-200",
        isHiding && "opacity-0 pointer-events-none"
      )}>
        <div className="bg-background border border-border rounded-lg shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background z-10">
            <h2 className="text-lg font-semibold text-foreground">
              {reportType === 'bug' ? '🐛 Report a Bug' : '💡 Feature Request'}
            </h2>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Success State */}
          {submitStatus === 'success' ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 mx-auto mb-4 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-foreground">
                {reportType === 'bug' ? 'Bug reported!' : 'Feature requested!'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Thank you for your feedback</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Type Toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReportType('bug')}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors border",
                    reportType === 'bug'
                      ? "bg-red-50 border-red-300 text-red-700"
                      : "bg-background border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  🐛 Bug
                </button>
                <button
                  type="button"
                  onClick={() => setReportType('feature')}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors border",
                    reportType === 'feature'
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-background border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  💡 Feature
                </button>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="bug-title" className="text-sm font-medium">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="bug-title"
                  placeholder={reportType === 'bug' ? "What's broken?" : "What would you like?"}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-sm"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="bug-description" className="text-sm font-medium">
                  Description
                </Label>
                <Textarea
                  id="bug-description"
                  placeholder={reportType === 'bug' ? "Describe what went wrong..." : "Describe the feature in detail..."}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[80px] text-sm resize-none"
                />
              </div>

              {/* Screenshot Capture + Upload */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Screenshot</Label>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={handleNativeCapture}
                    disabled={capturing}
                  >
                    {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    <span className="truncate">{hasScreenshot ? 'Retake' : 'Capture Tab'}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    title="Legacy capture (if tab capture fails)"
                    className="px-2 text-muted-foreground hover:text-foreground"
                    onClick={handleLegacyCapture}
                    disabled={capturing}
                  >
                    <RefreshCw className={cn("w-4 h-4", capturing && "animate-spin")} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={capturing}
                  >
                    <ImageIcon className="w-4 h-4" />
                    Upload
                  </Button>
                </div>

                {/* Screenshot Preview */}
                {(screenshot || imagePreview) && (
                  <div className="space-y-1.5">
                    <div className="relative mt-1 rounded-lg border overflow-hidden bg-muted">
                      <img
                        src={screenshot || imagePreview || ''}
                        alt="Captured"
                        className="w-full"
                      />
                      <div className="absolute top-2 right-2 flex gap-1">
                        {screenshot && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs gap-1.5 shadow-sm"
                            onClick={() => setShowAnnotationEditor(true)}
                          >
                            <Pencil className="h-3 w-3" />
                            Annotate
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          className="h-7 w-7 shadow-sm"
                          onClick={removeScreenshot}
                          title="Remove screenshot"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {screenshot && (
                      <p className="text-[10px] text-muted-foreground text-center">
                        Click 'Annotate' to highlight issues on the screenshot
                      </p>
                    )}
                  </div>
                )}

                {/* Drag & drop fallback */}
                {!screenshot && !imagePreview && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-3 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                  >
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <ImageIcon className="h-5 w-5" />
                      <span className="text-xs">Or drag & drop an image</span>
                    </div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Severity */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Severity</Label>
                <RadioGroup value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
                  <div className="grid grid-cols-3 gap-2">
                    {severityOptions.map((option) => (
                      <label
                        key={option.value}
                        className={cn(
                          "flex flex-col items-center p-2 rounded-lg border cursor-pointer transition-colors",
                          severity === option.value
                            ? option.color
                            : "border-border hover:border-muted-foreground/50"
                        )}
                      >
                        <RadioGroupItem value={option.value} className="sr-only" />
                        <span className="text-xs font-medium">{option.label}</span>
                        <span className="text-[10px] text-muted-foreground">{option.description}</span>
                      </label>
                    ))}
                  </div>
                </RadioGroup>
              </div>

              {/* Auto-Captured Context (collapsible) */}
              <div className="border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors bg-muted/30"
                >
                  <span>📎 Auto-captured context</span>
                  {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {showDetails && (
                  <div className="px-3 py-2 space-y-1.5 text-xs text-muted-foreground border-t border-border bg-muted/10">
                    {user && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground/70 shrink-0">User:</span>
                        <span className="truncate">{user.name} ({user.email}){user.role ? ` · ${user.role}` : ''}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <span className="text-muted-foreground/70 shrink-0">Page:</span>
                      <span className="truncate">{capturedContext.page}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground/70 shrink-0">Browser:</span>
                      <span className="truncate">{capturedContext.userAgent}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground/70 shrink-0">Viewport:</span>
                      <span>{capturedContext.viewport}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground/70 shrink-0">Console:</span>
                      <span>{getBufferedLogs().length} log entries captured</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Error */}
              {errorMessage && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {errorMessage}
                </div>
              )}

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  "w-full",
                  reportType === 'feature' && "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {isSubmitting ? 'Submitting...' : reportType === 'bug' ? 'Submit Bug Report' : 'Submit Feature Request'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
