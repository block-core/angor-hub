import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'safeContent',
  standalone: true
})
export class SafeContentPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(content: string): SafeHtml {
    if (!content) {
      return '';
    }

    // Regular expressions for matching links and images
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const imageRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)(\?[^\s]*)?)/gi;

    // First replace image URLs
    let processedContent = content.replace(imageRegex, (match) => {
      return `<img src="${match}" class="embedded-image" alt="Embedded content" loading="lazy">`;
    });

    // Then replace remaining URLs with clickable links
    processedContent = processedContent.replace(urlRegex, (match) => {
      if (match.match(imageRegex)) {
        // Skip if it's already been converted to an image
        return match;
      }
      return `<a href="${match}" target="_blank" rel="noopener noreferrer">${match}</a>`;
    });

    // Replace line breaks with <br> tags
    processedContent = processedContent.replace(/\n/g, '<br>');

    // Sanitize the HTML to prevent XSS attacks
    return this.sanitizer.bypassSecurityTrustHtml(processedContent);
  }
}
