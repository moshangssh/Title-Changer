/**
 * 编辑器工具函数 - CodeMirror版本兼容层
 * 提供统一的API接口以兼容不同版本的CodeMirror
 */
import { MarkdownView, WorkspaceLeaf, App, Notice } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';

/**
 * CodeMirror版本枚举
 */
export enum CodeMirrorVersion {
    CM5 = 5,
    CM6 = 6,
    UNKNOWN = 0
}

/**
 * 编辑器信息接口
 */
export interface EditorInfo {
    version: CodeMirrorVersion;
    editor: any; // 原始编辑器对象
    view?: EditorView; // CM6 EditorView (如果可用)
    cm5?: any; // CM5 编辑器实例 (如果可用)
}

/**
 * 检测编辑器的CodeMirror版本
 * @param leaf 工作区叶子
 * @returns 编辑器版本
 */
export function detectCodeMirrorVersion(leaf: WorkspaceLeaf): CodeMirrorVersion {
    if (!leaf || !leaf.view || !(leaf.view instanceof MarkdownView)) {
        return CodeMirrorVersion.UNKNOWN;
    }
    
    const view = leaf.view;
    const editorInstance = view.editor as any; // 使用any类型访问非标准属性
    
    // 检测是否存在CM6 API
    if (editorInstance && editorInstance.cm instanceof EditorView) {
        return CodeMirrorVersion.CM6;
    }
    
    // 检测是否存在CM5 API
    if (editorInstance && editorInstance.cm && typeof editorInstance.cm.getDoc === 'function') {
        return CodeMirrorVersion.CM5;
    }
    
    return CodeMirrorVersion.UNKNOWN;
}

/**
 * 从叶子获取编辑器信息
 * @param leaf 工作区叶子
 * @returns 编辑器信息对象
 */
export function getEditorInfo(leaf: WorkspaceLeaf): EditorInfo | null {
    if (!leaf || !leaf.view || !(leaf.view instanceof MarkdownView)) {
        return null;
    }
    
    const view = leaf.view;
    const version = detectCodeMirrorVersion(leaf);
    const editorInstance = view.editor as any; // 使用any类型访问非标准属性
    
    if (version === CodeMirrorVersion.UNKNOWN) {
        return null;
    }
    
    const info: EditorInfo = {
        version,
        editor: view.editor
    };
    
    if (version === CodeMirrorVersion.CM6) {
        info.view = editorInstance.cm;
    } else if (version === CodeMirrorVersion.CM5) {
        info.cm5 = editorInstance.cm;
    }
    
    return info;
}

/**
 * 获取编辑器DOM容器
 * @param leaf 工作区叶子
 * @returns HTML元素或null
 */
export function getEditorContainer(leaf: WorkspaceLeaf): HTMLElement | null {
    if (!leaf || !leaf.view || !(leaf.view instanceof MarkdownView)) {
        return null;
    }
    
    const info = getEditorInfo(leaf);
    
    if (!info) {
        return null;
    }
    
    if (info.version === CodeMirrorVersion.CM6) {
        // CM6使用containerEl存储DOM
        return info.view?.dom || null;
    } else if (info.version === CodeMirrorVersion.CM5) {
        // CM5通常使用不同的属性
        return info.cm5?.getWrapperElement() || null;
    }
    
    // 后备方案: 尝试从编辑器对象获取
    const editor = leaf.view.editor as any;
    return editor.containerEl || leaf.view.contentEl;
}

/**
 * 获取编辑器视图（仅CM6）
 * @param leaf 工作区叶子
 * @returns EditorView或null
 */
export function getEditorView(leaf: WorkspaceLeaf): EditorView | null {
    const info = getEditorInfo(leaf);
    return info?.version === CodeMirrorVersion.CM6 ? info.view as EditorView : null;
}

/**
 * 强制刷新编辑器视图
 * @param leaf 工作区叶子
 */
export function refreshEditorView(leaf: WorkspaceLeaf): void {
    const info = getEditorInfo(leaf);
    
    if (!info) {
        return;
    }
    
    if (info.version === CodeMirrorVersion.CM6) {
        const view = info.view as EditorView;
        // 请求重新测量和渲染
        view.requestMeasure();
    } else if (info.version === CodeMirrorVersion.CM5) {
        const cm5 = info.cm5;
        // CM5刷新方法
        if (cm5 && typeof cm5.refresh === 'function') {
            cm5.refresh();
        }
    }
}

/**
 * 检查是否支持CodeMirror 6 API
 * @param app Obsidian应用实例
 * @returns 是否支持CM6
 */
export function supportsCM6API(app: App): boolean {
    // 尝试获取当前活动叶子
    const leaf = app.workspace.getActiveViewOfType(MarkdownView)?.leaf;
    if (!leaf) return false;
    
    return detectCodeMirrorVersion(leaf) === CodeMirrorVersion.CM6;
}

/**
 * 安全地注册CodeMirror扩展（处理版本兼容性）
 * 此方法将根据当前Obsidian使用的CodeMirror版本决定如何注册扩展
 * 
 * @param app Obsidian应用实例
 * @param extension 要注册的扩展
 * @returns 扩展标识符或null（如果不支持）
 */
export function safeRegisterExtension(app: App, extension: Extension): Symbol | null {
    try {
        // 检查是否支持CM6
        if (!supportsCM6API(app)) {
            new Notice('当前Obsidian版本不支持CodeMirror 6扩展功能');
            return null;
        }
        
        // 注册CM6扩展
        return (app.workspace as any).registerEditorExtension(extension);
    } catch (e) {
        console.error('注册编辑器扩展失败:', e);
        return null;
    }
} 