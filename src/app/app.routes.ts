import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent) },
  { path: 'explore', loadComponent: () => import('./pages/explore/explore.component').then(m => m.ExploreComponent) },
  { path: 'project/:id', loadComponent: () => import('./pages/project/project.component').then(m => m.ProjectComponent) },
  { path: 'report/:id', loadComponent: () => import('./pages/report/report.component').then(m => m.ReportComponent) },
  { path: 'settings', loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent) },
  { path: '**', redirectTo: '' }
  
];
