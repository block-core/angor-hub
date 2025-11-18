import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { ExploreComponent } from './pages/explore/explore.component';
import { ProjectComponent } from './pages/project/project.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { ReportComponent } from './pages/report/report.component';
import { AdminComponent } from './pages/admin/admin.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'Angor Hub',
    data: { animation: 'HomePage' } 
  },
  {
    path: 'explore',
    component: ExploreComponent,
    title: 'Explore Projects',
    data: { animation: 'ExplorePage' } 
  },
  {
    path: 'project/:id',
    component: ProjectComponent,
    title: 'Project Details',
    data: { animation: 'ProjectPage' } 
  },
  {
    path: 'settings',
    component: SettingsComponent,
    title: 'Settings',
    data: { animation: 'SettingsPage' } 
  },
  {
    path: 'report/:id',
    component: ReportComponent,
    title: 'Report Project',
    data: { animation: 'ReportPage' } 
  },
  {
    path: 'admin',
    component: AdminComponent,
    title: 'Admin - Manage Deny Lists',
    data: { animation: 'AdminPage' } 
  },
  {
    path: '**',
    redirectTo: '', 
  },
];
