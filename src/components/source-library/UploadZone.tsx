import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Video, Music, Link, Type, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Source, SourceType } from '@/types';

interface UploadZoneProps {
  onUpload: (source: Omit<Source, 'id' | 'uploadedAt'>) => void;
}

export function UploadZone({ onUpload }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const getFileType = (file: File): SourceType => {
    if (file.type.includes('pdf')) return 'pdf';
    if (file.type.includes('video')) return 'video';
    if (file.type.includes('audio')) return 'audio';
    if (file.type.includes('image')) return 'image';
    return 'text';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    files.forEach((file) => {
      onUpload({
        name: file.name,
        type: getFileType(file),
        enabled: true,
        status: 'processing',
        size: file.size,
      });
    });
  }, [onUpload]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        onUpload({
          name: file.name,
          type: getFileType(file),
          enabled: true,
          status: 'processing',
          size: file.size,
        });
      });
    }
  };

  const handleYoutubeSubmit = () => {
    if (youtubeUrl) {
      const videoId = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1];
      onUpload({
        name: `YouTube: ${videoId || youtubeUrl}`,
        type: 'youtube',
        enabled: true,
        status: 'processing',
      });
      setYoutubeUrl('');
      setDialogOpen(false);
    }
  };

  const handleTextSubmit = () => {
    if (textContent) {
      onUpload({
        name: textTitle || 'Pasted Text',
        type: 'text',
        enabled: true,
        status: 'processing',
        size: textContent.length,
      });
      setTextContent('');
      setTextTitle('');
      setDialogOpen(false);
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
        }`}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <input
          type="file"
          multiple
          accept=".pdf,.mp4,.mp3,.wav,.jpg,.jpeg,.png,.webp"
          onChange={handleFileSelect}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
        <AnimatePresence mode="wait">
          {isDragging ? (
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
            <Button variant="outline" size="sm" className="justify-start gap-2 border-border bg-card/50 hover:bg-card">
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
                <Button onClick={handleYoutubeSubmit} className="w-full">
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
                <Button onClick={handleTextSubmit} className="w-full">
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
        >
          <Type className="h-4 w-4" />
          Paste Text
        </Button>
      </div>
    </div>
  );
}
