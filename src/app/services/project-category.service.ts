import { Injectable } from '@angular/core';
import { IndexedProject } from './indexer.service';

export interface ProjectCategory {
  id: string;
  name: string;
  icon: string;
  keywords: string[];
  color: string;
}

export const PROJECT_CATEGORIES: ProjectCategory[] = [
  {
    id: 'defi',
    name: 'DeFi',
    icon: 'account_balance',
    keywords: ['defi', 'decentralized finance', 'lending', 'borrowing', 'yield', 'liquidity', 'swap', 'dex', 'amm', 'staking', 'farming'],
    color: 'text-purple-500'
  },
  {
    id: 'infrastructure',
    name: 'Infrastructure',
    icon: 'dns',
    keywords: ['infrastructure', 'protocol', 'layer', 'scaling', 'bridge', 'oracle', 'node', 'validator', 'network', 'chain', 'sidechain', 'rollup'],
    color: 'text-blue-500'
  },
  {
    id: 'nft',
    name: 'NFT & Digital Assets',
    icon: 'palette',
    keywords: ['nft', 'collectible', 'art', 'digital art', 'marketplace', 'gallery', 'creator', 'ordinals', 'inscription'],
    color: 'text-pink-500'
  },
  {
    id: 'payments',
    name: 'Payments',
    icon: 'payments',
    keywords: ['payment', 'lightning', 'transaction', 'remittance', 'transfer', 'merchant', 'pos', 'point of sale', 'wallet'],
    color: 'text-green-500'
  },
  {
    id: 'gaming',
    name: 'Gaming & Metaverse',
    icon: 'sports_esports',
    keywords: ['game', 'gaming', 'metaverse', 'virtual', 'play', 'esports', 'gamefi', 'play-to-earn', 'p2e'],
    color: 'text-orange-500'
  },
  {
    id: 'social',
    name: 'Social & Community',
    icon: 'groups',
    keywords: ['social', 'community', 'dao', 'governance', 'voting', 'forum', 'chat', 'messaging', 'nostr', 'decentralized social'],
    color: 'text-cyan-500'
  },
  {
    id: 'privacy',
    name: 'Privacy & Security',
    icon: 'security',
    keywords: ['privacy', 'security', 'anonymous', 'encryption', 'coinjoin', 'mixer', 'confidential', 'zero knowledge', 'zk'],
    color: 'text-red-500'
  },
  {
    id: 'tools',
    name: 'Tools & Utilities',
    icon: 'build',
    keywords: ['tool', 'utility', 'analytics', 'explorer', 'dashboard', 'monitor', 'api', 'sdk', 'developer', 'dev tool'],
    color: 'text-yellow-500'
  },
  {
    id: 'education',
    name: 'Education & Media',
    icon: 'school',
    keywords: ['education', 'learn', 'course', 'tutorial', 'media', 'content', 'news', 'podcast', 'blog', 'research'],
    color: 'text-indigo-500'
  },
  {
    id: 'other',
    name: 'Other',
    icon: 'category',
    keywords: [],
    color: 'text-gray-500'
  }
];

export type CategoryId = 'all' | 'defi' | 'infrastructure' | 'nft' | 'payments' | 'gaming' | 'social' | 'privacy' | 'tools' | 'education' | 'other';

@Injectable({
  providedIn: 'root'
})
export class ProjectCategoryService {
  private categoryCache = new Map<string, CategoryId>();

  getCategories(): ProjectCategory[] {
    return PROJECT_CATEGORIES;
  }

  getCategoryById(id: string): ProjectCategory | undefined {
    return PROJECT_CATEGORIES.find(cat => cat.id === id);
  }

  /**
   * Determines the category of a project based on its metadata
   * Uses keyword matching on name and about fields
   */
  categorizeProject(project: IndexedProject): CategoryId {
    const projectId = project.projectIdentifier;

    // Check cache first
    if (this.categoryCache.has(projectId)) {
      return this.categoryCache.get(projectId)!;
    }

    const name = (project.metadata?.['name'] || '').toLowerCase();
    const about = (project.metadata?.['about'] || '').toLowerCase();
    const combinedText = `${name} ${about}`;

    // Score each category based on keyword matches
    let bestCategory: CategoryId = 'other';
    let bestScore = 0;

    for (const category of PROJECT_CATEGORIES) {
      if (category.id === 'other') continue;

      let score = 0;
      for (const keyword of category.keywords) {
        if (combinedText.includes(keyword)) {
          // Give higher score for exact word matches
          const regex = new RegExp(`\\b${keyword}\\b`, 'i');
          if (regex.test(combinedText)) {
            score += 2;
          } else {
            score += 1;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestCategory = category.id as CategoryId;
      }
    }

    // Cache the result
    this.categoryCache.set(projectId, bestCategory);

    return bestCategory;
  }

  /**
   * Get all categories present in a list of projects
   */
  getCategoriesInProjects(projects: IndexedProject[]): CategoryId[] {
    const categories = new Set<CategoryId>();

    for (const project of projects) {
      categories.add(this.categorizeProject(project));
    }

    return Array.from(categories);
  }

  /**
   * Filter projects by category
   */
  filterByCategory(projects: IndexedProject[], categoryId: CategoryId): IndexedProject[] {
    if (categoryId === 'all') {
      return projects;
    }

    return projects.filter(project => this.categorizeProject(project) === categoryId);
  }

  /**
   * Get count of projects per category
   */
  getCategoryCounts(projects: IndexedProject[]): Map<CategoryId, number> {
    const counts = new Map<CategoryId, number>();

    // Initialize all categories with 0
    counts.set('all', projects.length);
    for (const category of PROJECT_CATEGORIES) {
      counts.set(category.id as CategoryId, 0);
    }

    // Count projects per category
    for (const project of projects) {
      const categoryId = this.categorizeProject(project);
      counts.set(categoryId, (counts.get(categoryId) || 0) + 1);
    }

    return counts;
  }

  /**
   * Clear the category cache (useful when project data updates)
   */
  clearCache(): void {
    this.categoryCache.clear();
  }

  /**
   * Remove a specific project from cache
   */
  invalidateProject(projectId: string): void {
    this.categoryCache.delete(projectId);
  }
}
