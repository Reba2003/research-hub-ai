import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Link, Type, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { uploadFile, getFileType } from '@/lib/storage';
import { createSource } from '@/lib/api';
import { toast } from 'sonner';
import type { Source, SourceType } from '@/types';

interface UploadZoneProps {
  onUpload: (source: Source) => void;
}

export function UploadZone({ onUpload }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { user } = useAuth();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const getMimeFileType = (file: File): SourceType => {
    if (file.type.includes('pdf')) return 'pdf';
    if (file.type.includes('video')) return 'video';
    if (file.type.includes('audio')) return 'audio';
    if (file.type.includes('image')) return 'image';
    return 'text';
  };

  const handleFileUpload = async (files: File[]) => {
    if (!user) {
      toast.error('Please sign in to upload files');
      return;
    }

    setIsUploading(true);

    for (const file of files) {
      try {
        // Check file type
        const storageType = getFileType(file.type);
        if (!storageType) {
          toast.error(`Unsupported file type: ${file.name}`);
          continue;
        }

        // Upload to storage
        const uploadResult = await uploadFile(file, user.id);
        if (!uploadResult) {
          toast.error(`Failed to upload: ${file.name}`);
          continue;
        }

        // Create source record in database
        const source = await createSource({
          name: file.name,
          type: uploadResult.fileType,
          file_url: uploadResult.fileUrl,
          file_path: uploadResult.filePath,
          size: file.size,
        });

        if (source) {
          onUpload(source);
          toast.success(`Uploaded: ${file.name}`);
        }
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(`Failed to upload: ${file.name}`);
      }
    }

    setIsUploading(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFileUpload(files);
  }, [user]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      handleFileUpload(Array.from(files));
    }
  };

  const handleYoutubeSubmit = async () => {
    if (!user) {
      toast.error('Please sign in to add sources');
      return;
    }

    if (youtubeUrl) {
      setIsUploading(true);
      try {
        const videoId = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1];
        const source = await createSource({
          name: `YouTube: ${videoId || 'Video'}`,
          type: 'youtube',
          file_url: youtubeUrl,
          metadata: { videoId },
        });

        if (source) {
          onUpload(source);
          toast.success('YouTube video added');
        }
        setYoutubeUrl('');
        setDialogOpen(false);
      } catch (error) {
        console.error('YouTube add error:', error);
        toast.error('Failed to add YouTube video');
      }
      setIsUploading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!user) {
      toast.error('Please sign in to add sources');
      return;
    }

    if (textContent) {
      setIsUploading(true);
      try {
        const source = await createSource({
          name: textTitle || 'Pasted Text',
          type: 'text',
          size: textContent.length,
          metadata: { content: textContent },
        });

        if (source) {
          onUpload(source);
          toast.success('Text added');
        }
        setTextContent('');
        setTextTitle('');
        setDialogOpen(false);
      } catch (error) {
        console.error('Text add error:', error);
        toast.error('Failed to add text');
      }
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <motion.label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all ${
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-border bg-card/50 hover:border-primary/50 hover:bg-card'
        } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
        whileHover={!isUploading ? { scale: 1.01 } : undefined}
        whileTap={!isUploading ? { scale: 0.99 } : undefined}
      >
        <input
          type="file"
          multiple
          accept=".pdf,.mp4,.mp3,.wav,.jpg,.jpeg,.png,.webp"
          onChange={handleFileSelect}
          className="absolute inset-0 cursor-pointer opacity-0"
          disabled={isUploading}
        />
        <AnimatePresence mode="wait">
          {isUploading ? (
            <motion.div
              key="uploading"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center"
            >
              <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-primary">Uploading...</p>
            </motion.div>
          ) : isDragging ? (
            <motion.div
              key="dragging"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center"
            >
              <Upload className="mb-2 h-8 w-8 text-primary" />
              <p className="text-sm font-medium text-primary">Drop files here</p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center"
            >
              <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Drop files or click to upload</p>
              <p className="mt-1 text-xs text-muted-foreground">PDF, Video, Audio, Images</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.label>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="justify-start gap-2 border-border bg-card/50 hover:bg-card" disabled={isUploading}>
              <Link className="h-4 w-4" />
              YouTube URL
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-card">
            <DialogHeader>
              <DialogTitle>Add Source</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="youtube" className="mt-4">
              <TabsList className="grid w-full grid-cols-2 bg-secondary">
                <TabsTrigger value="youtube" className="data-[state=active]:bg-card">
                  <Link className="mr-2 h-4 w-4" />
                  YouTube
                </TabsTrigger>
                <TabsTrigger value="text" className="data-[state=active]:bg-card">
                  <Type className="mr-2 h-4 w-4" />
                  Text
                </TabsTrigger>
              </TabsList>
              <TabsContent value="youtube" className="mt-4 space-y-4">
                <Input
                  placeholder="https://youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="border-border bg-secondary"
                />
                <Button onClick={handleYoutubeSubmit} className="w-full" disabled={isUploading}>
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Add Video
                </Button>
              </TabsContent>
              <TabsContent value="text" className="mt-4 space-y-4">
                <Input
                  placeholder="Title (optional)"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  className="border-border bg-secondary"
                />
                <Textarea
                  placeholder="Paste your text content here..."
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={6}
                  className="border-border bg-secondary"
                />
                <Button onClick={handleTextSubmit} className="w-full" disabled={isUploading}>
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Add Text
                </Button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        <Button
          variant="outline"
          size="sm"
          className="justify-start gap-2 border-border bg-card/50 hover:bg-card"
          onClick={() => setDialogOpen(true)}
          disabled={isUploading}
        >
          <Type className="h-4 w-4" />
          Paste Text
        </Button>
      </div>
    </div>
  );
}
