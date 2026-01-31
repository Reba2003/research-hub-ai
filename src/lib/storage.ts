import { supabase } from '@/integrations/supabase/client';

export type AllowedFileType = 'pdf' | 'video' | 'audio' | 'image';

const MIME_TYPE_MAP: Record<string, AllowedFileType> = {
  'application/pdf': 'pdf',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
};

export function getFileType(mimeType: string): AllowedFileType | null {
  return MIME_TYPE_MAP[mimeType] || null;
}

export async function uploadFile(file: File, userId: string): Promise<{
  filePath: string;
  fileUrl: string;
  fileType: AllowedFileType;
} | null> {
  const fileType = getFileType(file.type);
  if (!fileType) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('sources')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw uploadError;
  }

  const { data: { publicUrl } } = supabase.storage
    .from('sources')
    .getPublicUrl(filePath);

  // For private buckets, we need to create a signed URL
  const { data: signedUrlData } = await supabase.storage
    .from('sources')
    .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days

  return {
    filePath,
    fileUrl: signedUrlData?.signedUrl || publicUrl,
    fileType,
  };
}

export async function deleteFile(filePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from('sources')
    .remove([filePath]);

  if (error) {
    console.error('Delete error:', error);
    throw error;
  }
}
