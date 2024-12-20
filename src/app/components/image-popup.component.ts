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
      ])
    ])
  ],
  template: `
    <div class="popup-overlay" [@overlay] (click)="close.emit()">
      <img 
        [src]="imageUrl" 
        [alt]="altText" 
        class="popup-image" 
        [@dialog]
        (click)="$event.stopPropagation()"
      />
    </div>
  `,
  styles: [`
    .popup-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      cursor: pointer;
      backdrop-filter: blur(2px);
    }

    .popup-image {
      max-width: 90vw;
      max-height: 90vh;
      object-fit: contain;
      border-radius: 8px;
      cursor: default;
    }
  `]
})
export class ImagePopupComponent {
  @Input() imageUrl: string = '';
  @Input() altText: string = '';
  @Output() close = new EventEmitter<void>();
}
