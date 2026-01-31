-- 1. SETUP EXTENSIONS (The AI Engine)
-- pgvector allows us to store and search embeddings for RAG
-- pgcrypto provides cryptographic functions for secure IDs
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. CREATE CORE TABLES
-- User Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sources (The Library)
CREATE TABLE public.sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'video', 'audio', 'image', 'youtube', 'text')),
  file_url TEXT,
  file_path TEXT,
  size BIGINT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'error')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- THE RAG TABLE: This stores the text chunks and their "AI vectors"
-- Note: vector(768) is optimized for Gemini 2.0 Flash embeddings
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID REFERENCES public.sources(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL, 
  metadata JSONB, -- Stores page_number or timestamp for pinpoint citations
  embedding vector(768) 
);

-- Chat History
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]', -- Stores the clickable cyan chip data
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Analysis Outputs
CREATE TABLE public.outputs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('summary', 'podcast', 'quiz')),
  content JSONB NOT NULL DEFAULT '{}',
  audio_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. ENABLE SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outputs ENABLE ROW LEVEL SECURITY;

-- Create Policies (Only users can see/touch their own data)
CREATE POLICY "Profile Access" ON public.profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Source Access" ON public.sources FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Document Access" ON public.documents FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Message Access" ON public.messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Output Access" ON public.outputs FOR ALL USING (auth.uid() = user_id);

-- 4. AUTOMATION TRIGGERS
-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, split_part(NEW.email, '@', 1));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. STORAGE CONFIGURATION
-- Ensure the bucket exists and is private
INSERT INTO storage.buckets (id, name, public) 
VALUES ('sources', 'sources', false) 
ON CONFLICT (id) DO NOTHING;

-- Storage Policies: Path-based security
CREATE POLICY "Users can manage their own files" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'sources' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 6. ENABLE REALTIME for status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.sources;
ALTER PUBLICATION supabase_realtime ADD TABLE public.outputs;