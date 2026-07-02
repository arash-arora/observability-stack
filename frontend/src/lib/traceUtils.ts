export const safeParseJSON = (val: any): any => {
    let curr = val;
    if (typeof curr === 'string') {
        try {
            // 1. Unwrap multiple layers of JSON strings
            while (typeof curr === 'string') {
                const trimmed = curr.trim();
                // Only attempt parse if it looks like an object or array to avoid "123" -> 123
                if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
                    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
                    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
                    trimmed === 'true' || trimmed === 'false' || trimmed === 'null'
                ) {
                    try {
                        const parsed = JSON.parse(curr);
                        curr = parsed;
                    } catch {
                        break; 
                    }
                } else {
                    break;
                }
            }
        } catch (e) {
            // Ignore
        }
    }

    // 2. Handle Python-style dict strings (fallback)
    if (typeof curr === 'string' && curr.trim().startsWith('{')) {
        try {
            let fixed = curr
                .replace(/'/g, '"') 
                .replace(/True/g, 'true')
                .replace(/False/g, 'false')
                .replace(/None/g, 'null');
            return JSON.parse(fixed);
        } catch {
            return curr;
        }
    }
    return curr;
};

export const extractContent = (data: any): string => {
    if (data === null || data === undefined) return '';

    const parsed = safeParseJSON(data);

    if (typeof parsed === 'string') {
        return parsed;
    }

    if (Array.isArray(parsed)) {
        const isMessageList = parsed.every(item => typeof item === 'object' && item !== null && ('role' in item || 'content' in item || 'text' in item || 'type' in item));
        
        if (isMessageList) {
            return parsed.map(msg => {
                const role = msg.role ? `${msg.role}: ` : '';
                const rawContent = msg.content || msg.text || msg.message || '';
                const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
                let msgStr = `${role}${content}`;
                if ('tool_calls' in msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
                    msgStr += ` [Tool Calls: ${msg.tool_calls.map((tc: any) => tc.name || tc.function?.name || 'unknown').join(', ')}]`;
                }
                return msgStr;
            }).join(' \n ');
        }
        return parsed.map(item => extractContent(item)).filter(Boolean).join(' ');
    }

    if (typeof parsed === 'object' && parsed !== null) {
        if ('content' in parsed && parsed.content !== undefined && parsed.content !== null) {
            return extractContent(parsed.content);
        }
        if ('text' in parsed && parsed.text !== undefined && parsed.text !== null) {
            return extractContent(parsed.text);
        }
        if ('message' in parsed && parsed.message !== undefined && parsed.message !== null) {
            return extractContent(parsed.message);
        }
        if ('messages' in parsed && parsed.messages !== undefined && parsed.messages !== null) {
            return extractContent(parsed.messages);
        }
        if ('prompt' in parsed && parsed.prompt !== undefined && parsed.prompt !== null) {
            return extractContent(parsed.prompt);
        }
        if ('input' in parsed && parsed.input !== undefined && parsed.input !== null) {
            return extractContent(parsed.input);
        }
        if ('output' in parsed && parsed.output !== undefined && parsed.output !== null) {
            return extractContent(parsed.output);
        }
        if ('args' in parsed && parsed.args !== undefined && parsed.args !== null) {
            return extractContent(parsed.args);
        }
        if ('kwargs' in parsed && parsed.kwargs !== undefined && parsed.kwargs !== null) {
            return extractContent(parsed.kwargs);
        }
        if ('choices' in parsed && Array.isArray(parsed.choices) && parsed.choices.length > 0) {
            return extractContent(parsed.choices[0]);
        }

        const values = Object.values(parsed);
        if (values.length === 1) {
            return extractContent(values[0]);
        }
        
        return JSON.stringify(parsed);
    }

    return String(parsed);
};

// ... existing extractContent ...

export const extractSystemMessage = (data: any): string | null => {
    const parsed = safeParseJSON(data);

    // 0. Handle SDK Wrapper (args/kwargs)
    if (typeof parsed === 'object' && parsed !== null && 'args' in parsed && Array.isArray(parsed.args)) {
        for (const arg of parsed.args) {
            const sysMsg = extractSystemMessage(arg);
            if (sysMsg) return sysMsg;
        }
    }

    // 1. Array of messages
    if (Array.isArray(parsed)) {
        const sysMsg = parsed.find(item => 
            typeof item === 'object' && item !== null && item.role === 'system'
        );
        if (sysMsg && 'content' in sysMsg) {
             return typeof sysMsg.content === 'string' ? sysMsg.content : JSON.stringify(sysMsg.content);
        }
    }
    
    // 2. OpenAI / Azure Choices (unlikely in input, but possible in some formats)
    // usually input is just messages array.

    // 3. Single Object with role=system
    if (typeof parsed === 'object' && parsed !== null && parsed.role === 'system' && 'content' in parsed) {
         return typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content);
    }

    return null;
};

export const getPreviewString = (data: any, maxLength: number = 100): string => {
    let content = extractContent(data);
    if (content.length > maxLength) {
        return content.slice(0, maxLength) + '...';
    }
    return content;
};
