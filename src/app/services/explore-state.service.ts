import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ExploreStateService {
  private scrollPosition = 0;
  private projectsLoaded = false;
  private currentOffset : number = 0;

  saveState(scrollPosition: number, offset: number) {
    this.scrollPosition = scrollPosition;
    this.projectsLoaded = true;
    this.currentOffset = offset;
  }

  clearState() {
    this.scrollPosition = 0;
    this.projectsLoaded = false;
    this.currentOffset = 0;
  }

  get hasState(): boolean {
    return this.projectsLoaded;
  }

  get lastScrollPosition(): number {
    return this.scrollPosition;
  }

  get offset(): number {
    return this.currentOffset;
  }
}
