import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import type { TitleChangerPlugin } from '../main';
import type { 
    IEditorExtensionManager, 
    EditorExtensionType, 
    EditorExtensionSymbol,
    ExtendedWorkspace 
} from '../types/ObsidianExtensions';
import { ErrorManagerService, ErrorLevel } from './ErrorManagerService';
import { Logger } from '../utils/logger';
import { ErrorCategory } from '../utils/errors';
import { tryCatchWrapper, handleEditorOperation } from '../utils/ErrorHelpers';

/**
 * 编辑器扩展管理器
 */
@injectable()
export class EditorExtensionManager implements IEditorExtensionManager {
    private registeredExtensions: Map<EditorExtensionSymbol, EditorExtensionType> = new Map();

    constructor(
        @inject(TYPES.Plugin) private plugin: TitleChangerPlugin,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService,
        @inject(TYPES.Logger) private logger: Logger
    ) {}

    /**
     * 注册编辑器扩展
     * @param extension 要注册的扩展
     * @returns 扩展标识符
     */
    registerExtension(extension: EditorExtensionType): EditorExtensionSymbol {
        const result = tryCatchWrapper(
            () => {
                const workspace = this.plugin.app.workspace as ExtendedWorkspace;
                const symbol = workspace.registerEditorExtension([extension]);
                this.registeredExtensions.set(symbol, extension);
                return symbol;
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '注册编辑器扩展失败',
                category: ErrorCategory.EDITOR,
                level: ErrorLevel.ERROR,
                userVisible: true,
                details: { extensionType: typeof extension }
            }
        );
        
        // 确保返回类型符合接口要求
        if (result === null) {
            // 如果发生错误，创建一个占位符Symbol作为应急措施
            // 这不是理想方案，但保持API兼容
            this.logger.error('创建了占位符Symbol用于错误恢复');
            return Symbol('error-placeholder');
        }
        
        return result;
    }

    /**
     * 注销编辑器扩展
     * @param symbol 扩展标识符
     */
    unregisterExtension(symbol: EditorExtensionSymbol): void {
        tryCatchWrapper(
            () => {
                const workspace = this.plugin.app.workspace as ExtendedWorkspace;
                workspace.unregisterEditorExtension(symbol);
                this.registeredExtensions.delete(symbol);
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '注销编辑器扩展失败',
                category: ErrorCategory.EDITOR,
                level: ErrorLevel.WARNING,
                userVisible: false,
                details: { extensionSymbol: String(symbol) }
            }
        );
    }

    /**
     * 注销所有扩展
     */
    unregisterAll(): void {
        tryCatchWrapper(
            () => {
                const workspace = this.plugin.app.workspace as ExtendedWorkspace;
                this.registeredExtensions.forEach((_, symbol) => {
                    workspace.unregisterEditorExtension(symbol);
                });
                this.registeredExtensions.clear();
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '注销所有扩展失败',
                category: ErrorCategory.EDITOR,
                level: ErrorLevel.WARNING,
                userVisible: false,
                details: { extensionsCount: this.registeredExtensions.size }
            }
        );
    }

    /**
     * 刷新所有扩展
     */
    refreshAll(): void {
        handleEditorOperation(
            () => {
                this.plugin.app.workspace.updateOptions();
            },
            this.constructor.name,
            this.errorManager,
            this.logger,
            {
                errorMessage: '刷新编辑器扩展失败',
                userVisible: false,
                details: { extensionsCount: this.registeredExtensions.size }
            }
        );
    }
} 