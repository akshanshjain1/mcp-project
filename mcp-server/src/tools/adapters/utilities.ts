import { v4 as uuidv4 } from 'uuid';
import os from 'os';

export interface UtilityPayload {
    action: 'weather' | 'time' | 'currency' | 'convert_currency' | 'math' | 'crypto' | 'translate' | 'ip' | 'system' | 'uuid' | 'joke';
    [key: string]: any;
}

export async function executeUtility(payload: UtilityPayload): Promise<string> {
    const { action, ...params } = payload;

    switch (action) {
        case 'weather':
            return getWeather(params.location);
        case 'time':
            return getTime(params.timezone);
        case 'currency':
        case 'convert_currency':
            return convertCurrency(params.from, params.to, params.amount);
        case 'math':
            return calculateMath(params.expression);
        case 'crypto':
            return getCryptoPrice(params.symbol);
        case 'translate':
            return translateText(params.text, params.targetLang);
        case 'ip':
            return getIpInfo(params.ip);
        case 'system':
            return getSystemInfo();
        case 'uuid':
            return `Generated UUID: ${uuidv4()}`;
        case 'joke':
            return getJoke();
        default:
            throw new Error(`Unknown utility action: ${action}`);
    }
}

async function getWeather(location: string): Promise<string> {
    if (!location) return '❌ Location is required';
    try {
        // Using wttr.in for simple text-based weather
        const response = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=3`);
        return await response.text();
    } catch (e) {
        return `❌ Failed to fetch weather for ${location}`;
    }
}

function getTime(timezone?: string): string {
    try {
        const options: Intl.DateTimeFormatOptions = {
            timeZone: timezone,
            dateStyle: 'full',
            timeStyle: 'long',
        };
        return new Date().toLocaleString('en-US', options);
    } catch (e) {
        return `❌ Invalid timezone: ${timezone}. Try 'UTC', 'America/New_York', 'Asia/Tokyo'`;
    }
}

async function convertCurrency(from: string, to: string, amount: number = 1): Promise<string> {
    if (!from || !to) return '❌ From and To currencies are required';
    try {
        const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`);
        const data = await response.json() as any;
        const rate = data.rates[to.toUpperCase()];
        if (!rate) return `❌ Currency ${to} not found`;
        return `${amount} ${from.toUpperCase()} = ${(amount * rate).toFixed(2)} ${to.toUpperCase()}`;
    } catch (e) {
        return '❌ Failed to fetch exchange rates';
    }
}

function calculateMath(expression: string): string {
    if (!expression) return '❌ Expression is required';
    try {
        // Safe evaluation using Function
        // eslint-disable-next-line no-new-func
        const result = new Function(`return ${expression.replace(/[^0-9+\-*/().]/g, '')}`)();
        return `${expression} = ${result}`;
    } catch (e) {
        return '❌ Invalid math expression';
    }
}

async function getCryptoPrice(symbol: string): Promise<string> {
    if (!symbol) return '❌ Symbol is required';
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd`);
        const data = await response.json() as any;
        if (!data[symbol.toLowerCase()]) return `❌ Crypto ${symbol} not found (try full name like 'bitcoin')`;
        return `${symbol}: $${data[symbol.toLowerCase()].usd}`;
    } catch (e) {
        return '❌ Failed to fetch crypto price';
    }
}

async function translateText(text: string, targetLang: string = 'es'): Promise<string> {
    if (!text) return '❌ Text is required';
    // Mock translation for now as free APIs are scarce/limited
    // In production, use Google Translate API or similar
    return `[MOCK TRANSLATE to ${targetLang}]: ${text}`;
}

async function getIpInfo(ip?: string): Promise<string> {
    try {
        const url = ip ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/';
        const response = await fetch(url);
        const data = await response.json() as any;
        return `IP: ${data.ip}\nLocation: ${data.city}, ${data.region}, ${data.country_name}\nISP: ${data.org}`;
    } catch (e) {
        return '❌ Failed to fetch IP info';
    }
}

function getSystemInfo(): string {
    return `
OS: ${os.type()} ${os.release()}
Platform: ${os.platform()}
Arch: ${os.arch()}
CPUs: ${os.cpus().length}
Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB
Uptime: ${(os.uptime() / 3600).toFixed(2)} hours
    `.trim();
}

async function getJoke(): Promise<string> {
    try {
        const response = await fetch('https://official-joke-api.appspot.com/random_joke');
        const data = await response.json() as any;
        return `${data.setup}\n\n... ${data.punchline} 😂`;
    } catch (e) {
        return 'Why did the developer go broke? Because he used up all his cache! (Fallback joke)';
    }
}
