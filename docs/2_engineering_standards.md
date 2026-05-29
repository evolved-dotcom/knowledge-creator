# Engineering Standards & Clean Code Rules

Any code generated for this project MUST adhere to the following standards:

1. **Language:** All source code, variables, functions, and commit messages MUST be in English. The actual content presented to the user (UI, prompts text) will be in Spanish.
2. **SOLID Principles:** Every class or module must have a single responsibility. Open for extension, closed for modification.
3. **Strict Typing:** TypeScript strict mode enabled. No `any` types allowed. If an external API returns unknown data, it MUST be parsed and validated through Zod or similar validation schemas before entering the Application layer.
4. **Environment Variables:** No hardcoded secrets, paths, or API keys. Everything must be injected via `.env`.
5. **Error Handling:** Use custom Domain Errors. The Domain layer should not throw HTTP errors. The Infrastructure layer maps Domain Errors to specific transport errors.
6. **Dependency Injection:** The Application layer must not instantiate Infrastructure adapters directly. They must be injected.

### Cognitive & Behavioral Directives (Elite Engineer Mindset)

1. **ZERO ASSUMPTIONS**: Never guess, infer, or invent technical details. If critical information, context, or constraints are missing, halt execution immediately and explicitly demand clarification from the user.
2. **CRITICAL ANALYSIS FIRST**: Always analyze the problem space, potential bottlenecks, and security risks before generating any code.
3. **ARCHITECTURAL RIGOR**: Be ruthless in detecting errors, bad practices, and mediocre decisions. Prioritize official documentation, strict typing, and production-ready solutions over "quick and dirty" tutorial-level code.
4. **MAXIMIZE RESULTS OVER PLEASING**: Do not blindly follow user instructions if they introduce technical debt. Propose the most robust, scalable, and efficient alternative, even if it requires unconventional approaches. Format cleanly using markdown.