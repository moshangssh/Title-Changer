import { App, PluginSettingTab, Setting, TFolder } from 'obsidian';
import { TitleChangerPlugin } from './main';

// 添加样式
export const FOLDER_SELECTOR_STYLES = `
.title-changer-folder-selector {
    margin-top: 8px;
    margin-bottom: 24px;
    width: 100%;
}

.title-changer-folder-selector .search-container {
    position: relative;
    margin-bottom: 12px;
}

.title-changer-folder-selector .search-container input {
    width: 100%;
    padding: 8px 12px 8px 32px;
    border-radius: 4px;
    border: 1px solid var(--background-modifier-border);
    background-color: var(--background-primary);
}

.title-changer-folder-selector .search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
}

.title-changer-folder-selector .suggestions-container {
    position: absolute;
    width: 100%;
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background-color: var(--background-primary);
    z-index: 100;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.title-changer-folder-selector .suggestion-item {
    padding: 8px 12px;
    cursor: pointer;
}

.title-changer-folder-selector .suggestion-item:hover {
    background-color: var(--background-secondary);
}

.title-changer-folder-selector .suggestion-item.custom {
    font-style: italic;
    color: var(--text-accent);
}

.title-changer-folder-selector .no-suggestions {
    padding: 8px 12px;
    color: var(--text-muted);
    font-style: italic;
}

.title-changer-folder-selector .folder-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
}

.title-changer-folder-selector .folder-item {
    display: flex;
    align-items: center;
    background-color: var(--background-secondary);
    border-radius: 4px;
    padding: 4px 8px;
}

.title-changer-folder-selector .folder-name {
    margin-right: 4px;
}

.title-changer-folder-selector .remove-button {
    cursor: pointer;
    color: var(--text-muted);
    font-weight: bold;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.title-changer-folder-selector .remove-button:hover {
    color: var(--text-error);
}

.title-changer-folder-selector .empty-message {
    color: var(--text-muted);
    font-style: italic;
}
`;

export interface TitleChangerSettings {
    /**
     * 是否启用标题变更功能
     */
    enabled: boolean;
    
    // 正则表达式用于从文件名中提取显示名称
    regexPattern: string;
    
    // 启用插件的文件夹路径列表
    includedFolders: string[];

    /**
     * 是否启用阅读视图标题替换
     */
    enableReadingView: boolean;
    
    /**
     * 是否启用编辑器视图标题替换
     */
    enableEditorLinkView: boolean;
    
    /**
     * 是否使用缓存
     */
    useCache: boolean;

    /**
     * 缓存过期时间（分钟）
     */
    cacheExpiration: number;
    
    /**
     * 是否启用调试模式
     */
    debugMode: boolean;
}

export const DEFAULT_SETTINGS: TitleChangerSettings = {
    enabled: true,
    regexPattern: '.*_\\d{4}_\\d{2}_\\d{2}_(.+)$', // 匹配日期格式后的所有内容
    includedFolders: [],
    enableReadingView: true,
    enableEditorLinkView: true,
    useCache: true,
    cacheExpiration: 60,
    debugMode: false
};

/**
 * Title Changer 设置选项卡
 * 
 * 功能亮点:
 * 1. 现代化的文件夹选择器界面，支持搜索和自动补全
 * 2. 实时过滤显示匹配的文件夹选项
 * 3. 支持手动输入自定义路径
 * 4. 可视化标签式的已选文件夹管理
 * 5. 智能提示系统
 */
export class TitleChangerSettingTab extends PluginSettingTab {
    plugin: TitleChangerPlugin;
    private folderSuggestions: HTMLElement[] = [];
    private searchInput: HTMLInputElement | null = null;
    private folderList: HTMLElement | null = null;

    constructor(app: App, plugin: TitleChangerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        
        containerEl.addClass('title-changer-settings');

        containerEl.createEl('h2', { text: 'Title Changer 设置' });

        // 基本功能设置
        this.createBasicSettings(containerEl);

        // 显示选项设置
        this.createDisplaySettings(containerEl);

        // 性能优化设置
        this.createPerformanceSettings(containerEl);

        // 高级选项设置
        this.createAdvancedSettings(containerEl);
    }

    private createBasicSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '基本功能' });

        new Setting(containerEl)
            .setName('标题提取正则表达式')
            .setDesc('用于从文件名中提取显示名称的正则表达式。使用括号()来捕获要显示的部分。默认模式匹配日期格式(YYYY_MM_DD)后的所有内容。')
            .addText(text => text
                .setPlaceholder('例如: .*_\\d{4}_\\d{2}_\\d{2}_(.+)$')
                .setValue(this.plugin.settings.regexPattern)
                .onChange(async (value) => {
                    this.plugin.settings.regexPattern = value;
                    await this.plugin.saveSettings();
                }));
    }

    private createDisplaySettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '显示选项' });
        
        new Setting(containerEl)
            .setName('文件列表')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.enabled = value;
                    await this.plugin.saveSettings();
                    
                    // 立即应用状态变化
                    this.plugin.refreshExplorerView();
                }));
                
        new Setting(containerEl)
            .setName('阅读视图')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableReadingView)
                .onChange(async (value) => {
                    this.plugin.settings.enableReadingView = value;
                    
                    // 根据设置立即启用或禁用ReadingView
                    const viewManager = this.plugin.getViewManager();
                    if (viewManager) {
                        if (value) {
                            viewManager.enableView('reading');
                        } else {
                            viewManager.disableView('reading');
                        }
                    }
                    
                    await this.plugin.saveSettings();
                })
            );
            
        new Setting(containerEl)
            .setName('编辑器视图')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableEditorLinkView)
                .onChange(async (value) => {
                    this.plugin.settings.enableEditorLinkView = value;
                    
                    // 根据设置立即启用或禁用视图
                    const viewManager = this.plugin.getViewManager();
                    if (viewManager) {
                        if (value) {
                            viewManager.enableView('editor');
                        } else {
                            viewManager.disableView('editor');
                        }
                    }
                    
                    await this.plugin.saveSettings();
                })
            );
    }

    private createPerformanceSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '性能优化' });

        new Setting(containerEl)
            .setName('启用缓存')
            .setDesc('使用缓存以提高性能')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useCache)
                .onChange(async (value) => {
                    this.plugin.settings.useCache = value;
                    await this.plugin.saveSettings();
                }));

        if (this.plugin.settings.useCache) {
            new Setting(containerEl)
                .setName('缓存过期时间')
                .setDesc('缓存过期时间（分钟）')
                .addSlider(slider => slider
                    .setLimits(5, 1440, 5)
                    .setValue(this.plugin.settings.cacheExpiration)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.cacheExpiration = value;
                        await this.plugin.saveSettings();
                    }));
        }
    }

    private createAdvancedSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '高级选项' });

        // 文件夹选择器设置
        const folderSetting = new Setting(containerEl)
            .setName('指定生效文件夹')
            .setDesc('指定应用此插件的文件夹路径。如不选择则全局生效。插件将应用于所有指定文件夹及其子文件夹。');
        
        // 创建文件夹选择器容器
        const folderSelectorContainer = containerEl.createDiv('folder-selector-container');
        folderSelectorContainer.addClass('title-changer-folder-selector');
        
        // 创建搜索输入框
        const searchContainer = folderSelectorContainer.createDiv('search-container');
        this.searchInput = searchContainer.createEl('input', {
            type: 'text',
            placeholder: '搜索或输入文件夹路径...'
        });
        
        // 添加搜索图标
        const searchIcon = searchContainer.createDiv('search-icon');
        searchIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
        
        // 创建下拉建议列表
        const suggestionsContainer = folderSelectorContainer.createDiv('suggestions-container');
        suggestionsContainer.style.display = 'none';
        
        // 创建已选文件夹列表
        this.folderList = folderSelectorContainer.createDiv('folder-list');
        this.updateFolderList();
        
        // 为搜索框添加事件监听
        this.searchInput.addEventListener('focus', () => {
            this.showFolderSuggestions();
        });
        
        this.searchInput.addEventListener('input', () => {
            this.updateFolderSuggestions();
        });
        
        this.searchInput.addEventListener('blur', (e) => {
            // 延迟隐藏，以便可以点击建议
            setTimeout(() => {
                suggestionsContainer.style.display = 'none';
            }, 200);
        });
        
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.addCustomFolder(this.searchInput?.value || '');
            }
        });
        
        // 调试设置
        new Setting(containerEl)
            .setName('调试模式')
            .setDesc('启用调试模式以获取更多日志信息')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugMode)
                .onChange(async (value) => {
                    this.plugin.settings.debugMode = value;
                    await this.plugin.saveSettings();
                }));
    }

    // 更新文件夹列表显示
    private updateFolderList(): void {
        if (!this.folderList) return;
        
        this.folderList.empty();
        
        if (this.plugin.settings.includedFolders.length === 0) {
            const emptyMessage = this.folderList.createDiv('empty-message');
            emptyMessage.textContent = '未选择任何文件夹，插件将全局生效';
            return;
        }
        
        // 为每个文件夹创建一个可删除的标签
        this.plugin.settings.includedFolders.forEach(folder => {
            const folderItem = this.folderList!.createDiv('folder-item');
            
            const folderName = folderItem.createSpan('folder-name');
            folderName.textContent = folder;
            
            const removeButton = folderItem.createSpan('remove-button');
            removeButton.innerHTML = '×';
            removeButton.ariaLabel = `移除 ${folder}`;
            
            removeButton.addEventListener('click', async () => {
                this.removeFolder(folder);
            });
        });
    }
    
    // 显示文件夹建议
    private showFolderSuggestions(): void {
        if (!this.searchInput) return;
        if (!this.searchInput.parentElement || !this.searchInput.parentElement.parentElement) return;
        
        const suggestionsContainer = this.searchInput.parentElement.parentElement.querySelector('.suggestions-container') as HTMLElement;
        if (!suggestionsContainer) return;
        
        suggestionsContainer.empty();
        this.folderSuggestions = [];
        
        // 获取所有文件夹
        const folders = this.getAllFolders();
        
        if (folders.length === 0) {
            const noFolders = suggestionsContainer.createDiv('no-suggestions');
            noFolders.textContent = '未找到文件夹';
            this.folderSuggestions.push(noFolders);
        } else {
            // 添加文件夹建议
            folders.forEach(folder => {
                if (!this.plugin.settings.includedFolders.includes(folder)) {
                    const suggestion = suggestionsContainer.createDiv('suggestion-item');
                    suggestion.textContent = folder;
                    
                    suggestion.addEventListener('click', async () => {
                        await this.addFolder(folder);
                        
                        if (this.searchInput) {
                            this.searchInput.value = '';
                        }
                        
                        suggestionsContainer.style.display = 'none';
                    });
                    
                    this.folderSuggestions.push(suggestion);
                }
            });
            
            // 如果没有匹配的建议
            if (this.folderSuggestions.length === 0) {
                const noSuggestions = suggestionsContainer.createDiv('no-suggestions');
                noSuggestions.textContent = '未找到匹配的文件夹';
                this.folderSuggestions.push(noSuggestions);
            }
        }
        
        suggestionsContainer.style.display = 'block';
    }
    
    // 更新文件夹建议，根据输入过滤
    private updateFolderSuggestions(): void {
        if (!this.searchInput) return;
        if (!this.searchInput.parentElement || !this.searchInput.parentElement.parentElement) return;
        
        const searchValue = this.searchInput.value.toLowerCase();
        const suggestionsContainer = this.searchInput.parentElement.parentElement.querySelector('.suggestions-container') as HTMLElement;
        if (!suggestionsContainer) return;
        
        suggestionsContainer.empty();
        this.folderSuggestions = [];
        
        // 获取搜索值
        const inputValue = this.searchInput.value || '';
        const trimmedValue = inputValue.trim();
        
        // 获取所有文件夹
        const folders = this.getAllFolders();
        
        // 过滤已选文件夹和匹配输入的文件夹
        const matchedFolders = folders.filter(folder => 
            !this.plugin.settings.includedFolders.includes(folder) && 
            folder.toLowerCase().includes(searchValue)
        );
        
        if (matchedFolders.length === 0 && trimmedValue !== '') {
            // 添加自定义输入提示
            const customSuggestion = suggestionsContainer.createDiv('suggestion-item custom');
            customSuggestion.textContent = `添加: ${inputValue}`;
            
            customSuggestion.addEventListener('click', async () => {
                await this.addCustomFolder(inputValue);
                
                if (this.searchInput) {
                    this.searchInput.value = '';
                }
                
                suggestionsContainer.style.display = 'none';
            });
            
            this.folderSuggestions.push(customSuggestion);
        } else {
            // 添加匹配的文件夹建议
            matchedFolders.forEach(folder => {
                const suggestion = suggestionsContainer.createDiv('suggestion-item');
                suggestion.textContent = folder;
                
                suggestion.addEventListener('click', async () => {
                    await this.addFolder(folder);
                    
                    if (this.searchInput) {
                        this.searchInput.value = '';
                    }
                    
                    suggestionsContainer.style.display = 'none';
                });
                
                this.folderSuggestions.push(suggestion);
            });
        }
        
        suggestionsContainer.style.display = 'block';
    }
    
    // 添加文件夹到设置
    private async addFolder(folder: string): Promise<void> {
        if (!this.plugin.settings.includedFolders.includes(folder)) {
            this.plugin.settings.includedFolders.push(folder);
            await this.plugin.saveSettings();
            this.updateFolderList();
        }
    }
    
    // 添加自定义文件夹输入到设置
    private async addCustomFolder(folderPath: string): Promise<void> {
        if (folderPath.trim() === '') return;
        
        // 规范化路径：移除开头和结尾的斜杠
        const normalizedPath = folderPath.trim()
            .replace(/^\/+/, '')  // 移除开头的斜杠
            .replace(/\/+$/, ''); // 移除结尾的斜杠
        
        if (normalizedPath && !this.plugin.settings.includedFolders.includes(normalizedPath)) {
            this.plugin.settings.includedFolders.push(normalizedPath);
            await this.plugin.saveSettings();
            this.updateFolderList();
        }
    }
    
    // 移除文件夹
    private async removeFolder(folder: string): Promise<void> {
        this.plugin.settings.includedFolders = this.plugin.settings.includedFolders.filter(f => f !== folder);
        await this.plugin.saveSettings();
        this.updateFolderList();
    }
    
    // 获取所有文件夹
    private getAllFolders(): string[] {
        const folders: string[] = [];
        const vault = this.app.vault;
        
        // 获取所有文件夹
        const allFolders = vault.getAllLoadedFiles()
            .filter(f => f instanceof TFolder && f.path !== "/")
            .map(f => f.path);
        
        return allFolders;
    }
} 