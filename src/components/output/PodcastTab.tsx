import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Play, Pause, SkipBack, SkipForward, Volume2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateOutput } from '@/lib/api';
import { useResearchStore } from '@/hooks/useResearchStore';
import { toast } from 'sonner';
import type { PodcastScript } from '@/types';

interface PodcastTabProps {
  podcast: PodcastScript | null;
}

export function PodcastTab({ podcast }: PodcastTabProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { sources, setPodcast } = useResearchStore();
  const enabledSources = sources.filter((s) => s.enabled && s.status === 'ready');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState([75]);

  const handleGenerate = async () => {
    if (enabledSources.length === 0) {
      toast.error('No ready sources available. Upload and process sources first.');
      return;
    }
    setIsGenerating(true);
    try {
      const sourceIds = enabledSources.map(s => s.id);
      const result = await generateOutput('podcast', sourceIds);

      if (result?.script) {
        const script = result.script;
        setPodcast({
          id: result.output_id || crypto.randomUUID(),
          title: script.title || 'Research Podcast',
          duration: script.segments?.reduce((max: number, s: { timestamp: number }) => Math.max(max, s.timestamp + 30), 0) || 300,
          segments: (script.segments || []).map((s: { speaker: string; content: string; timestamp: number }, i: number) => ({
            id: `seg-${i}`,
            speaker: s.speaker,
            content: s.content,
            timestamp: s.timestamp,
          })),
        });
        toast.success('Podcast script generated!');
      }
    } catch (error) {
      console.error('Generate podcast error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate podcast');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!podcast) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Mic className="h-8 w-8 text-primary" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">Generate Podcast</h3>
        <p className="mb-6 max-w-sm text-sm text-muted-foreground">
          Create an AI-generated podcast discussion from your sources.
        </p>
        <Button onClick={handleGenerate} disabled={isGenerating || enabledSources.length === 0} className="gap-2">
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              Generate Podcast
            </>
          )}
        </Button>
        {enabledSources.length === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">Upload sources first</p>
        )}
      </div>
    );
  }

  const displayPodcast = podcast;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const duration = displayPodcast.duration || 480;
  const progress = (currentTime / duration) * 100;

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{displayPodcast.title}</h3>
              <p className="text-xs text-muted-foreground">
                AI-generated discussion • {formatTime(duration)}
              </p>
            </div>
          </motion.div>

          {/* Script */}
          <div className="space-y-3">
            {displayPodcast.segments.map((segment, index) => (
              <motion.div
                key={segment.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-xl p-4 ${
                  segment.speaker === 'host'
                    ? 'bg-card border border-border'
                    : 'bg-primary/5 border border-primary/20'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className={`text-xs font-medium ${
                    segment.speaker === 'host' ? 'text-muted-foreground' : 'text-primary'
                  }`}>
                    {segment.speaker === 'host' ? 'Host' : 'Expert'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(segment.timestamp)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground">
                  {segment.content}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Audio Player */}
      <div className="border-t border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{formatTime(currentTime)}</span>
          <Slider
            value={[progress]}
            onValueChange={([val]) => setCurrentTime((val / 100) * duration)}
            max={100}
            step={0.1}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={volume}
              onValueChange={setVolume}
              max={100}
              className="w-20"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="h-11 w-11"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="w-24" />
        </div>
      </div>
    </div>
  );
}
