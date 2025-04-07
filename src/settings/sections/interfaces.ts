/**
 * 设置部分接口
 * 每个设置部分都需要实现此接口
 */
export interface SettingSection {
    /**
     * 在指定容器中显示设置部分
     * @param containerEl 要添加设置的容器元素
     */
    display(containerEl: HTMLElement): void;
} 