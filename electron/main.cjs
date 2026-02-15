// Electron Main Process - Leaf note-taking app
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { pathToFileURL } = require('url');
const JSZip = require('jszip');

let mainWindow = null;

function createWindow() {
    // Set app icon based on platform
    const iconPath = process.platform === 'darwin'
        ? path.join(__dirname, '../build/icon.icns')
        : path.join(__dirname, '../build/icon.icns');

    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 1000,
        minHeight: 700,
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false, // Security: don't expose Node to renderer
            contextIsolation: true,  // Security: isolate contexts
            sandbox: false,
            webSecurity: false, // Allow loading local files (required for video/media)
            // Disable all browser-like storage mechanisms
            partition: 'persist:leaf', // Use persistent session
            cache: false, // Disable HTTP cache
            spellcheck: true // Enable spellcheck
        },
        backgroundColor: '#1a1a1a',
        titleBarStyle: 'hiddenInset', // macOS style
        show: false // Don't show until ready
    });

    // Enable context menu with spellcheck suggestions
    mainWindow.webContents.on('context-menu', (event, params) => {
        const menu = Menu.buildFromTemplate([
            // Spellcheck suggestions
            ...params.dictionarySuggestions.map(suggestion => ({
                label: suggestion,
                click: () => mainWindow.webContents.replaceMisspelling(suggestion)
            })),
            // Separator if there are suggestions
            ...(params.dictionarySuggestions.length > 0 ? [{ type: 'separator' }] : []),
            // Add to dictionary option
            ...(params.misspelledWord ? [{
                label: 'Add to Dictionary',
                click: () => mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
            }] : []),
            // Separator before standard options
            ...(params.misspelledWord ? [{ type: 'separator' }] : []),
            // Standard editing options
            { role: 'cut', visible: params.isEditable },
            { role: 'copy', visible: params.selectionText.length > 0 },
            { role: 'paste', visible: params.isEditable },
            { type: 'separator', visible: params.isEditable || params.selectionText.length > 0 },
            { role: 'selectAll' }
        ]);
        menu.popup();
    });

    // Load the app
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Initialize app
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows closed (except macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Handle errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

// IPC Handlers for file system operations

// Open folder dialog and return the selected path
ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Your Notes Folder',
        buttonLabel: 'Select Folder'
    });

    if (result.canceled) {
        return null;
    }

    return result.filePaths[0];
});

// Recursively scan a folder for text, code, image and video files
async function scanFolder(folderPath, basePath = folderPath) {
    const files = [];
    const folders = [];
    // Text and markdown files
    const textExtensions = ['.txt', '.md'];
    // Code files
    const codeExtensions = [
        '.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.htm', '.css', '.scss', '.sass', '.less',
        '.vue', '.svelte', '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.conf', '.cfg',
        '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
        '.c', '.cpp', '.h', '.hpp', '.cs', '.java', '.kt', '.kts', '.go', '.rs', '.rb', '.php',
        '.swift', '.m', '.mm', '.r', '.R', '.pl', '.pm', '.lua', '.sql', '.graphql', '.gql',
        '.dockerfile', '.env', '.gitignore', '.gitattributes', '.editorconfig', '.eslintrc',
        '.prettierrc', '.babelrc', '.npmrc', '.nvmrc', '.cjs'
    ];
    // Image files
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
    // Video files
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
    // Audio files
    const audioExtensions = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.aiff'];
    // PDF files
    const pdfExtensions = ['.pdf'];
    // Drawing files
    const drawingExtensions = ['.drawing'];
    // Document files (ODT)
    const documentExtensions = ['.odt'];
    const allowedExtensions = [...textExtensions, ...codeExtensions, ...imageExtensions, ...videoExtensions, ...audioExtensions, ...pdfExtensions, ...drawingExtensions, ...documentExtensions];

    try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name);
            const relativePath = path.relative(basePath, fullPath);

            if (entry.isDirectory()) {
                // Add the folder itself
                folders.push({
                    name: entry.name,
                    path: fullPath,
                    relativePath: relativePath,
                    type: 'folder',
                    folder: path.dirname(relativePath)
                });

                // Recursively scan subdirectories
                const subResult = await scanFolder(fullPath, basePath);
                files.push(...subResult.files);
                folders.push(...subResult.folders);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (allowedExtensions.includes(ext)) {
                    const stats = await fs.stat(fullPath);
                    files.push({
                        name: entry.name,
                        path: fullPath,
                        relativePath: relativePath,
                        extension: ext,
                        size: stats.size,
                        modified: stats.mtime.toISOString(),
                        folder: path.dirname(relativePath)
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error scanning folder:', error);
    }

    return { files, folders };
}

// Get all files from a folder
ipcMain.handle('files:scan', async (event, folderPath) => {
    try {
        const result = await scanFolder(folderPath);
        return { success: true, files: result.files, folders: result.folders };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Read a file's content
ipcMain.handle('file:read', async (event, filePath) => {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return { success: true, content };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Read an image file as base64 data URL
ipcMain.handle('file:readImage', async (event, filePath) => {
    try {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.bmp': 'image/bmp',
            '.ico': 'image/x-icon'
        };
        const mimeType = mimeTypes[ext] || 'image/png';
        const imageBuffer = await fs.readFile(filePath);
        const base64 = imageBuffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64}`;
        return { success: true, dataUrl };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Read an audio file as base64 data URL
ipcMain.handle('file:readAudio', async (event, filePath) => {
    try {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.flac': 'audio/flac',
            '.aac': 'audio/aac',
            '.m4a': 'audio/mp4',
            '.ogg': 'audio/ogg',
            '.wma': 'audio/x-ms-wma',
            '.aiff': 'audio/aiff'
        };
        const mimeType = mimeTypes[ext] || 'audio/mpeg';
        const audioBuffer = await fs.readFile(filePath);
        const base64 = audioBuffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64}`;
        return { success: true, dataUrl };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Read an ODT file and convert to HTML with formatting
ipcMain.handle('file:readOdt', async (event, filePath) => {
    try {
        const buffer = await fs.readFile(filePath);
        const zip = await JSZip.loadAsync(buffer);
        const contentXml = await zip.file('content.xml').async('string');

        // Parse automatic styles to build a style map
        const styleMap = {};
        const styleRegex = /<style:style\s+style:name="([^"]+)"[^>]*style:family="([^"]+)"[^>]*>([\s\S]*?)<\/style:style>/g;
        let styleMatch;
        while ((styleMatch = styleRegex.exec(contentXml)) !== null) {
            const styleName = styleMatch[1];
            const styleBody = styleMatch[3];
            const props = {};
            // Check for bold
            if (/font-weight\s*=\s*"bold"/i.test(styleBody)) props.bold = true;
            // Check for italic
            if (/font-style\s*=\s*"italic"/i.test(styleBody)) props.italic = true;
            // Check for underline
            if (/text-underline-style\s*=\s*"solid"/i.test(styleBody)) props.underline = true;
            // Check for strikethrough
            if (/text-line-through-style\s*=\s*"solid"/i.test(styleBody)) props.strikethrough = true;
            styleMap[styleName] = props;
        }

        // Also parse styles.xml for named styles (headings etc.)
        let stylesXml = '';
        try {
            const stylesFile = zip.file('styles.xml');
            if (stylesFile) {
                stylesXml = await stylesFile.async('string');
            }
        } catch (e) { /* ignore */ }

        // Helper: convert inline content of a paragraph to HTML
        function convertInlineContent(xmlContent) {
            if (!xmlContent) return '';
            let result = '';
            // Process character by character using a simple state machine
            // Split on tags while keeping them
            const parts = xmlContent.split(/(<[^>]+>)/);
            const formatStack = [];

            for (const part of parts) {
                if (!part) continue;

                if (part.startsWith('<text:span')) {
                    // Extract style name
                    const nameMatch = part.match(/text:style-name="([^"]+)"/);
                    if (nameMatch) {
                        const style = styleMap[nameMatch[1]] || {};
                        let openTags = '';
                        let tags = [];
                        if (style.bold) { openTags += '<b>'; tags.push('b'); }
                        if (style.italic) { openTags += '<i>'; tags.push('i'); }
                        if (style.underline) { openTags += '<u>'; tags.push('u'); }
                        if (style.strikethrough) { openTags += '<s>'; tags.push('s'); }
                        formatStack.push(tags);
                        result += openTags;
                    } else {
                        formatStack.push([]);
                    }
                } else if (part === '</text:span>') {
                    const tags = formatStack.pop() || [];
                    // Close in reverse order
                    for (let i = tags.length - 1; i >= 0; i--) {
                        result += `</${tags[i]}>`;
                    }
                } else if (part === '<text:line-break/>') {
                    result += '<br>';
                } else if (part.startsWith('<text:s')) {
                    // Spaces: <text:s text:c="3"/> or <text:s/>
                    const countMatch = part.match(/text:c="(\d+)"/);
                    const count = countMatch ? parseInt(countMatch[1]) : 1;
                    result += '&nbsp;'.repeat(count);
                } else if (part === '<text:tab/>') {
                    result += '&emsp;';
                } else if (part.startsWith('<text:a')) {
                    // Hyperlinks
                    const hrefMatch = part.match(/xlink:href="([^"]+)"/);
                    if (hrefMatch) {
                        result += `<a href="${hrefMatch[1]}">`;
                    }
                } else if (part === '</text:a>') {
                    result += '</a>';
                } else if (part.startsWith('<')) {
                    // Skip other XML tags
                } else {
                    // Plain text - decode XML entities
                    result += part
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .replace(/&apos;/g, "'");
                }
            }
            return result;
        }

        // Helper: detect heading level from paragraph style name
        function getHeadingLevel(styleName) {
            if (!styleName) return 0;
            // ODF heading styles: "Heading_20_1", "Heading_20_2", etc.
            const headingMatch = styleName.match(/Heading[_\s]*(?:20[_\s]*)?(\d)/i);
            if (headingMatch) return parseInt(headingMatch[1]);
            return 0;
        }

        // Process the document body
        let htmlContent = '';

        // Extract the office:text body content
        const bodyMatch = contentXml.match(/<office:text[^>]*>([\s\S]*)<\/office:text>/);
        if (!bodyMatch) {
            return { success: true, content: '' };
        }
        const bodyXml = bodyMatch[1];

        // Process lists
        function processList(listXml, ordered) {
            const tag = ordered ? 'ol' : 'ul';
            let listHtml = `<${tag}>`;
            // Match list items
            const itemRegex = /<text:list-item[^>]*>([\s\S]*?)<\/text:list-item>/g;
            let itemMatch;
            while ((itemMatch = itemRegex.exec(listXml)) !== null) {
                const itemContent = itemMatch[1];
                // Extract paragraph content from list item
                const itemPRegex = /<text:p[^>]*>([\s\S]*?)<\/text:p>/g;
                let pMatch;
                let itemHtml = '<li>';
                while ((pMatch = itemPRegex.exec(itemContent)) !== null) {
                    itemHtml += convertInlineContent(pMatch[1]);
                }
                // Check for nested lists
                const nestedListMatch = itemContent.match(/<text:list[^>]*>([\s\S]*?)<\/text:list>/);
                if (nestedListMatch) {
                    itemHtml += processList(nestedListMatch[0], ordered);
                }
                itemHtml += '</li>';
                listHtml += itemHtml;
            }
            listHtml += `</${tag}>`;
            return listHtml;
        }

        // Process top-level elements in order
        // We match paragraphs, headings, and lists at the top level
        const elementRegex = /<text:(p|h|list|list-style)[^>]*(?:text:outline-level="(\d+)")?[^>]*>([\s\S]*?)<\/text:\1>|<text:(p|h)\s[^>]*\/>/g;

        // Better approach: split body into top-level elements
        const topLevelRegex = /(<text:(?:p|h)\s[^>]*>[\s\S]*?<\/text:(?:p|h)>|<text:(?:p|h)\s[^>]*\/>|<text:list[^>]*>[\s\S]*?<\/text:list>)/g;
        let elemMatch;

        while ((elemMatch = topLevelRegex.exec(bodyXml)) !== null) {
            const elem = elemMatch[1];

            if (elem.startsWith('<text:list')) {
                // Determine if ordered or unordered
                // ODF doesn't directly say - check style for numbering
                // Default to unordered
                htmlContent += processList(elem, false);
            } else if (elem.startsWith('<text:h')) {
                // Heading element
                const levelMatch = elem.match(/text:outline-level="(\d+)"/);
                const level = levelMatch ? Math.min(parseInt(levelMatch[1]), 6) : 1;
                const innerMatch = elem.match(/<text:h[^>]*>([\s\S]*?)<\/text:h>/);
                const innerContent = innerMatch ? convertInlineContent(innerMatch[1]) : '';
                htmlContent += `<h${level}>${innerContent}</h${level}>`;
            } else if (elem.startsWith('<text:p')) {
                // Regular paragraph
                const styleNameMatch = elem.match(/text:style-name="([^"]+)"/);
                const styleName = styleNameMatch ? styleNameMatch[1] : '';
                const headingLevel = getHeadingLevel(styleName);

                const innerMatch = elem.match(/<text:p[^>]*>([\s\S]*?)<\/text:p>/);
                const innerContent = innerMatch ? convertInlineContent(innerMatch[1]) : '';

                // Empty paragraph becomes <p><br></p> so it takes space
                const displayContent = innerContent || '<br>';

                if (headingLevel > 0 && headingLevel <= 6) {
                    htmlContent += `<h${headingLevel}>${displayContent}</h${headingLevel}>`;
                } else {
                    htmlContent += `<p>${displayContent}</p>`;
                }
            }
        }

        return { success: true, content: htmlContent };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Write HTML content back to an ODT file, converting to ODF XML
ipcMain.handle('file:writeOdt', async (event, filePath, htmlContent) => {
    try {
        const buffer = await fs.readFile(filePath);
        const zip = await JSZip.loadAsync(buffer);

        // Helper: escape XML special characters
        function escapeXml(text) {
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        }

        // Track auto styles we need
        const autoStyles = {};
        let styleCounter = 0;

        function getStyleName(props) {
            // Create a unique key for this combination
            const key = Object.keys(props).sort().join(',');
            if (!autoStyles[key]) {
                styleCounter++;
                autoStyles[key] = { name: `T${styleCounter}`, props };
            }
            return autoStyles[key].name;
        }

        // Convert HTML inline content to ODF XML
        function convertHtmlInline(html) {
            if (!html) return '';

            // Simple HTML parser for inline content
            let odf = '';
            const parts = html.split(/(<[^>]+>)/);
            const formatStack = []; // stack of active format properties

            for (const part of parts) {
                if (!part) continue;

                const tagMatch = part.match(/^<(\/?)(\w+)([^>]*)>$/);
                if (tagMatch) {
                    const isClosing = tagMatch[1] === '/';
                    const tagName = tagMatch[2].toLowerCase();

                    if (tagName === 'br') {
                        odf += '<text:line-break/>';
                    } else if (tagName === 'a' && !isClosing) {
                        const hrefMatch = tagMatch[3].match(/href="([^"]+)"/);
                        if (hrefMatch) {
                            odf += `<text:a xlink:type="simple" xlink:href="${escapeXml(hrefMatch[1])}">`;
                        }
                    } else if (tagName === 'a' && isClosing) {
                        odf += '</text:a>';
                    } else if (!isClosing && (tagName === 'b' || tagName === 'strong')) {
                        formatStack.push('bold');
                    } else if (!isClosing && (tagName === 'i' || tagName === 'em')) {
                        formatStack.push('italic');
                    } else if (!isClosing && tagName === 'u') {
                        formatStack.push('underline');
                    } else if (!isClosing && (tagName === 's' || tagName === 'del' || tagName === 'strike')) {
                        formatStack.push('strikethrough');
                    } else if (isClosing && (tagName === 'b' || tagName === 'strong' || tagName === 'i' || tagName === 'em' || tagName === 'u' || tagName === 's' || tagName === 'del' || tagName === 'strike')) {
                        formatStack.pop();
                    }
                    // Other tags are ignored
                } else {
                    // Text content
                    const text = part
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&emsp;/g, '\t')
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"');

                    if (formatStack.length > 0) {
                        // Build style properties from active formats
                        const props = {};
                        for (const fmt of formatStack) {
                            props[fmt] = true;
                        }
                        const styleName = getStyleName(props);
                        odf += `<text:span text:style-name="${styleName}">${escapeXml(text)}</text:span>`;
                    } else {
                        odf += escapeXml(text);
                    }
                }
            }
            return odf;
        }

        // Convert HTML to ODF body elements
        let odfBody = '';

        // Parse block-level elements
        // Split HTML into block elements
        const blockRegex = /(<(?:h[1-6]|p|ul|ol|li|div|blockquote)[^>]*>[\s\S]*?<\/(?:h[1-6]|p|ul|ol|li|div|blockquote)>|<(?:h[1-6]|p|div|br)\s*\/?>)/gi;

        // Better approach: process the HTML hierarchically
        function htmlToOdf(html) {
            let result = '';

            // Match top-level block elements
            const topBlockRegex = /<(h[1-6]|p|ul|ol|blockquote|div)(\s[^>]*)?>[\s\S]*?<\/\1>|<(br|hr)\s*\/?>/gi;
            let blockMatch;
            let lastIndex = 0;

            while ((blockMatch = topBlockRegex.exec(html)) !== null) {
                // Handle any text between blocks
                const between = html.slice(lastIndex, blockMatch.index).trim();
                if (between) {
                    result += `<text:p text:style-name="Standard">${convertHtmlInline(between)}</text:p>`;
                }
                lastIndex = blockMatch.index + blockMatch[0].length;

                const fullMatch = blockMatch[0];
                const tagName = (blockMatch[1] || blockMatch[3] || '').toLowerCase();

                if (tagName === 'br' || tagName === 'hr') {
                    result += '<text:p text:style-name="Standard"/>';
                } else if (tagName.startsWith('h')) {
                    const level = parseInt(tagName[1]);
                    const innerMatch = fullMatch.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i);
                    const inner = innerMatch ? innerMatch[1] : '';
                    result += `<text:h text:style-name="Heading_20_${level}" text:outline-level="${level}">${convertHtmlInline(inner)}</text:h>`;
                } else if (tagName === 'p' || tagName === 'div') {
                    const innerMatch = fullMatch.match(/<(?:p|div)[^>]*>([\s\S]*?)<\/(?:p|div)>/i);
                    const inner = innerMatch ? innerMatch[1] : '';
                    // Check if inner content is just <br> (empty paragraph)
                    const cleanInner = inner.replace(/<br\s*\/?>/gi, '').trim();
                    if (!cleanInner) {
                        result += '<text:p text:style-name="Standard"/>';
                    } else {
                        result += `<text:p text:style-name="Standard">${convertHtmlInline(inner)}</text:p>`;
                    }
                } else if (tagName === 'ul' || tagName === 'ol') {
                    result += convertList(fullMatch);
                } else if (tagName === 'blockquote') {
                    const innerMatch = fullMatch.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);
                    const inner = innerMatch ? innerMatch[1] : '';
                    // Convert blockquote paragraphs
                    const pRegex2 = /<p[^>]*>([\s\S]*?)<\/p>/gi;
                    let pMatch2;
                    while ((pMatch2 = pRegex2.exec(inner)) !== null) {
                        result += `<text:p text:style-name="Quotations">${convertHtmlInline(pMatch2[1])}</text:p>`;
                    }
                }
            }

            // Handle remaining text after last block
            const remaining = html.slice(lastIndex).trim();
            if (remaining) {
                result += `<text:p text:style-name="Standard">${convertHtmlInline(remaining)}</text:p>`;
            }

            // If no blocks were found, treat entire content as a single paragraph
            if (!result && html.trim()) {
                result = `<text:p text:style-name="Standard">${convertHtmlInline(html)}</text:p>`;
            }

            return result;
        }

        function convertList(listHtml) {
            let result = '<text:list>';
            const itemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
            let itemMatch;
            while ((itemMatch = itemRegex.exec(listHtml)) !== null) {
                let itemContent = itemMatch[1];
                result += '<text:list-item>';
                // Check for nested lists
                const nestedListMatch = itemContent.match(/<(ul|ol)[^>]*>[\s\S]*<\/\1>/i);
                if (nestedListMatch) {
                    // Remove nested list from item content
                    itemContent = itemContent.replace(/<(ul|ol)[^>]*>[\s\S]*<\/\1>/i, '');
                }
                // Item text as paragraph
                const cleanText = itemContent.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1').trim();
                if (cleanText) {
                    result += `<text:p text:style-name="List_20_Contents">${convertHtmlInline(cleanText)}</text:p>`;
                }
                // Add nested list
                if (nestedListMatch) {
                    result += convertList(nestedListMatch[0]);
                }
                result += '</text:list-item>';
            }
            result += '</text:list>';
            return result;
        }

        odfBody = htmlToOdf(htmlContent);

        // Build automatic styles XML
        let autoStylesXml = '<office:automatic-styles>\n';
        autoStylesXml += '    <style:style style:name="Standard" style:family="paragraph"/>\n';
        for (const key of Object.keys(autoStyles)) {
            const { name, props } = autoStyles[key];
            autoStylesXml += `    <style:style style:name="${name}" style:family="text">\n`;
            autoStylesXml += '      <style:text-properties';
            if (props.bold) autoStylesXml += ' fo:font-weight="bold" style:font-weight-asian="bold" style:font-weight-complex="bold"';
            if (props.italic) autoStylesXml += ' fo:font-style="italic" style:font-style-asian="italic" style:font-style-complex="italic"';
            if (props.underline) autoStylesXml += ' style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"';
            if (props.strikethrough) autoStylesXml += ' style:text-line-through-style="solid"';
            autoStylesXml += '/>\n';
            autoStylesXml += '    </style:style>\n';
        }
        autoStylesXml += '  </office:automatic-styles>';

        const newContentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  office:version="1.3">
  ${autoStylesXml}
  <office:body>
    <office:text>
      ${odfBody}
    </office:text>
  </office:body>
</office:document-content>`;

        zip.file('content.xml', newContentXml);

        const outputBuffer = await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 },
            // mimetype must be first and uncompressed per ODF spec
            mimeType: 'application/vnd.oasis.opendocument.text'
        });

        await fs.writeFile(filePath, outputBuffer);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Write content to a file
ipcMain.handle('file:write', async (event, filePath, content) => {
    try {
        await fs.writeFile(filePath, content, 'utf-8');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Create a new file
ipcMain.handle('file:create', async (event, folderPath, fileName) => {
    try {
        const filePath = path.join(folderPath, fileName);
        await fs.writeFile(filePath, '', 'utf-8');
        return { success: true, path: filePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Create a new folder
ipcMain.handle('folder:create', async (event, parentPath, folderName) => {
    try {
        const folderPath = path.join(parentPath, folderName);

        // Check if folder already exists
        try {
            await fs.access(folderPath);
            return { success: false, error: 'A folder with this name already exists' };
        } catch {
            // Folder doesn't exist, proceed with creation
        }

        await fs.mkdir(folderPath, { recursive: true });
        return { success: true, path: folderPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Delete a file (move to trash)
ipcMain.handle('file:delete', async (event, filePath) => {
    try {
        await shell.trashItem(filePath);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Rename a file
ipcMain.handle('file:rename', async (event, oldPath, newFileName) => {
    try {
        const directory = path.dirname(oldPath);
        const newPath = path.join(directory, newFileName);

        // Check if file with new name already exists
        try {
            await fs.access(newPath);
            return { success: false, error: 'A file with this name already exists' };
        } catch {
            // File doesn't exist, safe to rename
        }

        await fs.rename(oldPath, newPath);
        return { success: true, newPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Rename a folder
ipcMain.handle('folder:rename', async (event, oldPath, newFolderName) => {
    try {
        const parentDirectory = path.dirname(oldPath);
        const newPath = path.join(parentDirectory, newFolderName);

        // Check if folder with new name already exists
        try {
            await fs.access(newPath);
            return { success: false, error: 'A folder with this name already exists' };
        } catch {
            // Folder doesn't exist, safe to rename
        }

        await fs.rename(oldPath, newPath);
        return { success: true, newPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Delete a folder (move to trash)
ipcMain.handle('folder:delete', async (event, folderPath) => {
    try {
        await shell.trashItem(folderPath);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Move a file to a different folder
ipcMain.handle('file:move', async (event, filePath, targetFolderPath) => {
    try {
        const fileName = path.basename(filePath);
        const newPath = path.join(targetFolderPath, fileName);

        // If source and destination are the same, just return success
        if (filePath === newPath) {
            return { success: true, newPath };
        }

        // Check if file with same name already exists in target folder
        try {
            await fs.access(newPath);
            return { success: false, error: 'A file with this name already exists in the target folder' };
        } catch {
            // File doesn't exist, safe to move
        }

        await fs.rename(filePath, newPath);
        return { success: true, newPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Move a folder to a different parent folder
ipcMain.handle('folder:move', async (event, folderPath, targetFolderPath) => {
    try {
        const folderName = path.basename(folderPath);
        const newPath = path.join(targetFolderPath, folderName);

        // If source and destination are the same, just return success
        if (folderPath === newPath) {
            return { success: true, newPath };
        }

        // Prevent moving a folder into itself or its own subdirectory
        if (targetFolderPath.startsWith(folderPath + path.sep) || targetFolderPath === folderPath) {
            return { success: false, error: 'Cannot move a folder into itself' };
        }

        // Check if folder with same name already exists in target folder
        try {
            await fs.access(newPath);
            return { success: false, error: 'A folder with this name already exists in the target folder' };
        } catch {
            // Folder doesn't exist, safe to move
        }

        await fs.rename(folderPath, newPath);
        return { success: true, newPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Get spelling suggestions for a word
ipcMain.handle('spellcheck:getSuggestions', async (event, word) => {
    try {
        const suggestions = event.sender.session.availableSpellCheckerLanguages;
        // Use Chromium's spell checker to get suggestions
        // Note: Electron doesn't expose direct API for suggestions, so we return empty array
        // The context menu will be handled by Chromium's native spellcheck
        return { success: true, suggestions: [] };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Save audio recording as WAV file
ipcMain.handle('audio:saveRecording', async (event, folderPath, fileName, base64Data) => {
    try {
        const filePath = path.join(folderPath, fileName);

        // Convert base64 to buffer
        const audioBuffer = Buffer.from(base64Data, 'base64');

        // Write the file
        await fs.writeFile(filePath, audioBuffer);

        return { success: true, path: filePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ============================
// AI / LLM IPC Handlers
// ============================
const aiService = require('./ai-service.cjs');
const conversationService = require('./conversation-service.cjs');
const agentService = require('./agent-service.cjs');

// Initialize conversation storage in app's userData directory
conversationService.init(app.getPath('userData'));

// List available models in ~/leaf-models/
ipcMain.handle('ai:listModels', async () => {
    return await aiService.listModels();
});

// Load a model by file path
ipcMain.handle('ai:loadModel', async (event, modelPath) => {
    return await aiService.loadModel(modelPath);
});

// Unload the current model
ipcMain.handle('ai:unloadModel', async () => {
    return await aiService.unloadModel();
});

// Send a chat message with streaming tokens
ipcMain.handle('ai:chat', async (event, userMessage, noteContext) => {
    return await aiService.chat(
        userMessage,
        (token) => {
            // Stream each token to the renderer process
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('ai:token', token);
            }
        },
        noteContext
    );
});

// Reset chat session (clear history)
ipcMain.handle('ai:resetChat', async () => {
    return await aiService.resetChat();
});

// Stop the current generation
ipcMain.handle('ai:stopChat', async () => {
    return aiService.stopChat();
});

// Get AI service status
ipcMain.handle('ai:getStatus', async () => {
    return aiService.getStatus();
});

// Open the models directory in Finder/Explorer
ipcMain.handle('ai:openModelsDir', async () => {
    return await aiService.openModelsDir();
});

// ============================
// Conversation Persistence IPC Handlers
// ============================

// List all conversations (metadata only)
ipcMain.handle('conversations:list', async () => {
    return await conversationService.listConversations();
});

// Create a new conversation
ipcMain.handle('conversations:create', async (event, modelName) => {
    return await conversationService.createConversation(modelName);
});

// Load a full conversation by ID
ipcMain.handle('conversations:load', async (event, id) => {
    return await conversationService.loadConversation(id);
});

// Save a full conversation object
ipcMain.handle('conversations:save', async (event, conversation) => {
    return await conversationService.saveConversation(conversation);
});

// Add a message to a conversation
ipcMain.handle('conversations:addMessage', async (event, conversationId, message) => {
    return await conversationService.addMessage(conversationId, message);
});

// Update the last message (for streaming completion)
ipcMain.handle('conversations:updateLastMessage', async (event, conversationId, content) => {
    return await conversationService.updateLastMessage(conversationId, content);
});

// Delete a conversation
ipcMain.handle('conversations:delete', async (event, id) => {
    return await conversationService.deleteConversation(id);
});

// Rename a conversation
ipcMain.handle('conversations:rename', async (event, id, newTitle) => {
    return await conversationService.renameConversation(id, newTitle);
});

// ============================
// Agent Mode IPC Handlers
// ============================

// Read a file for the agent (scoped to workspace)
ipcMain.handle('agent:readFile', async (event, filePath, workspacePath) => {
    return await agentService.readFileForAgent(filePath, workspacePath);
});

// Propose an edit (backup + write)
ipcMain.handle('agent:proposeEdit', async (event, filePath, newContent, workspacePath) => {
    return await agentService.proposeEdit(filePath, newContent, workspacePath);
});

// Approve a pending edit
ipcMain.handle('agent:approveEdit', async (event, editId) => {
    return await agentService.approveEdit(editId);
});

// Reject a pending edit (restore from backup)
ipcMain.handle('agent:rejectEdit', async (event, editId) => {
    return await agentService.rejectEdit(editId);
});

// Get all pending edits
ipcMain.handle('agent:getPendingEdits', async () => {
    return agentService.getPendingEdits();
});
