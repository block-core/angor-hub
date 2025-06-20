import { Injectable, signal, inject, effect } from '@angular/core';
import { DOCUMENT } from '@angular/common';

// Define theme type to include system option
type ThemeType = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private document = inject(DOCUMENT) as Document;
  
  // Updated signal type to include 'system'
  currentTheme = signal<ThemeType>('light');
  
  // Signal to track effective theme (what's actually applied)
  private effectiveTheme = signal<'light' | 'dark'>('light');
  
  // Media query for detecting system preferences
  private systemPrefersDark?: MediaQueryList;
  
  constructor() {
    this.initializeTheme();
    
    // Set up effect to apply theme whenever it changes
    effect(() => {
      this.applyTheme(this.effectiveTheme());
    });
  }
    private initializeTheme(): void {
    try {
      // Set up system preference detection
      this.systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');
      
      // Add listener for system preference changes
      this.systemPrefersDark.addEventListener('change', (e) => {
        if (this.currentTheme() === 'system') {
          this.updateEffectiveTheme();
        }
      });
      
      // Get theme from localStorage
      const savedTheme = localStorage.getItem('angor-theme') as ThemeType | null;
      const currentDOMTheme = this.document.documentElement.getAttribute('data-theme') as 'light' | 'dark';
      
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
        this.currentTheme.set(savedTheme);
      } else {
        // Default to system if no preference is saved
        this.currentTheme.set('system');
      }
      
      // Update the effective theme based on current selection
      this.updateEffectiveTheme();
      
      if (currentDOMTheme && this.effectiveTheme() !== currentDOMTheme) {
        this.effectiveTheme.set(currentDOMTheme);
      }
      
    } catch (e) {
      console.error('Error initializing theme:', e);
      // Default to light theme if there's an error
      this.currentTheme.set('light');
      this.effectiveTheme.set('light');
    }
  }
  
  private updateEffectiveTheme(): void {
    if (this.currentTheme() === 'system') {
      // If system theme is selected, determine from system preference
      const prefersDark = this.systemPrefersDark?.matches ?? false;
      this.effectiveTheme.set(prefersDark ? 'dark' : 'light');
    } else {
      // Otherwise use the explicitly selected theme
      this.effectiveTheme.set(this.currentTheme() as 'light' | 'dark');
    }
  }
  
  toggleTheme(): void {
    // Toggle between light and dark (skip system in toggle)
    const newTheme = this.effectiveTheme() === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }
  
  setTheme(theme: ThemeType): void {
    this.currentTheme.set(theme);
    this.updateEffectiveTheme();
    
    try {
      localStorage.setItem('angor-theme', theme);
    } catch (e) {
      console.error('Failed to save theme preference:', e);
    }
  }
    private applyTheme(theme: 'light' | 'dark'): void {
    if (!this.document.documentElement.hasAttribute('data-theme-initialized')) {
      this.document.documentElement.setAttribute('data-theme-initialized', 'true');
      setTimeout(() => {
        const style = this.document.createElement('style');
        style.textContent = `
          html { transition: background-color 0.2s ease, color 0.2s ease; }
          * { transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease; }
        `;
        this.document.head.appendChild(style);
      }, 100);
    }
    
    this.document.documentElement.setAttribute('data-theme', theme);
  }
  
  isDarkTheme(): boolean {
    return this.effectiveTheme() === 'dark';
  }
  
  // Method to get the currently visible theme (what user sees)
  getEffectiveTheme(): 'light' | 'dark' {
    return this.effectiveTheme();
  }
}
