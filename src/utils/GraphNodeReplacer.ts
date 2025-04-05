import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import { TitleService } from '../services/TitleService';
import { Logger } from './Logger';
import { App, WorkspaceLeaf } from 'obsidian';

/**
 * 图表节点文本替换器
 * 负责替换Graph视图中节点的显示文本
 */
@injectable()
export class GraphNodeReplacer {
    private applied = false;
    private originalGetDisplayText: Function | null = null;
    
    constructor(
        @inject(TYPES.App) private app: App,
        @inject(TYPES.TitleService) private titleService: TitleService,
        @inject(TYPES.Logger) private logger: Logger
    ) {}
    
    /**
     * 检查替换功能是否已应用
     * @returns 如果替换功能已应用则返回true，否则返回false
     */
    isApplied(): boolean {
        return this.applied;
    }
    
    /**
     * 启用替换功能
     */
    enable(): void {
        this.apply();
    }
    
    /**
     * 禁用替换功能
     */
    disable(): void {
        this.restore();
    }
    
    /**
     * 应用替换功能
     * @returns 如果成功应用则返回true，否则返回false
     */
    apply(): boolean {
        if (this.applied) return true;
        
        this.logger.debug('尝试应用图表节点替换');

        // 获取所有图表视图
        const views = this.getViews();
        this.logger.debug(`找到 ${views.length} 个图表视图`);
        
        if (views.length === 0) {
            this.logger.debug('未找到图表视图，将在图表视图创建后再次尝试');
            return false;
        }
        
        const node = this.getFirstNode();
        if (!node) {
            this.logger.debug('未找到图表节点，可能图表视图尚未完全加载');
            return false;
        }
        
        try {
            const proto = Object.getPrototypeOf(node);
            
            // 检查节点是否有getDisplayText方法
            if (typeof proto.getDisplayText !== 'function') {
                this.logger.error('图表节点没有getDisplayText方法');
                return false;
            }
            
            this.originalGetDisplayText = proto.getDisplayText;
            
            // 确保原始方法存在
            if (!this.originalGetDisplayText) {
                this.logger.error('无法获取原始getDisplayText方法');
                return false;
            }
            
            // 替换getDisplayText方法
            const titleService = this.titleService; // 保存引用
            const originalMethod = this.originalGetDisplayText; // 保存原始方法引用
            const logger = this.logger;  // 保存logger引用
            
            proto.getDisplayText = function(this: any, ...args: any[]) {
                try {
                    // 确保节点ID存在
                    if (this && this.id) {
                        try {
                            // 尝试从TitleService获取自定义标题
                            const customTitle = titleService.getDisplayTitle(this.id);
                            if (customTitle) return customTitle;
                        } catch (titleError) {
                            // 捕获TitleService可能抛出的错误
                            logger.debug(`获取自定义标题失败: ${titleError}`, { nodeId: this.id });
                            // 继续执行，使用原始方法
                        }
                    }
                    
                    // 回退到原始实现
                    // 注意：必须保持原始this上下文
                    return originalMethod.apply(this, args);
                } catch (error) {
                    // 记录错误但不中断流程
                    logger.debug(`图表节点文本处理错误: ${error}`, { nodeId: this?.id, error });
                    
                    // 安全地回退到原始方法
                    try {
                        return originalMethod.apply(this, args);
                    } catch (fallbackError) {
                        // 如果原始方法也失败，返回一个安全的默认值
                        logger.error('原始getDisplayText方法调用失败', { error: fallbackError });
                        return this?.id || 'Untitled';
                    }
                }
            };
            
            this.applied = true;
            this.logger.info("✅ 图表节点替换功能已成功应用");
            this.refresh();
            return true;
        } catch (error) {
            this.logger.error('应用图表节点替换失败', { error });
            return false;
        }
    }
    
    /**
     * 恢复原始方法
     */
    restore(): void {
        if (!this.applied || !this.originalGetDisplayText) return;
        
        const node = this.getFirstNode();
        if (!node) return;
        
        try {
            const proto = Object.getPrototypeOf(node);
            proto.getDisplayText = this.originalGetDisplayText;
            this.originalGetDisplayText = null;
            this.applied = false;
            this.logger.debug("图表节点替换功能已禁用");
            this.refresh();
        } catch (error) {
            this.logger.error('恢复图表节点原始方法失败', { error });
        }
    }
    
    /**
     * 刷新所有图表视图
     */
    refresh(): void {
        for (const view of this.getViews()) {
            try {
                if (view && view.renderer) {
                    view.renderer.onIframeLoad();
                }
            } catch (error) {
                this.logger.error('刷新图表视图失败', { error });
            }
        }
    }
    
    /**
     * 刷新特定节点
     * @param path 文件路径
     */
    refreshNode(path: string): void {
        for (const view of this.getViews()) {
            try {
                const nodes = view?.renderer?.nodes || [];
                for (const node of nodes) {
                    if (node.id === path) {
                        // 只触发特定节点的重绘
                        view.renderer.onNodeChanged?.(node);
                        return;
                    }
                }
            } catch (error) {
                this.logger.error(`刷新节点 ${path} 失败`, { error });
            }
        }
    }
    
    /**
     * 获取第一个图表节点
     * @returns 图表节点对象或null
     */
    private getFirstNode(): any | null {
        for (const view of this.getViews()) {
            try {
                const nodes = view?.renderer?.nodes || [];
                if (nodes.length) {
                    return nodes[0];
                }
            } catch (error) {
                this.logger.error('获取图表节点失败', { error });
            }
        }
        return null;
    }
    
    /**
     * 获取所有图表视图
     * @returns 图表视图数组
     */
    private getViews(): any[] {
        try {
            // 尝试获取所有可能的图表视图类型
            const leaves = [
                ...this.app.workspace.getLeavesOfType('graph'),
                ...this.app.workspace.getLeavesOfType('localgraph')
            ];
            
            // 过滤掉没有view属性的叶子
            const views = leaves
                .filter(leaf => leaf && leaf.view)
                .map(leaf => leaf.view);
                
            return views;
        } catch (error) {
            this.logger.error('获取图表视图失败', { error });
            return [];
        }
    }
} 