import { ref, computed } from 'vue';
import { useUserState } from './useUserState';

export interface ChatMessage {
    id: string;
    role: 'user' | 'agent';
    text: string;
    timestamp: number;
    error?: boolean;
}

const messages = ref<ChatMessage[]>([]);
const loading = ref(false);
const sessionId = ref<string | null>(null);
const currentAgentId = ref<string | null>(null);

/**
 * Composable for the agent chat UI. Manages conversation state and sends
 * messages to deployed ADK agents through the Portal Gateway.
 *
 * Returns: messages, loading, sendMessage(text), selectAgent(agentId), clearChat()
 *
 * Used by pages/chat.vue. Gateway URL and tenant org come from runtime config.
 */
export function useAgentChat() {
    const { accessToken } = useUserState();

    function getGatewayUrl(): string {
        const config = useRuntimeConfig();
        return (config.public as any).gatewayUrl || '';
    }

    function getTenantOrgId(): string {
        const config = useRuntimeConfig();
        return (config.public as any).tenantOrgId || '';
    }

    function selectAgent(agentId: string) {
        if (currentAgentId.value !== agentId) {
            currentAgentId.value = agentId;
            messages.value = [];
            sessionId.value = null;
        }
    }

    async function sendMessage(text: string): Promise<void> {
        if (!text.trim() || loading.value) return;

        const gatewayUrl = getGatewayUrl();
        const orgId = getTenantOrgId();
        const agentId = currentAgentId.value;

        if (!gatewayUrl || !orgId || !agentId) {
            messages.value.push({
                id: crypto.randomUUID(),
                role: 'agent',
                text: 'Chat is not configured. Missing gateway URL, tenant org ID, or agent ID.',
                timestamp: Date.now(),
                error: true,
            });
            return;
        }

        const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            text,
            timestamp: Date.now(),
        };
        messages.value.push(userMsg);

        loading.value = true;
        try {
            const url = `${gatewayUrl}/api/agents/${orgId}/${agentId}/query`;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (accessToken.value) {
                headers['Authorization'] = `Bearer ${accessToken.value}`;
            }

            // Gateway auto-creates a session if none provided
            const body: any = { message: text };
            if (sessionId.value) {
                body.session_id = sessionId.value;
            }

            const response = await $fetch<{ output: any; session_id: string | null }>(url, {
                method: 'POST',
                headers,
                body,
            });

            if (response.session_id) {
                sessionId.value = response.session_id;
            }

            const agentText = extractAgentText(response.output);
            messages.value.push({
                id: crypto.randomUUID(),
                role: 'agent',
                text: agentText,
                timestamp: Date.now(),
            });
        } catch (e: any) {
            const errorText = e.data?.statusMessage || e.message || 'Failed to get agent response';
            messages.value.push({
                id: crypto.randomUUID(),
                role: 'agent',
                text: errorText,
                timestamp: Date.now(),
                error: true,
            });
        } finally {
            loading.value = false;
        }
    }

    function clearChat() {
        messages.value = [];
        sessionId.value = null;
    }

    const hasMessages = computed(() => messages.value.length > 0);

    return {
        messages: computed(() => messages.value),
        loading: computed(() => loading.value),
        sessionId: computed(() => sessionId.value),
        currentAgentId: computed(() => currentAgentId.value),
        hasMessages,
        selectAgent,
        sendMessage,
        clearChat,
    };
}

function extractAgentText(output: any): string {
    if (typeof output === 'string') return output;

    // Agent Engine returns various formats; try common ones
    if (output?.text) return output.text;
    if (output?.content)
        return typeof output.content === 'string'
            ? output.content
            : JSON.stringify(output.content, null, 2);
    if (output?.messages) {
        const last = output.messages[output.messages.length - 1];
        if (last?.parts?.[0]?.text) return last.parts[0].text;
        if (last?.content) return last.content;
    }
    if (output?.output) return extractAgentText(output.output);

    return JSON.stringify(output, null, 2);
}
