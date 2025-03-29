import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import type { TitleChangerPlugin } from '../main';
import { ExplorerView } from './explorer-view';

/**
 * 视图管理器，用于协调管理不同视图组件
 */
@injectable()
export class ViewManager {
    private explorerView: ExplorerView;

    /**
     * 构造函数
     * @param plugin 插件实例
     */
    constructor(
        @inject(TYPES.Plugin) private plugin: TitleChangerPlugin,
        @inject(TYPES.ExplorerView) explorerView: ExplorerView
    ) {
        this.explorerView = explorerView;
    }

    /**
     * 初始化所有视图
     */
    initialize(): void {
        this.explorerView.initialize();
    }

    /**
     * 卸载所有视图组件
     */
    unload(): void {
        this.explorerView.unload();
    }

    /**
     * 更新所有视图
     */
    updateAllViews(): void {
        this.explorerView.updateView();
    }

    /**
     * 更新设置后刷新所有视图
     */
    onSettingsChanged(): void {
        this.updateAllViews();
    }
} 