/**
 * 基础选择器配置
 * 包含通用的DOM选择器，适用于所有Obsidian版本
 */
export const baseSelectors = {
    // 文件浏览器相关选择器
    fileExplorer: {
        primary: '.nav-files-container',
        alternatives: [
            '.file-explorer-container',
            '.file-tree-container',
            '.nav-folder-children',
            '.workspace-leaf-content[data-type="file-explorer"] .view-content'
        ],
        fallbacks: [
            '.nav-folder-content',
            '.workspace-leaf[data-type="file-explorer"]',
            '.workspace-leaf-content[data-type="file-explorer"]',
            '.file-explorer'
        ]
    },
    
    // 文件项相关选择器
    fileItems: {
        primary: '.nav-file',
        alternatives: [
            '.tree-item[data-path]',
            '[data-path]:not(.nav-folder)',
            '.tree-item:not(.nav-folder)',
            '.is-clickable[aria-label]',
        ],
        fallbacks: [
            '.tree-item',
            '.nav-file-title',
            '.workspace-leaf-content[data-type="file-explorer"] *[data-path]'
        ]
    },
    
    // 标题元素选择器
    titleElements: {
        primary: '.nav-file-title-content',
        alternatives: [
            '.tree-item-inner',
            '.tree-item-content',
            '.nav-file-title',
        ],
        fallbacks: [
            'div:not([class])',
            '[data-path-inner-text]',
            '[aria-label]',
            'span'
        ]
    },
    
    // 属性选择器
    attributes: {
        path: 'data-path',
        title: 'title',
        ariaLabel: 'aria-label',
        href: 'href'
    }
};

/**
 * 选择器版本检测结果
 */
export interface SelectorVersion {
    major: number;
    minor: number;
    isLegacy: boolean;
    isModern: boolean;
}

/**
 * 检测Obsidian版本以选择适当的选择器
 * @returns 版本检测结果
 */
export function detectObsidianVersion(): SelectorVersion {
    try {
        // 检测现代UI特征
        const hasModernUI = Boolean(
            document.querySelector('.tree-item') || 
            document.querySelector('[data-type="file-explorer"] .tree-container')
        );
        
        // 检测旧版UI特征
        const hasLegacyUI = Boolean(
            document.querySelector('.nav-file-title-content') ||
            document.querySelector('.nav-folder-title-content')
        );
        
        // 基于DOM特征估计版本
        let major = 0;
        let minor = 0;
        
        if (hasModernUI) {
            major = 1;
            minor = 0;
        } else if (hasLegacyUI) {
            major = 0;
            minor = 9;
        }
        
        return {
            major,
            minor,
            isLegacy: hasLegacyUI && !hasModernUI,
            isModern: hasModernUI
        };
    } catch (e) {
        // 默认返回兼容性最强的配置
        return {
            major: 0,
            minor: 9,
            isLegacy: true,
            isModern: false
        };
    }
} 