import { App, TFolder } from 'obsidian';
import { FolderSelectorView } from './FolderSelectorView';

/**
 * 文件夹选择器组件
 * 处理文件夹选择和管理逻辑
 */
export class FolderSelector {
    private view: FolderSelectorView;
    private selectedFolders: string[] = [];
    
    constructor(
        private containerEl: HTMLElement,
        private app: App,
        initialFolders: string[] = [],
        private onChange: (folders: string[]) => void
    ) {
        this.selectedFolders = [...initialFolders];
        this.view = new FolderSelectorView(containerEl, {
            onFolderAdd: this.addFolder.bind(this),
            onFolderRemove: this.removeFolder.bind(this),
            getAllFolders: this.getAllFolders.bind(this)
        });
        
        this.view.render(this.selectedFolders);
    }
    
    /**
     * 获取当前选择的文件夹列表
     */
    getSelectedFolders(): string[] {
        return [...this.selectedFolders];
    }
    
    /**
     * 设置选择的文件夹列表
     * @param folders 文件夹列表
     */
    setSelectedFolders(folders: string[]): void {
        this.selectedFolders = [...folders];
        this.view.updateFolderList(this.selectedFolders);
    }
    
    /**
     * 添加文件夹
     * @param folder 文件夹路径
     */
    private async addFolder(folder: string): Promise<void> {
        if (!this.selectedFolders.includes(folder)) {
            this.selectedFolders.push(folder);
            this.view.updateFolderList(this.selectedFolders);
            this.onChange(this.selectedFolders);
        }
    }
    
    /**
     * 移除文件夹
     * @param folder 文件夹路径
     */
    private async removeFolder(folder: string): Promise<void> {
        this.selectedFolders = this.selectedFolders.filter(f => f !== folder);
        this.view.updateFolderList(this.selectedFolders);
        this.onChange(this.selectedFolders);
    }
    
    /**
     * 获取所有文件夹
     * @returns 所有文件夹的路径列表
     */
    private getAllFolders(): string[] {
        return this.app.vault.getAllLoadedFiles()
            .filter(f => f instanceof TFolder && f.path !== "/")
            .map(f => f.path);
    }
} 