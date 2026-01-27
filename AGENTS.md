# AGENTS.md - AI Coding Agent Guidelines

Guidelines for AI coding agents working in the Angor Hub codebase.

## Build, Lint, and Test Commands

```bash
npm install          # Install dependencies
npm start            # Dev server at localhost:4200
npm run build        # Production build
npm run lint         # Run ESLint
npm test             # Run all tests

# Run a single test file
ng test --include=**/filename.spec.ts
# Example: ng test --include=**/nostr-auth.service.spec.ts
```

## Tech Stack

- **Framework**: Angular 21 (standalone components, signals)
- **Styling**: TailwindCSS 3.x with CSS custom properties
- **Testing**: Karma + Jasmine
- **Linting**: ESLint 9.x with Angular and TypeScript plugins
- **Key deps**: `@nostr-dev-kit/ndk`, `nostr-tools`, `nostr-login`, `rxjs`, `ngx-markdown`

## Code Style Guidelines

### Angular Patterns (CRITICAL)

1. **Always use Signals** for reactive state:
   ```typescript
   isLoading = signal<boolean>(false);
   items = signal<Item[]>([]);
   filteredItems = computed(() => this.items().filter(i => i.active));
   ```

2. **Use modern control flow** (`@if`, `@for`, `@let`) - NOT `*ngIf`/`*ngFor`:
   ```html
   @if (isLoading()) {
     <app-spinner />
   }
   @for (item of items(); track item.id) {
     <app-item [data]="item" />
   }
   ```

3. **Use `inject()` for DI** - NOT constructor injection:
   ```typescript
   private router = inject(Router);
   private http = inject(HttpClient);
   ```

4. **Standalone components only** - no NgModules

### TypeScript Patterns

- **async/await** over raw Promises
- **Strict typing** - avoid `any`, provide explicit types
- **Single quotes** for strings
- **2-space indentation**
- **ES2022** target with bundler module resolution

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | kebab-case selector, `app-` prefix | `app-header` |
| Directives | camelCase selector, `app` prefix | `appHighlight` |
| Services | PascalCase, `.service.ts` suffix | `RelayService` |
| Pipes | PascalCase, `.pipe.ts` suffix | `AgoPipe` |
| Interfaces | PascalCase | `ProjectUpdate` |
| Signals | camelCase | `isLoading` |
| Files | kebab-case | `explore-state.service.ts` |

### File Organization

```
src/app/
├── components/     # Shared/reusable components
├── pages/          # Route page components
├── services/       # Injectable services (providedIn: 'root')
├── pipes/          # Custom pipes (standalone)
├── models/         # TypeScript interfaces
├── app.routes.ts   # Route definitions
└── app.config.ts   # App configuration
```

### Error Handling

```typescript
// Services - try/catch, log errors, rethrow
async fetchData(): Promise<void> {
  try {
    const data = await this.api.get();
    this.data.set(data);
  } catch (error) {
    console.error('Failed to fetch data:', error);
    throw error;
  }
}

// Components - handle gracefully with user feedback
async loadProjects(): Promise<void> {
  try {
    this.loading.set(true);
    await this.indexer.fetchProjects();
  } catch (error) {
    this.error.set('Failed to load projects');
    console.error('Error loading projects:', error);
  } finally {
    this.loading.set(false);
  }
}
```

### TailwindCSS Custom Colors

Use these CSS variable-based colors:
- **Text**: `text-text`, `text-text-secondary`, `text-accent`
- **Backgrounds**: `bg-surface-card`, `bg-surface-ground`, `bg-surface-hover`
- **Borders**: `border-border`
- **Header**: `bg-header-bg`, `text-header-text`
- **Bitcoin**: `text-bitcoin-mainnet`, `text-bitcoin-testnet`
- **Status**: `text-success`, `text-warning`

## Testing

- Test files: `*.spec.ts` alongside source files
- Use `TestBed.configureTestingModule()` with `teardown: { destroyAfterEach: true }`
- Use `fakeAsync` + `flushMicrotasks` for async tests
- Mock external deps: `localStorage`, `window.nostr`, etc.

```typescript
describe('MyService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    (window as any).nostr = undefined;
    TestBed.configureTestingModule({ teardown: { destroyAfterEach: true } });
  });

  it('should work', fakeAsync(() => {
    const service = TestBed.inject(MyService);
    flushMicrotasks();
    expect(service.value()).toBe(expected);
  }));
});
```

## ESLint Rules

**Errors** (must fix):
- `@angular-eslint/component-selector`: kebab-case with `app-` prefix
- `@angular-eslint/directive-selector`: camelCase with `app` prefix

**Warnings** (fix when possible):
- `@typescript-eslint/no-unused-vars`, `no-explicit-any`, `no-empty-function`
- `@angular-eslint/prefer-inject`
- `@angular-eslint/template/click-events-have-key-events`
- `@angular-eslint/template/interactive-supports-focus`

## Quick Reference

| Task | Command |
|------|---------|
| Dev server | `npm start` |
| Production build | `npm run build` |
| Run all tests | `npm test` |
| Run single test | `ng test --include=**/file.spec.ts` |
| Lint | `npm run lint` |
| Generate component | `ng generate component components/name` |
| Generate service | `ng generate service services/name` |
