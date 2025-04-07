/**
 * 文件夹选择器视图
 * 处理文件夹选择器的UI展示和用户交互
 */
export interface FolderSelectorViewCallbacks {
    onFolderAdd: (folder: string) => Promise<void>;
    onFolderRemove: (folder: string) => Promise<void>;
    getAllFolders: () => string[];
}

export class FolderSelectorView {
    private containerEl: HTMLElement;
    private callbacks: FolderSelectorViewCallbacks;
    private searchInput: HTMLInputElement | null = null;
    private folderList: HTMLElement | null = null;
    private suggestionsContainer: HTMLElement | null = null;
    private folderSuggestions: HTMLElement[] = [];

    constructor(containerEl: HTMLElement, callbacks: FolderSelectorViewCallbacks) {
        this.containerEl = containerEl;
        this.callbacks = callbacks;
    }

    /**
     * 渲染文件夹选择器UI
     * @param selectedFolders 当前已选择的文件夹列表
     */
    render(selectedFolders: string[]): void {
        // 创建文件夹选择器容器
        const folderSelectorContainer = this.containerEl.createDiv('folder-selector-container');
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
        this.suggestionsContainer = folderSelectorContainer.createDiv('suggestions-container');
        this.suggestionsContainer.style.display = 'none';
        
        // 创建已选文件夹列表
        this.folderList = folderSelectorContainer.createDiv('folder-list');
        this.updateFolderList(selectedFolders);
        
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
                if (this.suggestionsContainer) {
                    this.suggestionsContainer.style.display = 'none';
                }
            }, 200);
        });
        
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.addCustomFolder(this.searchInput?.value || '');
            }
        });
    }

    /**
     * 更新文件夹列表显示
     * @param folders 当前选择的文件夹列表
     */
    updateFolderList(folders: string[]): void {
        if (!this.folderList) return;
        
        this.folderList.empty();
        
        if (folders.length === 0) {
            const emptyMessage = this.folderList.createDiv('empty-message');
            emptyMessage.textContent = '未选择任何文件夹，插件将全局生效';
            return;
        }
        
        // 为每个文件夹创建一个可删除的标签
        folders.forEach(folder => {
            const folderItem = this.folderList!.createDiv('folder-item');
            
            const folderName = folderItem.createSpan('folder-name');
            folderName.textContent = folder;
            
            const removeButton = folderItem.createSpan('remove-button');
            removeButton.innerHTML = '×';
            removeButton.ariaLabel = `移除 ${folder}`;
            
            removeButton.addEventListener('click', async () => {
                await this.callbacks.onFolderRemove(folder);
            });
        });
    }
    
    /**
     * 显示文件夹建议
     */
    private showFolderSuggestions(): void {
        if (!this.searchInput || !this.suggestionsContainer) return;
        
        this.suggestionsContainer.empty();
        this.folderSuggestions = [];
        
        // 获取所有文件夹
        const folders = this.callbacks.getAllFolders();
        
        if (folders.length === 0) {
            const noFolders = this.suggestionsContainer.createDiv('no-suggestions');
            noFolders.textContent = '未找到文件夹';
            this.folderSuggestions.push(noFolders);
        } else {
            // 过滤掉已选择的文件夹
            const availableFolders = folders.filter(folder => !this.getFolderItems().includes(folder));
            
            if (availableFolders.length === 0) {
                const noSuggestions = this.suggestionsContainer.createDiv('no-suggestions');
                noSuggestions.textContent = '所有文件夹已被选择';
                this.folderSuggestions.push(noSuggestions);
            } else {
                // 添加文件夹建议
                availableFolders.forEach(folder => {
                    const suggestion = this.suggestionsContainer!.createDiv('suggestion-item');
                    suggestion.textContent = folder;
                    
                    suggestion.addEventListener('click', async () => {
                        await this.callbacks.onFolderAdd(folder);
                        
                        if (this.searchInput) {
                            this.searchInput.value = '';
                        }
                        
                        this.suggestionsContainer!.style.display = 'none';
                    });
                    
                    this.folderSuggestions.push(suggestion);
                });
            }
        }
        
        this.suggestionsContainer.style.display = 'block';
    }
    
    /**
     * 更新文件夹建议，根据输入过滤
     */
    private updateFolderSuggestions(): void {
        if (!this.searchInput || !this.suggestionsContainer) return;
        
        const searchValue = this.searchInput.value.toLowerCase();
        this.suggestionsContainer.empty();
        this.folderSuggestions = [];
        
        // 获取搜索值
        const inputValue = this.searchInput.value || '';
        const trimmedValue = inputValue.trim();
        
        // 获取所有文件夹
        const folders = this.callbacks.getAllFolders();
        
        // 获取当前已选文件夹
        const selectedFolders = this.getFolderItems();
        
        // 过滤已选文件夹和匹配输入的文件夹
        const matchedFolders = folders.filter(folder => 
            !selectedFolders.includes(folder) && 
            folder.toLowerCase().includes(searchValue)
        );
        
        if (matchedFolders.length === 0 && trimmedValue !== '') {
            // 添加自定义输入提示
            const customSuggestion = this.suggestionsContainer.createDiv('suggestion-item custom');
            customSuggestion.textContent = `添加: ${inputValue}`;

            customSuggestion.addEventListener('click', async () => {
                await this.addCustomFolder(inputValue);
                
                if (this.searchInput) {
                    this.searchInput.value = '';
                }
                
                this.suggestionsContainer!.style.display = 'none';
            });

            this.folderSuggestions.push(customSuggestion);
        } else {
            // 添加匹配的文件夹建议
            matchedFolders.forEach(folder => {
                const suggestion = this.suggestionsContainer!.createDiv('suggestion-item');
                suggestion.textContent = folder;
                
                suggestion.addEventListener('click', async () => {
                    await this.callbacks.onFolderAdd(folder);
                    
                    if (this.searchInput) {
                        this.searchInput.value = '';
                    }
                    
                    this.suggestionsContainer!.style.display = 'none';
                });
                
                this.folderSuggestions.push(suggestion);
            });
        }
        
        this.suggestionsContainer.style.display = 'block';
    }

    /**
     * 获取当前显示的文件夹列表项
     */
    private getFolderItems(): string[] {
        if (!this.folderList) return [];
        
        const folderItems: string[] = [];
        const folderElements = this.folderList.querySelectorAll('.folder-item .folder-name');
        
        folderElements.forEach(el => {
            folderItems.push(el.textContent || '');
        });
        
        return folderItems;
    }

    /**
     * 添加自定义文件夹输入到设置
     */
    private async addCustomFolder(folderPath: string): Promise<void> {
        if (folderPath.trim() === '') return;

        // 规范化路径：移除开头和结尾的斜杠
        const normalizedPath = folderPath.trim()
            .replace(/^\/+/, '')  // 移除开头的斜杠
            .replace(/\/+$/, ''); // 移除结尾的斜杠

        if (normalizedPath) {
            await this.callbacks.onFolderAdd(normalizedPath);
            
            if (this.searchInput) {
                this.searchInput.value = '';
            }
        }
    }
} 