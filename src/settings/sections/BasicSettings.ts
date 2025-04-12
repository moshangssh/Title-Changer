import { Setting } from 'obsidian';
import { TitleChangerPlugin } from '../../main';
import { SettingSection } from './interfaces';
import { 
    createSafeRegex, 
    ErrorType, 
    ErrorSeverity, 
    getRegexErrorDescription, 
    hasCapturingGroups 
} from '../../utils/RegexHelper';

/**
 * 基本设置部分
 */
export class BasicSettingsSection implements SettingSection {
    constructor(private plugin: TitleChangerPlugin) {}
    
    /**
     * 在容器中显示基本设置
     * @param containerEl 设置容器
     */
    display(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '基本功能' });
        
        // 正则表达式设置
        const regexSetting = new Setting(containerEl)
            .setName('标题提取正则表达式')
            .setDesc('用于从文件名中提取显示名称的正则表达式。使用括号()来捕获要显示的部分。默认模式匹配日期格式(YYYY_MM_DD)后的所有内容。');
        
        // 创建正则表达式输入字段
        const regexInput = regexSetting.addText(text => {
            text.setPlaceholder('例如: .*_\\d{4}_\\d{2}_\\d{2}_(.+)$')
                .setValue(this.plugin.settings.regexPattern)
                .onChange(async (value) => {
                    // 添加实时验证
                    const result = createSafeRegex(value, '');
                    
                    // 清除旧的错误提示
                    const parentEl = text.inputEl.parentElement;
                    if (parentEl) {
                        const errorEl = parentEl.querySelector('.regex-error');
                        if (errorEl) errorEl.remove();
                        
                        // 如果有错误，显示错误提示
                        if (result.error) {
                            // 获取用户友好的错误描述
                            const friendlyError = getRegexErrorDescription(value, result.error);
                            
                            const errorEl = createDiv({
                                cls: 'regex-error',
                                text: `错误: ${friendlyError}`
                            });
                            errorEl.style.color = 'var(--text-error)';
                            parentEl.appendChild(errorEl);
                        } 
                        // 检查是否有捕获组
                        else if (result.regex && !hasCapturingGroups(result.regex)) {
                            const errorEl = createDiv({
                                cls: 'regex-warning',
                                text: `警告: 正则表达式没有包含捕获组，请使用()来标记要提取的部分`
                            });
                            errorEl.style.color = 'var(--text-warning)';
                            parentEl.appendChild(errorEl);
                        }
                    }
                    
                    this.plugin.settings.regexPattern = value;
                    await this.plugin.saveSettings();
                });
            return text;
        });
        
        // 添加测试工具
        const testContainer = containerEl.createDiv('regex-test-container');
        
        // 创建测试输入字段
        const testInputSetting = new Setting(testContainer)
            .setName('测试文件名')
            .setDesc('输入一个文件名来测试正则表达式效果');
        
        const testInput = testInputSetting.addText(text => text
            .setPlaceholder('例如: AIGC_2023_01_01_测试文档')
            .onChange(value => {
                this.updateTestResult(value, testResult);
            })
        );
        
        // 创建测试结果显示区域
        const testResultContainer = testContainer.createDiv('regex-test-result-container');
        const testResultHeading = testResultContainer.createEl('h4', { text: '测试结果:' });
        const testResult = testResultContainer.createDiv('regex-test-result');
        testResult.style.padding = '10px';
        testResult.style.marginTop = '5px';
        testResult.style.backgroundColor = 'var(--background-secondary)';
        testResult.style.borderRadius = '5px';
        
        // 初始更新测试结果
        this.updateTestResult('', testResult);
    }
    
    /**
     * 更新测试结果显示
     * @param testValue 测试输入值
     * @param resultElement 结果显示元素
     */
    private updateTestResult(testValue: string, resultElement: HTMLElement): void {
        if (!testValue) {
            resultElement.innerText = '请输入测试文本...';
            return;
        }
        
        // 测试正则表达式
        const regex = createSafeRegex(this.plugin.settings.regexPattern, '');
        
        if (!regex.regex) {
            // 获取用户友好的错误描述
            const friendlyError = getRegexErrorDescription(this.plugin.settings.regexPattern, regex.error || '未知错误');
            
            resultElement.innerText = `无法创建正则表达式: ${friendlyError}`;
            resultElement.style.color = 'var(--text-error)';
            return;
        }
        
        // 执行正则表达式匹配
        try {
            const matches = testValue.match(regex.regex);
            
            if (matches && matches.length > 1) {
                resultElement.innerHTML = `
                    <span class="test-success">匹配成功!</span>
                    <div class="test-details">
                        <div class="test-item">
                            <span class="test-label">原始文本:</span> 
                            <span class="test-value">${testValue}</span>
                        </div>
                        <div class="test-item">
                            <span class="test-label">提取结果:</span> 
                            <span class="test-value result-highlight">${matches[1]}</span>
                        </div>
                    </div>
                `;
                resultElement.className = 'regex-test-result success';
            } else if (matches && matches.length === 1) {
                // 有匹配但没有捕获组
                resultElement.innerHTML = `
                    <span class="test-warning">匹配成功，但没有捕获组!</span>
                    <div class="test-details">
                        <div class="test-item">
                            <span class="test-label">提示:</span>
                            <span class="test-value">请在正则表达式中使用括号()来捕获要提取的部分</span>
                        </div>
                        <div class="test-example">
                            <span>示例: <code>.*_(\\d{4})_.*</code> 会捕获下划线之间的年份</span>
                        </div>
                    </div>
                `;
                resultElement.className = 'regex-test-result warning';
            } else {
                // 无匹配
                resultElement.innerHTML = `
                    <span class="test-error">无匹配结果</span>
                    <div class="test-details">
                        <div class="test-item">
                            <span class="test-label">输入文本:</span>
                            <span class="test-value">${testValue}</span>
                        </div>
                        <div class="test-item">
                            <span class="test-label">正则表达式:</span>
                            <span class="test-value">${this.plugin.settings.regexPattern}</span>
                        </div>
                    </div>
                `;
                resultElement.className = 'regex-test-result error';
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            resultElement.innerHTML = `
                <span class="test-error">执行错误</span>
                <div class="test-details">
                    <div class="test-item">
                        <span class="test-label">错误信息:</span>
                        <span class="test-value">${errorMessage}</span>
                    </div>
                </div>
            `;
            resultElement.className = 'regex-test-result error';
        }
    }
} 