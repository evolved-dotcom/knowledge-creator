# Engineering Standards & Clean Code Rules

Any code generated for this project MUST adhere to the following standards:

1. **Language:** All source code, variables, functions, and commit messages MUST be in English. The actual content presented to the user (UI, prompts text) will be in Spanish.
2. **SOLID Principles:** Every class or module must have a single responsibility. Open for extension, closed for modification.
3. **Strict Typing:** TypeScript strict mode enabled. No `any` types allowed. If an external API returns unknown data, it MUST be parsed and validated through Zod or similar validation schemas before entering the Application layer.
4. **Environment Variables:** No hardcoded secrets, paths, or API keys. Everything must be injected via `.env`.
5. **Error Handling:** Use custom Domain Errors. The Domain layer should not throw HTTP errors. The Infrastructure layer maps Domain Errors to specific transport errors.
6. **Dependency Injection:** The Application layer must not instantiate Infrastructure adapters directly. They must be injected.