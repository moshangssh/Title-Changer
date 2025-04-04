/**
 * 旧版Obsidian选择器配置 (v0.9.x 及更早)
 * 适用于使用传统UI的Obsidian版本
 */
import { baseSelectors } from './base-selectors';

export const legacySelectors = {
    // 扩展基础选择器
    ...baseSelectors,
    
    // 使用更特定于旧版本的选择器
    fileExplorer: {
        ...baseSelectors.fileExplorer,
        primary: '.nav-files-container',
        alternatives: [
            '.nav-folder-children',
            '.nav-folder-content',
            ...baseSelectors.fileExplorer.alternatives
        ]
    },
    
    fileItems: {
        ...baseSelectors.fileItems,
        primary: '.nav-file',
        alternatives: [
            '.nav-file',
            '.nav-file-title',
            ...baseSelectors.fileItems.alternatives
        ]
    },
    
    titleElements: {
        ...baseSelectors.titleElements,
        primary: '.nav-file-title-content',
        alternatives: [
            '.nav-file-title-content',
            '.nav-file-title',
            ...baseSelectors.titleElements.alternatives
        ]
    }
}; 