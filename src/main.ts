import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { ApplicationRef } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';

bootstrapApplication(AppComponent, appConfig)
  .then(async (appRef: ApplicationRef) => {
    await firstValueFrom(
      appRef.isStable.pipe(filter(isStable => isStable))
    );

    const loader = document.getElementById('app-loading');
    if (loader) {
      document.body.classList.add('app-loaded');
      setTimeout(() => {
         loader.remove();
      }, 1000); 
    }
  })
  .catch((err) => console.error(err));
