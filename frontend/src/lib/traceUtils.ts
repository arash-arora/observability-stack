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

    // 0. Handle SDK Wrapper (args/kwargs)
    if (typeof parsed === 'object' && parsed !== null && 'args' in parsed && Array.isArray(parsed.args)) {
        // Try to find the primary content (Message List or Prompt) in args
        for (const arg of parsed.args) {
             // 1. Check for list of messages
             if (Array.isArray(arg) && arg.length > 0 && arg.every(item => typeof item === 'object' && ('role' in item || 'content' in item))) {
                 return extractContent(arg);
             }
             // 2. Check for single message object
             if (typeof arg === 'object' && arg !== null && 'role' in arg && 'content' in arg) {
                 return extractContent(arg); 
             }
        }
    }

    // 1. Array of messages (Chat History) -> Concatenate content
    if (Array.isArray(parsed)) {
        // Check if it looks like a message list
        const isMessageList = parsed.every(item => typeof item === 'object' && item !== null && ('role' in item || 'content' in item));
        
        if (isMessageList) {
            return parsed.map(msg => {
                const role = msg.role ? `${msg.role}: ` : '';
                const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                let msgStr = `${role}${content}`;
                if ('tool_calls' in msg && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
                    msgStr += `\n[Tool Calls]: ${JSON.stringify(msg.tool_calls)}`;
                }
                return msgStr;
            }).join('\n');
        }
        return JSON.stringify(parsed);
    }
    
    // 2. OpenAI / Azure Response Format (choices array)
    if (typeof parsed === 'object' && parsed !== null && 'choices' in parsed && Array.isArray(parsed.choices) && parsed.choices.length > 0) {
        const choice = parsed.choices[0];
        // Chat Completion
        if (choice.message && typeof choice.message === 'object' && 'content' in choice.message) {
            let choiceStr = extractContent(choice.message.content);
            if ('tool_calls' in choice.message && Array.isArray(choice.message.tool_calls) && choice.message.tool_calls.length > 0) {
                choiceStr += `\n[Tool Calls]: ${JSON.stringify(choice.message.tool_calls, null, 2)}`;
            }
            return choiceStr;
        }
        // Legacy Completion
        if ('text' in choice) {
            return extractContent(choice.text);
        }
    }
    
    // 3. Single Object with 'content' or 'text' key
    if (typeof parsed === 'object' && parsed !== null) {
        let extractedStr = '';
        if ('content' in parsed) {
            extractedStr = typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content);
        } else if ('text' in parsed) {
            extractedStr = typeof parsed.text === 'string' ? parsed.text : JSON.stringify(parsed.text);
        }

        if ('tool_calls' in parsed && Array.isArray(parsed.tool_calls) && parsed.tool_calls.length > 0) {
            const tcStr = JSON.stringify(parsed.tool_calls, null, 2);
            extractedStr = extractedStr ? `${extractedStr}\n\n[Tool Calls]:\n${tcStr}` : `[Tool Calls]:\n${tcStr}`;
            return extractedStr;
        }

        if ('content' in parsed || 'text' in parsed) {
            return extractedStr;
        }
        // If it's a generic object without specific content fields, return stringified
        return JSON.stringify(parsed);
    }

    // 4. String or primitive
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
