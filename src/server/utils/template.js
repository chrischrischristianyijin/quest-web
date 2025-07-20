import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function renderTemplate(filePath, options = {}) {
    try {
        const [footer, content] = await Promise.all([
            fs.readFile(path.join(__dirname, '../../templates/footer.html'), 'utf8'),
            fs.readFile(filePath, 'utf8')
        ]);

        let fullPage = content + footer;

        // 替换模板变量
        Object.entries(options).forEach(([key, value]) => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            fullPage = fullPage.replace(regex, value);
        });

        return fullPage;
    } catch (error) {
        console.error('Error rendering template:', error);
        throw error;
    }
} 