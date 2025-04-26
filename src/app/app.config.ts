import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations'; 
import { MarkdownModule } from 'ngx-markdown';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled', 
        anchorScrolling: 'enabled',
      }),
      withViewTransitions() 
    ),
    provideHttpClient(withFetch()),
    provideAnimations(), 
    importProvidersFrom(MarkdownModule.forRoot()),
  ],
};
