# Project Architecture & Domain

## The Vision
We are building an automated content factory and an accompanying MVP platform. The core system orchestrates LLMs (Gemini) to generate dark, philosophical concepts (aphorisms, historical facts) and triggers a local ComfyUI/FLUX rendering engine to produce accompanying visual assets (Reels).

## Macro-Architecture (The 3 Nodes)
1. **The Generator Engine (Backend):** A headless Node.js orchestrator that fetches text from LLMs, transforms it into image prompts, commands the local ComfyUI server, and saves the final assets.
2. **The Persistence Layer (BaaS):** Supabase (PostgreSQL + S3 Storage) acting as the single source of truth for prompts, texts, and generated images.
3. **The Presentation Layer (Frontend/Mobile):** A Nuxt 3 web application (MVP/Landing) and a mobile application (Flutter or Nuxt/Ionic) to showcase the content.

## Micro-Architecture: Backend (Strict Hexagonal)
The Node.js backend MUST adhere strictly to Hexagonal Architecture (Ports and Adapters).
- **Domain:** Pure business logic (Entities like Reel, Prompt, Story). No external dependencies.
- **Application (Use Cases):** Orchestrates the flow (e.g., GenerateReelUseCase). Depends only on Domain and interfaces (Ports).
- **Infrastructure (Adapters):** External connections implementing the Ports. Examples: `GeminiLLMAdapter`, `ComfyUIRenderAdapter`, `SupabaseRepository`.

## Tech Stack
- Backend: Node.js, TypeScript, Pydantic/Zod for validation.
- Database: Supabase (PostgreSQL + Storage).
- Frontend: Nuxt 3, Vue 3 (Composition API), TailwindCSS.