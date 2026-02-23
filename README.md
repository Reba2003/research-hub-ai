# StudyTimeAI | Your Premium AI Research Partner

StudyTimeAI is a sophisticated, multimodal research platform designed for deep document analysis and automated study content generation. It features a minimalist SaaS aesthetic inspired by Linear and Raycast.

## Key Features

- **Multimodal Source Library**: Upload and analyze PDFs, MP4s, MP3s, Images, and YouTube URLs.
- **3-Column Professional Layout**: Seamlessly navigate between your Source Library, AI Chat, and the Output Engine.
- **Intelligent Citations**: Clickable chips that link directly to PDF page numbers, video timestamps, or YouTube segments.
- **Automated Output Engine**: Generate structured Summaries, conversational Podcast scripts, and interactive Quizzes.

## Integrated AI Models

This project utilizes a tri-model strategy to balance speed, reasoning, and multimodal depth:
- **Google Gemini 2.0 Flash**: Powers multimodal analysis for diagrams, video, and audio.
- **OpenAI GPT-4o/o1**: Utilized for high-fidelity reasoning and complex text extraction.
- **DeepSeek-V3/R1**: Integrated for cost-effective, high-speed logical processing and coding tasks.

## Tech Stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Framer Motion.
- **UI Components**: shadcn/ui, Lucide Icons.
- **Backend & Database**: Supabase (Auth, Storage, Edge Functions).
- **Automation**: n8n workflows for vector upserting and document processing.
