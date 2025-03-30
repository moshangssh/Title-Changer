import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import type { TitleChangerPlugin } from '../main';
import type { 
    IEditorExtensionManager, 
    EditorExtensionType, 
    EditorExtensionSymbol,
    ExtendedWorkspace 
} from '../types/obsidian-extensions';

/**
 * 编辑器扩展管理器
 */
@injectable()
export class EditorExtensionManager implements IEditorExtensionManager {
    private registeredExtensions: Map<EditorExtensionSymbol, EditorExtensionType> = new Map();

    constructor(
        @inject(TYPES.Plugin) private plugin: TitleChangerPlugin
    ) {}

    /**
     * 注册编辑器扩展
     * @param extension 要注册的扩展
     * @returns 扩展标识符
     */
    registerExtension(extension: EditorExtensionType): EditorExtensionSymbol {
        try {
            const workspace = this.plugin.app.workspace as ExtendedWorkspace;
            const symbol = workspace.registerEditorExtension([extension]);
            this.registeredExtensions.set(symbol, extension);
            return symbol;
        } catch (error) {
            console.error('注册编辑器扩展时发生错误:', error);
            throw error;
        }
    }

    /**
     * 注销编辑器扩展
     * @param symbol 扩展标识符
     */
    unregisterExtension(symbol: EditorExtensionSymbol): void {
        try {
            const workspace = this.plugin.app.workspace as ExtendedWorkspace;
            workspace.unregisterEditorExtension(symbol);
            this.registeredExtensions.delete(symbol);
        } catch (error) {
            console.error('注销编辑器扩展时发生错误:', error);
            throw error;
        }
    }

    /**
     * 注销所有扩展
     */
    unregisterAll(): void {
        try {
            const workspace = this.plugin.app.workspace as ExtendedWorkspace;
            this.registeredExtensions.forEach((_, symbol) => {
                workspace.unregisterEditorExtension(symbol);
            });
            this.registeredExtensions.clear();
        } catch (error) {
            console.error('注销所有扩展时发生错误:', error);
            throw error;
        }
    }

    /**
     * 刷新所有扩展
     */
    refreshAll(): void {
        try {
            this.plugin.app.workspace.updateOptions();
        } catch (error) {
            console.error('刷新扩展时发生错误:', error);
            throw error;
        }
    }
} 