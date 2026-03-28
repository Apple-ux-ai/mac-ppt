import zhMessages from '../../locales/zh.json';
const messages = zhMessages;
function formatMessage(message, params) {
    if (!params)
        return message;
    return message.replace(/\{(\w+)\}/g, (_, key) => {
        const value = params[key];
        return value === undefined ? `{${key}}` : String(value);
    });
}
export function getMainText(key, fallback, params) {
    const template = messages[key] || fallback || key;
    return formatMessage(template, params);
}
