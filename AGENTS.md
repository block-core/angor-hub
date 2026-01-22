# AGENTS.md - AI Coding Agent Guidelines

This document provides guidelines for AI coding agents working in the Angor Hub codebase.

## Build, Lint, and Test Commands

```bash
# Install dependencies
npm install

# Development server (http://localhost:4200)
npm start

# Production build
npm run build

# Run linter (ESLint)
npm run lint

# Run all tests
npm test

# Run a single test file
ng test --include=**/filename.spec.ts

# Example: Run only the nostr-auth service tests
ng test --include=**/nostr-auth.service.spec.ts
```

## Tech Stack

- **Framework**: Angular 21 (standalone components, signals)
- **Styling**: TailwindCSS 3.x with CSS custom properties
- **Testing**: Karma + Jasmine
- **Linting**: ESLint with Angular and TypeScript plugins
- **Build**: Angular CLI with esbuild

### Key Dependencies
- `@nostr-dev-kit/ndk` - Nostr Development Kit
- `nostr-tools` - Nostr protocol utilities
- `nostr-login` - Authentication via Nostr
- `rxjs` - Reactive extensions
- `marked` / `ngx-markdown` - Markdown rendering

## Code Style Guidelines

### Angular Patterns (CRITICAL)

1. **Use Signals and Effects** - Always use Angular signals for reactive state:
   ```typescript
   // Correct
   isLoading = signal<boolean>(false);
   items = signal<Item[]>([]);
   filteredItems = computed(() => this.items().filter(i => i.active));

   // Incorrect - avoid traditional properties for reactive state
   isLoading = false;
   ```

2. **Use Modern Control Flow Syntax** - Use `@if`, `@for`, `@let` instead of structural directives:
   ```html
   <!-- Correct -->
   @if (isLoading()) {
     <app-spinner />
   }
   @for (item of items(); track item.id) {
     <app-item [data]="item" />
   }

   <!-- Incorrect - do NOT use -->
   <div *ngIf="isLoading"></div>
   <div *ngFor="let item of items"></div>
   ```

3. **Use `inject()` for Dependency Injection**:
   ```typescript
   // Correct
   private router = inject(Router);
   private http = inject(HttpClient);

   // Acceptable but less preferred
   constructor(private router: Router) {}
   ```

4. **Standalone Components** - All components must be standalone:
   ```typescript
   @Component({
     selector: 'app-example',
     standalone: true,
     imports: [CommonModule, RouterLink],
     template: `...`
   })
   ```

### TypeScript Patterns

1. **Use async/await** - Prefer over raw Promises:
   ```typescript
   // Correct
   async loadData(): Promise<void> {
     const data = await this.service.fetchData();
     this.items.set(data);
   }

   // Avoid
   loadData(): void {
     this.service.fetchData().then(data => this.items = data);
   }
   ```

2. **Strict TypeScript** - The project uses strict mode. Always provide types:
   ```typescript
   // Correct
   function process(items: Item[]): ProcessedItem[] { ... }

   // Avoid
   function process(items: any): any { ... }
   ```

3. **Use single quotes** for strings (per .editorconfig)

4. **2-space indentation** (per .editorconfig)

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | kebab-case selector, `app-` prefix | `app-header`, `app-project-card` |
| Directives | camelCase selector, `app` prefix | `appHighlight`, `appTooltip` |
| Services | camelCase, `.service.ts` suffix | `relay.service.ts`, `RelayService` |
| Pipes | camelCase, `.pipe.ts` suffix | `ago.pipe.ts`, `AgoPipe` |
| Interfaces | PascalCase | `ProjectUpdate`, `FaqItem` |
| Signals | camelCase, descriptive | `isLoading`, `activeFilter` |
| Files | kebab-case | `explore-state.service.ts` |

### File Organization

```
src/app/
├── components/     # Shared/reusable components
├── pages/          # Route page components (one per route)
│   └── explore/
│       ├── explore.component.ts
│       └── explore.component.html
├── services/       # Injectable services (providedIn: 'root')
├── pipes/          # Custom pipes (standalone)
├── models/         # TypeScript interfaces and types
├── app.routes.ts   # Route definitions
├── app.config.ts   # App configuration
└── app.component.ts
```

### Component Patterns

- **Small components**: Use inline templates
- **Large components**: Use external `.html` template files
- **Services**: Always use `providedIn: 'root'` for singleton services
- **Subscriptions**: Clean up in `ngOnDestroy` or use `takeUntilDestroyed()`

### Error Handling

```typescript
// Service methods - use try/catch with console.error
async fetchData(): Promise<void> {
  try {
    const data = await this.api.get();
    this.data.set(data);
  } catch (error) {
    console.error('Failed to fetch data:', error);
    throw error;
  }
}

// Components - handle errors gracefully with user feedback
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

### Styling with TailwindCSS

- Use Tailwind utility classes in templates
- Custom colors are defined via CSS variables (see `tailwind.config.js`)
- Common custom colors: `text`, `accent`, `surface-card`, `surface-ground`, `border`

```html
<div class="bg-surface-card text-text p-4 rounded-lg border border-border">
  <h2 class="text-accent font-semibold">Title</h2>
</div>
```

## Testing

- Test files live alongside source files: `*.spec.ts`
- Use `TestBed.configureTestingModule()` for component/service tests
- Use `fakeAsync` and `flushMicrotasks` for async testing
- Mock external dependencies (localStorage, window.nostr, etc.)

```typescript
describe('MyService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      teardown: { destroyAfterEach: true }
    });
  });

  it('should do something', fakeAsync(() => {
    const service = TestBed.inject(MyService);
    flushMicrotasks();
    expect(service.value()).toBe(expected);
  }));
});
```

## ESLint Rules (Warnings, not Errors)

These are configured as warnings to be less strict during development:
- `@typescript-eslint/no-unused-vars`
- `@typescript-eslint/no-explicit-any`
- `@angular-eslint/template/click-events-have-key-events`
- `@angular-eslint/template/interactive-supports-focus`

## Quick Reference

| Task | Command |
|------|---------|
| Start dev server | `npm start` |
| Build for production | `npm run build` |
| Run all tests | `npm test` |
| Run single test | `ng test --include=**/file.spec.ts` |
| Lint code | `npm run lint` |
| Generate component | `ng generate component components/name` |
| Generate service | `ng generate service services/name` |
