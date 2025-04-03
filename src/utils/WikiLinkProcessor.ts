/**
 * Wiki链接处理工具
 * 提供提取和处理Wiki链接的通用函数
 */

export interface WikiLink {
    /** 完整匹配文本 */
    fullMatch: string;
    /** 原始文件名 */
    fileName: string;
    /** 显示文本（如果有） */
    displayText?: string;
    /** 子路径/锚点（如果有） */
    subPath?: string;
    /** 在文档中的起始位置 */
    start: number;
    /** 在文档中的结束位置 */
    end: number;
}

/**
 * 从文本中提取Wiki链接
 * @param text 要分析的文本
 * @param lineStart 行的起始位置（用于计算绝对位置）
 * @returns Wiki链接数组
 */
export function extractWikiLinks(text: string, lineStart: number = 0): WikiLink[] {
    const results: WikiLink[] = [];
    // 匹配形如 [[fileName|displayText#subPath]] 的Wiki链接
    const wikiLinkRegex = /\[\[([^\]|#]+)(?:\|([^\]#]+))?(?:#([^\]|]+))?\]\]/g;
    
    let match;
    while ((match = wikiLinkRegex.exec(text)) !== null) {
        results.push({
            fullMatch: match[0],
            fileName: match[1],
            displayText: match[2],
            subPath: match[3],
            start: lineStart + match.index,
            end: lineStart + match.index + match[0].length
        });
    }
    
    return results;
}

/**
 * 处理简单Wiki链接（仅包含[[fileName]]格式）
 * @param text 要分析的文本
 * @param lineStart 行的起始位置
 * @returns 简单Wiki链接数组
 */
export function extractSimpleWikiLinks(text: string, lineStart: number = 0): WikiLink[] {
    const results: WikiLink[] = [];
    // 仅匹配形如 [[fileName]] 的简单Wiki链接
    const simpleLinkRegex = /\[\[([^\]|#]+)\]\]/g;
    
    let match;
    while ((match = simpleLinkRegex.exec(text)) !== null) {
        results.push({
            fullMatch: match[0],
            fileName: match[1],
            start: lineStart + match.index,
            end: lineStart + match.index + match[0].length
        });
    }
    
    return results;
}

/**
 * 判断是否为没有显示文本的Wiki链接
 * 用于确定是否需要应用标题替换
 * @param wikiLink Wiki链接对象
 * @returns 是否需要替换标题
 */
export function shouldReplaceTitle(wikiLink: WikiLink): boolean {
    // 如果已有显示文本，则不需要替换
    return !wikiLink.displayText;
} 