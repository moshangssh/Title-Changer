import { TFile } from 'obsidian';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/symbols';
import type { TitleChangerPlugin } from '../main';
import { Logger } from '../utils/logger';
import { ErrorManagerService, ErrorLevel } from './ErrorManagerService';
import { ErrorCategory } from '../utils/errors';
import { tryCatchWrapper } from '../utils/ErrorHelpers';

/**
 * 文件服务 - 处理文件查找和路径解析
 */
@injectable()
export class FileService {
    constructor(
        @inject(TYPES.Plugin) private plugin: TitleChangerPlugin,
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.ErrorManager) private errorManager: ErrorManagerService
    ) {}
    
    /**
     * 查找给定文件名的文件
     * @param fileName 文件名（可以是basename或完整路径）
     * @returns 找到的文件或null
     */
    findFile(fileName: string): TFile | null {
        return tryCatchWrapper(
            () => {
                // 获取所有Markdown文件
                const files = this.plugin.app.vault.getMarkdownFiles();
                
                // 寻找匹配的文件
                return files.find(file => 
                    file.basename === fileName || 
                    file.path === fileName || 
                    file.path === `${fileName}.md`
                ) || null;
            },
            'FileService',
            this.errorManager,
            this.logger,
            {
                errorMessage: '查找文件时发生错误',
                category: ErrorCategory.FILE,
                level: ErrorLevel.WARNING,
                details: { fileName }
            }
        );
    }
    
    /**
     * 获取文件的基本名称（不含扩展名）
     * @param fileName 文件名或路径
     * @returns 基本名称
     */
    getBaseName(fileName: string | undefined): string {
        return tryCatchWrapper(
            () => {
                // 安全检查
                if (fileName === undefined || fileName === null) {
                    this.logger.debug('尝试处理undefined或null文件名');
                    return 'untitled';
                }
                
                // 移除路径部分
                const baseName = fileName.split('/').pop() || fileName;
                
                // 移除扩展名
                return baseName.replace(/\.[^.]+$/, '');
            },
            'FileService',
            this.errorManager,
            this.logger,
            {
                errorMessage: '处理文件名时发生错误',
                category: ErrorCategory.FILE,
                level: ErrorLevel.WARNING,
                details: { fileName }
            }
        ) || (fileName || 'untitled'); // 发生错误时返回原始文件名或安全默认值
    }
    
    /**
     * 获取给定路径的文件夹路径
     * @param filePath 文件路径
     * @returns 文件夹路径
     */
    getFolderPath(filePath: string): string {
        return tryCatchWrapper(
            () => {
                const lastSlashIndex = filePath.lastIndexOf('/');
                if (lastSlashIndex === -1) {
                    return ''; // 根目录
                }
                return filePath.substring(0, lastSlashIndex);
            },
            'FileService',
            this.errorManager,
            this.logger,
            {
                errorMessage: '获取文件夹路径时发生错误',
                category: ErrorCategory.FILE,
                level: ErrorLevel.WARNING,
                details: { filePath }
            }
        ) || ''; // 发生错误时返回空字符串
    }
    
    /**
     * 检查文件是否存在
     * @param fileName 文件名或路径
     * @returns 文件是否存在
     */
    fileExists(fileName: string): boolean {
        return tryCatchWrapper(
            () => {
                return this.findFile(fileName) !== null;
            },
            'FileService',
            this.errorManager,
            this.logger,
            {
                errorMessage: '检查文件是否存在时发生错误',
                category: ErrorCategory.FILE,
                level: ErrorLevel.WARNING,
                details: { fileName }
            }
        ) || false; // 发生错误时返回false
    }
    
    /**
     * 获取文件的完整路径（包括扩展名）
     * @param fileName 文件名或部分路径
     * @returns 完整路径或null（文件不存在时）
     */
    getFullPath(fileName: string): string | null {
        return tryCatchWrapper(
            () => {
                const file = this.findFile(fileName);
                return file ? file.path : null;
            },
            'FileService',
            this.errorManager,
            this.logger,
            {
                errorMessage: '获取文件完整路径时发生错误',
                category: ErrorCategory.FILE,
                level: ErrorLevel.WARNING,
                details: { fileName }
            }
        );
    }
} 