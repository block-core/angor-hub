import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { animate, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-image-popup',
  standalone: true,
  imports: [CommonModule],
  animations: [
    trigger('overlay', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('150ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0 }))
      ])
    ]),
    trigger('dialog', [
      transition(':enter', [
        style({ transform: 'scale(0.95)', opacity: 0 }),
        animate('150ms ease-out', style({ transform: 'scale(1)', opacity: 1 }))
      ]),
      // Optional: Add leave animation for the dialog itself if desired
      // transition(':leave', [
      //   animate('100ms ease-in', style({ transform: 'scale(0.95)', opacity: 0 }))
      // ])
    ])
  ],
  template: `
    <div class="fixed inset-0 bg-black/90 flex justify-center items-center z-[1000] backdrop-blur-sm"
      [@overlay]
      (click)="closeEvent.emit()">
      <div class="relative max-w-[360px] max-h-[360px]" (click)="$event.stopPropagation()">
        <button type="button" 
          class="absolute -top-3 -right-3 text-white hover:text-red-400 text-xl z-20 bg-red-600 hover:bg-red-700 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-lg transition-colors"
          (click)="closeEvent.emit()" 
          title="Close image">
          ×
        </button>
        <img
          [src]="imageUrl"
          [alt]="altText"
          class="w-full h-full object-cover rounded-lg cursor-default shadow-2xl"
          [@dialog] />
      </div>
    </div>
  `
})
export class ImagePopupComponent {
  @Input() imageUrl = '';
  @Input() altText = '';
  @Output() closeEvent = new EventEmitter<void>();
}
