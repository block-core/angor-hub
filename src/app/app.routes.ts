import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { ExploreComponent } from './pages/explore/explore.component';
import { ProjectComponent } from './pages/project/project.component';
import { SettingsComponent } from './pages/settings/settings.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'explore', component: ExploreComponent },
  {
    path: 'project/:id',
    loadComponent: () =>
      import('./pages/project/project.component').then((m) => m.ProjectComponent),
    title: 'Project',
  },
  {
    path: 'report/:id',
    loadComponent: () =>
      import('./pages/report/report.component').then((m) => m.ReportComponent),
    title: 'Report Project',
  },
  { path: 'settings', component: SettingsComponent },
  { path: '**', redirectTo: '' }
];
