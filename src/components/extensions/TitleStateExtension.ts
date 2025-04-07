/**
 * 标题状态扩展 - 使用CodeMirror状态系统管理文件标题
 */
import { StateField, StateEffect, Extension, EditorState } from '@codemirror/state';
import { ErrorManagerService, ErrorLevel } from '../../services/ErrorManagerService';
import { Logger } from '../../utils/logger';
import { ErrorCategory } from '../../utils/errors';
import { tryCatchWrapper } from '../../utils/ErrorHelpers';

/**
 * 标题变更效果接口
 */
export interface TitleChangeInfo {
    file: string;    // 文件路径
    title: string;   // 新标题
}

/**
 * 扩展的状态字段接口，包含标题管理的额外方法
 */
export interface TitleStateField extends StateField<Map<string, string>> {
    createTitleChangeEffect(file: string, title: string): StateEffect<TitleChangeInfo>;
    getTitle(state: EditorState, file: string): string | undefined;
    getAllTitles(state: EditorState): Map<string, string>;
}

/**
 * 创建标题状态扩展
 * @param errorManager 错误管理器
 * @param logger 日志记录器
 * @returns 扩展的标题状态字段
 */
export function createTitleStateExtension(
    errorManager: ErrorManagerService,
    logger: Logger
): TitleStateField {
    // 定义状态效果 - 表示标题变更事件
    const titleChangeEffect = StateEffect.define<TitleChangeInfo>();
    
    // 定义状态字段 - 存储文件标题映射
    const titleStateField = StateField.define<Map<string, string>>({
        create: () => {
            return new Map<string, string>();
        },
        
        update: (titleMap, transaction) => {
            return tryCatchWrapper(
                () => {
                    // 创建新的Map实例，保持不变性
                    let newMap = new Map(titleMap);
                    
                    // 检查事务是否包含标题变更效果
                    transaction.effects.forEach(effect => {
                        if (effect.is(titleChangeEffect)) {
                            const { file, title } = effect.value;
                            if (title) {
                                newMap.set(file, title);
                            } else {
                                // 如果标题为空，移除映射
                                newMap.delete(file);
                            }
                        }
                    });
                    
                    return newMap;
                },
                'TitleStateExtension',
                errorManager,
                logger,
                {
                    errorMessage: '更新标题状态失败',
                    category: ErrorCategory.STATE,
                    level: ErrorLevel.WARNING,
                    details: { action: 'updateTitleState' }
                }
            ) || titleMap; // 保持原始状态不变
        },
        
        // 返回空扩展数组，表示此字段不提供其他扩展
        provide: () => []
    }) as TitleStateField;
    
    // 扩展状态字段，添加自定义方法
    (titleStateField as any).createTitleChangeEffect = (file: string, title: string): StateEffect<TitleChangeInfo> => {
        return titleChangeEffect.of({ file, title });
    };
    
    (titleStateField as any).getTitle = (state: EditorState, file: string): string | undefined => {
        const result = tryCatchWrapper(
            () => {
                const titleMap = state.field(titleStateField);
                return titleMap.get(file);
            },
            'TitleStateExtension',
            errorManager,
            logger,
            {
                errorMessage: '获取标题状态失败',
                category: ErrorCategory.STATE,
                level: ErrorLevel.WARNING,
                details: { action: 'getTitle', file }
            }
        );
        // 显式转换可能的null为undefined，确保类型兼容
        return result === null ? undefined : result;
    };
    
    (titleStateField as any).getAllTitles = (state: EditorState): Map<string, string> => {
        return tryCatchWrapper(
            () => {
                return new Map(state.field(titleStateField));
            },
            'TitleStateExtension',
            errorManager,
            logger,
            {
                errorMessage: '获取所有标题失败',
                category: ErrorCategory.STATE,
                level: ErrorLevel.WARNING,
                details: { action: 'getAllTitles' }
            }
        ) || new Map<string, string>();
    };
    
    return titleStateField;
} 