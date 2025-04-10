/**
 * 使用Title Changer插件相同的正则表达式从文件名中提取标题
 * 适用于Obsidian Templater插件
 * 
 * @param {object} tp - Templater提供的对象
 * @param {string} [customRegex] - 可选的自定义正则表达式，如果不提供将尝试从Title Changer插件获取
 * @returns {string} 提取的标题
 */
function getTitleFromFilename(tp, customRegex) {
    // 获取当前文件的文件名（不含扩展名）
    const filename = tp.file.title;
    
    // 尝试从Title Changer插件获取正则表达式
    let regexPattern = customRegex;
    
    if (!regexPattern) {
        try {
            // 尝试获取Title Changer插件的设置
            const titleChangerPlugin = tp.app.plugins.plugins['title-changer'];
            if (titleChangerPlugin && titleChangerPlugin.settings && titleChangerPlugin.settings.regexPattern) {
                regexPattern = titleChangerPlugin.settings.regexPattern;
            } else {
                // 如果没有找到插件或设置，使用默认正则表达式
                regexPattern = '.*_\\d{4}_\\d{2}_\\d{2}_(.+)$';
            }
        } catch (error) {
            console.error('无法从Title Changer插件获取正则表达式:', error);
            // 使用默认正则表达式作为备选
            regexPattern = '.*_\\d{4}_\\d{2}_\\d{2}_(.+)$';
        }
    }
    
    try {
        // 创建正则表达式对象
        const regex = new RegExp(regexPattern);
        
        // 执行正则匹配
        const match = regex.exec(filename);
        
        // 如果没有匹配，返回原始文件名
        if (!match) {
            return filename;
        }
        
        // 如果有捕获组，返回第一个捕获组
        if (match.length > 1) {
            return match[1];
        }
        
        // 如果只有整个匹配（没有捕获组），返回整个匹配
        return match[0];
    } catch (error) {
        console.error('正则表达式处理错误:', error);
        // 出错时返回原始文件名
        return filename;
    }
}

// 为Templater提供的用法示例:
// <% 
//   // 使用Title Changer插件的正则表达式
//   const extractedTitle = getTitleFromFilename(tp);
//   
//   // 或者提供自定义正则表达式
//   // const extractedTitle = getTitleFromFilename(tp, '自定义正则表达式');
//   
//   tp.file.content = tp.file.content.replace("{{title}}", extractedTitle); 
//   
//   // 或者直接设置为frontmatter的title属性
//   const yaml = tp.frontmatter;
//   yaml.title = extractedTitle;
//   tp.file.yaml = yaml;
// %>

module.exports = getTitleFromFilename; 