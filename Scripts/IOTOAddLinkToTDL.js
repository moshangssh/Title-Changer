async function IOTOAddLinkToTDL(tp, tR, settings) {

    if(!tR) return;
    
    let {taskFolder, targetHeading, headingLevel, tdlDateFormat} = settings; 
    const activeFile = tp.config.active_file;
    const activeBasePath = activeFile.path.split("/").first();
    const project = app.metadataCache.getFileCache(activeFile)?.frontmatter?.Project;
    
    if(!project || !project.length) {
        new tp.obsidian.Notice("您已经开启了将链接添加到当前TDL的功能，但是您的笔记中缺少Project属性，因此无法将您的链接添加到对应的TDL中。");
        return "";
    }
    if(taskFolder !== activeBasePath) {
        
        let currentTDL = "";
        if(Array.isArray(project) && project.length >= 2) {
            currentTDL = project[0] + "_" + tp.date.now(tdlDateFormat) + "_" + project[1];
        } else if(typeof project === "string") {
            currentTDL = project + "_" + tp.date.now(tdlDateFormat);
        } else {
            new tp.obsidian.Notice("Project属性格式不正确，无法生成TDL文件名。");
            return "";
        }
        const tdlFile = tp.file.find_tfile(currentTDL);

        if(!tdlFile) {
            new tp.obsidian.Notice(`您已经开启了将链接添加到当前TDL的功能，但是${currentTDL}文件不存在，因此无法将您的链接添加到对应的TDL中。`);
            return "";
        }

        const tdlFileLinks = app.metadataCache.getFileCache(tdlFile)?.links?.map(link => "[[" + link.link + "]]");
    
        if(!tdlFileLinks || !tdlFileLinks.includes(tR)){
            await app.vault.process(tdlFile, (data) => {
                const lines = data.split("\n");
                if(targetHeading !== "") {
                    const position = lines.indexOf(headingLevel + " " + targetHeading);
                    lines.splice(position-1, 0, "- [ ] " + tR);
                } else {
                    lines.push("- [ ] " + tR);
                }  
                return lines.join("\n");
            });
        }
    }
}

module.exports = IOTOAddLinkToTDL;