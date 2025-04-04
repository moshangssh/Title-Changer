/**
 * 新版Obsidian选择器配置 (v1.0.0+)
 * 适用于使用新UI的Obsidian版本
 */
import { baseSelectors } from './base-selectors';

export const modernSelectors = {
    // 扩展基础选择器
    ...baseSelectors,
    
    // 覆盖特定选择器
    fileExplorer: {
        ...baseSelectors.fileExplorer,
        primary: '.tree-container',
        alternatives: [
            '.tree-container',
            '.workspace-leaf-content[data-type="file-explorer"] .tree-container',
            '.file-explorer-container',
            ...baseSelectors.fileExplorer.alternatives
        ]
    },
    
    fileItems: {
        ...baseSelectors.fileItems,
        primary: '.tree-item[data-path]',
        alternatives: [
            '.tree-item[data-path]',
            '.is-clickable[data-path]',
            '.tree-item:not(.is-collapsed)',
            ...baseSelectors.fileItems.alternatives
        ]
    },
    
    titleElements: {
        ...baseSelectors.titleElements,
        primary: '.tree-item-inner',
        alternatives: [
            '.tree-item-inner',
            '.tree-item-content',
            '.tree-item-self span',
            ...baseSelectors.titleElements.alternatives
        ]
    }
}; 