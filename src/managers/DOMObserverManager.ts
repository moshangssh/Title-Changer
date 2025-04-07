import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import type { TitleChangerPlugin } from '../main';
import { Logger } from '../utils/logger';
import { ErrorManagerService, ErrorLevel } from '../services/ErrorManagerService';
import { DOMSelectorService } from '../services/DomSelectorService';
import { ErrorCategory } from '../utils/errors';
import { logErrorsWithoutThrowing } from '../utils/ErrorHelpers';
import { AbstractManager } from './base/AbstractManager';

/**
 * DOM观察管理器
 * 负责监控文件浏览器DOM变化，通知相关组件更新
 */
@injectable()
export class DOMObserverManager extends AbstractManager {
    private static readonly MANAGER_ID = 'dom-observer-manager';
    private observer: MutationObserver | null = null;
    private onDomChangedCallback: (() => void) | null = null;

    constructor(
        @inject(TYPES.Plugin) plugin: TitleChangerPlugin,
        @inject(TYPES.Logger) logger: Logger,
        @inject(TYPES.ErrorManager) errorManager: ErrorManagerService,
        @inject(TYPES.DOMSelectorService) private domSelector: DOMSelectorService
    ) {
        super(plugin, logger, errorManager);
    }

    /**
     * 初始化DOM观察管理器
     * @param onDomChanged 当DOM变化时的回调函数
     */
    initialize(onDomChanged: () => void): void {
        this.logInfo(`[${DOMObserverManager.MANAGER_ID}] 正在初始化...`);
        
        this.safeOperation(
            () => {
                this.onDomChangedCallback = onDomChanged;
                this.setupDOMObserver();
            },
            'DOMObserverManager',
            '初始化DOM观察管理器失败',
            ErrorCategory.LIFECYCLE,
            ErrorLevel.ERROR,
            { action: 'initialize' }
        );
        
        this.logInfo(`[${DOMObserverManager.MANAGER_ID}] 初始化完成`);
    }

    /**
     * 设置DOM观察器
     * 监控文件浏览器的DOM变化，在文件项添加或修改时触发回调
     */
    private setupDOMObserver(): void {
        logErrorsWithoutThrowing(
            () => {
                // 获取文件浏览器元素
                const fileExplorers = this.domSelector.getFileExplorers();
                if (fileExplorers.length === 0) {
                    this.logDebug(`[${DOMObserverManager.MANAGER_ID}] 未找到文件浏览器元素，DOM观察器未设置`);
                    return false;
                }
                
                // 创建新的变更监视器，特别关注新增文件项的情况
                const observer = new MutationObserver((mutations) => {
                    logErrorsWithoutThrowing(
                        () => {
                            const hasRelevantChanges = mutations.some(mutation => 
                                mutation.type === 'childList' && 
                                Array.from(mutation.addedNodes).some(node => 
                                    node instanceof HTMLElement && 
                                    (node.classList.contains('nav-file') || 
                                     node.classList.contains('nav-folder'))
                                )
                            );
                            
                            if (hasRelevantChanges && this.onDomChangedCallback) {
                                // 仅当检测到文件项变化时执行回调
                                this.logDebug(`[${DOMObserverManager.MANAGER_ID}] 检测到DOM变化，触发回调`);
                                this.onDomChangedCallback();
                            }
                            
                            return true;
                        },
                        'DOMObserverManager',
                        this.errorManager,
                        this.logger,
                        {
                            errorMessage: '处理DOM变化失败',
                            category: ErrorCategory.UI,
                            level: ErrorLevel.WARNING,
                            defaultValue: false,
                            details: { mutationsCount: mutations.length }
                        }
                    );
                });
                
                // 为每个文件浏览器注册观察器
                fileExplorers.forEach(explorer => {
                    observer.observe(explorer, {
                        childList: true,
                        subtree: true,
                        attributes: false
                    });
                });
                
                // 保存观察器引用，用于卸载时清理
                this.observer = observer;
                
                this.logDebug(`[${DOMObserverManager.MANAGER_ID}] 已设置DOM观察器，监听了${fileExplorers.length}个文件浏览器元素`);
                
                return true;
            },
            'DOMObserverManager',
            this.errorManager,
            this.logger,
            {
                errorMessage: '设置DOM观察器失败',
                category: ErrorCategory.LIFECYCLE,
                level: ErrorLevel.WARNING,
                defaultValue: false
            }
        );
    }

    /**
     * 手动触发DOM变化回调
     * 用于在特定场景下强制更新
     */
    triggerDomChangedCallback(): void {
        if (this.onDomChangedCallback) {
            this.onDomChangedCallback();
        }
    }

    /**
     * 卸载DOM观察管理器
     */
    unload(): void {
        this.logInfo(`[${DOMObserverManager.MANAGER_ID}] 正在卸载...`);
        
        this.safeOperation(
            () => {
                // 清理观察器
                if (this.observer) {
                    this.observer.disconnect();
                    this.observer = null;
                }
                
                // 清理回调
                this.onDomChangedCallback = null;
            },
            'DOMObserverManager',
            '卸载DOM观察管理器失败',
            ErrorCategory.LIFECYCLE,
            ErrorLevel.WARNING,
            { action: 'unload' }
        );
        
        this.logInfo(`[${DOMObserverManager.MANAGER_ID}] 卸载完成`);
    }
} 