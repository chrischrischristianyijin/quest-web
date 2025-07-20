// 加载模板的工具函数
async function loadTemplate(templateName) {
    try {
        const response = await fetch(`/templates/${templateName}.html`);
        if (!response.ok) {
            throw new Error(`Failed to load template: ${templateName}`);
        }
        return await response.text();
    } catch (error) {
        console.error('Error loading template:', error);
        return '';
    }
}

// 将模板插入到指定元素
async function insertTemplate(templateName, targetSelector) {
    const template = await loadTemplate(templateName);
    const targetElement = document.querySelector(targetSelector);
    if (targetElement) {
        targetElement.innerHTML = template;
    }
}

export { loadTemplate, insertTemplate }; 